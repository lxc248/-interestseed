import type { InterestSeedNode } from '../types/graph';

/** 发送给模型的最小数据：只有 id、标题、标签，不含正文或路径。 */
export interface RelationRequest {
  nodes: Array<{
    id: string;
    title: string;
    tags: string[];
  }>;
}

/** AI 建议只使用节点 ID 和一个简短关系名；不是图谱 Schema。 */
export interface AiRelationSuggestion {
  source: string;
  target: string;
  relation: string;
}

export interface AiSuggestionPayload {
  suggestions: AiRelationSuggestion[];
}

export interface ModelProvider {
  isAvailable(): Promise<boolean>;

  suggestRelations(request: RelationRequest): Promise<unknown>;

  /** 只读探索洞察：只发送匿名化主题/项目别名与聚合计数，不发送正文、路径或节点内容。 */
  explore?(request: ExplorationRequest): Promise<unknown>;

  dispose(): void;
}

export interface ExplorationRequest {
  themes: Array<{
    key: string;
    active: number;
    total: number;
  }>;
  projects: string[];
  activity: Array<{
    date: string;
    count: number;
  }>;
}

export interface ExplorationInsight {
  summary: string;
  opportunities: Array<{
    title: string;
    why: string;
    nextStep: string;
    themes: string[];
  }>;
}

export type ModelProviderErrorCode =
  | 'disabled'
  | 'not-authorized'
  | 'invalid-request'
  | 'network'
  | 'http'
  | 'invalid-response';

export class ModelProviderError extends Error {
  constructor(
    readonly code: ModelProviderErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ModelProviderError';
  }
}

/** 实验模型配置；默认关闭，不自动调用。 */
export interface ExperimentalModelConfig {
  displayName: string;
  model: string;
  baseUrl: string;
  protocol: 'openai-chat-completions';
}

export const DEEPSEEK_V4_PRO_CONFIG: ExperimentalModelConfig = {
  displayName: 'DeepSeek V4 Pro',
  model: 'cn:deepseek-v4-pro',
  baseUrl: 'http://localhost:7863/v1',
  protocol: 'openai-chat-completions',
};

/** 未来启用 AI 时需要向用户展示的字段清单与服务商信息。 */
export const RELATION_REQUEST_FIELDS = ['节点 id', '标题', '标签'] as const;

export const AI_ENABLEMENT_NOTICE =
  'AI 关系建议尚未启用。启用前会先展示将发送的字段（节点 id、标题、标签）与服务商，并征得你的明确授权；不会发送笔记正文、完整 Vault 或个人记录。';

export interface ModelProviderSettings {
  enableAI: boolean;
  aiConsentGranted: boolean;
}

/**
 * 第一版只有禁用实现：不读取 API Key、不发起网络请求。
 */
export class DisabledModelProvider implements ModelProvider {
  constructor(private readonly reason: string = AI_ENABLEMENT_NOTICE) {}

  async isAvailable(): Promise<boolean> {
    return false;
  }

  async suggestRelations(_request: RelationRequest): Promise<unknown> {
    throw new ModelProviderError('disabled', this.reason);
  }

  dispose(): void {
    // 没有需要释放的资源。
  }
}

/**
 * 从现有本地环境读取密钥；不写入设置、不记录、不输出。
 * 本地服务如果不需要认证，可以没有该变量。
 */
export function resolveLocalApiKey(): string | undefined {
  const env = (
    globalThis as {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env;
  const value = env?.INTERESTSEED_AI_API_KEY ?? env?.DEEPSEEK_API_KEY;
  return value && value.trim() ? value.trim() : undefined;
}

/**
 * OpenAI 兼容 Chat Completions 适配器。
 *
 * 只在用户明确启用并授权后创建。没有自动重试、没有模型切换；
 * 网络/HTTP/响应异常直接抛错，由调用方回退到本地规则发现。
 */
export class OpenAICompatibleModelProvider implements ModelProvider {
  private disposed = false;
  private abortController: AbortController | null = null;

  constructor(
    private readonly config: ExperimentalModelConfig = DEEPSEEK_V4_PRO_CONFIG,
    private readonly fetchImpl: typeof fetch = (input, init) => fetch(input, init),
    private readonly apiKey: string | undefined = resolveLocalApiKey(),
  ) {}

  async isAvailable(): Promise<boolean> {
    return !this.disposed && typeof this.fetchImpl === 'function';
  }

  async suggestRelations(request: RelationRequest): Promise<unknown> {
    if (this.disposed) {
      throw new ModelProviderError('disabled', 'AI 服务已释放');
    }
    const safeRequest = sanitizeRelationRequest(request);

    const url = `${this.config.baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            {
              role: 'system',
              content:
                'Return exactly one JSON object. No prose, no Markdown, no code fences. ' +
                'The only allowed shape is {"suggestions":[{"source":"<node id>","target":"<node id>","relation":"<short relation>"}]}. ' +
                'Use only node ids supplied by the user. Return {"suggestions":[]} if there is nothing supported. ' +
                'Do not invent evidence or facts.',
            },
            {
              role: 'user',
              content:
                'Return exactly one JSON object. No prose, no Markdown, no code fences. ' +
                'Shape: {"suggestions":[{"source":"<node id>","target":"<node id>","relation":"<short relation>"}]}. ' +
                'Use only node ids from this input; return {"suggestions":[]} if none:\n' +
                JSON.stringify(safeRequest),
            },
          ],
          temperature: 0,
          stream: false,
          response_format: { type: 'json_object' },
        }),
      });
    } catch {
      throw new ModelProviderError('network', 'AI 本地服务不可用');
    }

    if (!response.ok) {
      throw new ModelProviderError('http', `AI 服务返回 HTTP ${response.status}`);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new ModelProviderError('invalid-response', 'AI 服务返回非 JSON');
    }

    const content = extractContent(payload);
    if (content === null) {
      throw new ModelProviderError('invalid-response', 'AI 服务返回结构无效');
    }
    return parseSuggestionPayload(
      content,
      new Set(safeRequest.nodes.map((node) => node.id)),
    );
  }

  async explore(request: ExplorationRequest): Promise<unknown> {
    if (this.disposed) {
      throw new ModelProviderError('disabled', 'AI 服务已释放');
    }
    const safeRequest = sanitizeExplorationRequest(request);
    const url = `${this.config.baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;

    let response: Response;
    const controller = new AbortController();
    this.abortController = controller;
    const timeout = globalThis.setTimeout(() => controller.abort(), 30_000);
    try {
      response = await this.fetchImpl(url, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            {
              role: 'system',
              content:
                'Return exactly one JSON object. No prose, no Markdown, no code fences. ' +
                'Shape: {"summary":"<short Chinese summary>","opportunities":[{"title":"<short title>","why":"<why supported by aggregate counts>","nextStep":"<concrete next action>","themes":["<theme>"]}]}. ' +
                'Use only aggregate themes, projects and counts supplied by the user. ' +
                'Do not invent facts, note content, sources or causes. ' +
                'If evidence is insufficient, return a cautious summary and 0-2 opportunities.',
            },
            {
              role: 'user',
              content:
                'Analyze this aggregated interest data. Return exactly one JSON object with the required shape:\n' +
                JSON.stringify(safeRequest),
            },
          ],
          temperature: 0.2,
          stream: false,
          response_format: { type: 'json_object' },
        }),
      });
    } catch {
      throw new ModelProviderError('network', 'AI 本地服务不可达或请求超时');
    } finally {
      globalThis.clearTimeout(timeout);
      if (this.abortController === controller) this.abortController = null;
    }

    if (!response.ok) {
      throw new ModelProviderError('http', `AI 服务返回 HTTP ${response.status}`);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new ModelProviderError('invalid-response', 'AI 服务返回非 JSON');
    }
    const content = extractContent(payload);
    if (content === null) {
      throw new ModelProviderError('invalid-response', 'AI 服务返回结构无效');
    }
    return parseExplorationInsight(
      content,
      new Set(safeRequest.themes.map((theme) => theme.key)),
    );
  }

  dispose(): void {
    this.disposed = true;
    this.abortController?.abort();
    this.abortController = null;
  }
}

function extractContent(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const first = choices[0];
  if (typeof first !== 'object' || first === null) return null;
  const message = (first as { message?: unknown }).message;
  if (typeof message !== 'object' || message === null) return null;
  const content = (message as { content?: unknown }).content;
  return typeof content === 'string' && content.trim() ? content : null;
}

/**
 * 只允许纯 JSON 或完整包裹单个 JSON 的 Markdown 代码围栏。
 * 不从前缀/后缀说明文本中提取 JSON，避免把混合内容误判为有效建议。
 */
export const MAX_AI_RELATION_LENGTH = 120;

function parseSuggestionPayload(
  content: string,
  allowedNodeIds: ReadonlySet<string>,
): AiSuggestionPayload {
  let text = content.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(text);
  if (fence) text = fence[1]!.trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ModelProviderError('invalid-response', 'AI 返回内容不是 JSON');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new ModelProviderError('invalid-response', 'AI 返回内容不是 JSON 对象');
  }

  const suggestions = (parsed as { suggestions?: unknown }).suggestions;
  if (!Array.isArray(suggestions)) {
    throw new ModelProviderError('invalid-response', 'AI 返回缺少 suggestions 数组');
  }

  const normalized = suggestions.map((item) => {
      if (
        typeof item !== 'object' ||
        item === null ||
        typeof (item as { source?: unknown }).source !== 'string' ||
        !(item as { source: string }).source.trim() ||
        typeof (item as { target?: unknown }).target !== 'string' ||
        !(item as { target: string }).target.trim() ||
        typeof (item as { relation?: unknown }).relation !== 'string' ||
        !(item as { relation: string }).relation.trim()
      ) {
        throw new ModelProviderError(
          'invalid-response',
          'AI 建议缺少 source/target/relation 字符串',
        );
      }
      const source = (item as { source: string }).source.trim();
      const target = (item as { target: string }).target.trim();
      const relation = (item as { relation: string }).relation.trim();
      if (relation.length > MAX_AI_RELATION_LENGTH) {
        throw new ModelProviderError('invalid-response', 'AI 建议关系名过长');
      }
      if (source === target) {
        throw new ModelProviderError('invalid-response', 'AI 建议不能是自环');
      }
      if (!allowedNodeIds.has(source) || !allowedNodeIds.has(target)) {
        throw new ModelProviderError('invalid-response', 'AI 建议引用了未提交的节点');
      }
      return { source, target, relation };
    });

  const seen = new Set<string>();
  for (const item of normalized) {
    const key = `${item.source}\u0000${item.target}\u0000${item.relation}`;
    if (seen.has(key)) {
      throw new ModelProviderError('invalid-response', 'AI 建议包含重复项');
    }
    seen.add(key);
  }
  return { suggestions: normalized };
}

/**
 * 构造最小请求：显式挑选字段，避免把 metadata（摘要、路径等）带出去。
 */
export function buildRelationRequest(nodes: InterestSeedNode[]): RelationRequest {
  return {
    nodes: nodes.map((node) => ({
      id: node.id,
      title: node.title,
      tags: [...node.tags],
    })),
  };
}

/** 运行时白名单重建，避免调用方通过额外属性绕过 DTO 字段约束。 */
function sanitizeRelationRequest(input: RelationRequest): RelationRequest {
  if (!input || !Array.isArray(input.nodes)) {
    throw new ModelProviderError('invalid-request', 'AI 请求无效');
  }

  const nodes = input.nodes.map((node) => {
    if (
      typeof node !== 'object' ||
      node === null ||
      typeof node.id !== 'string' ||
      typeof node.title !== 'string' ||
      !Array.isArray(node.tags) ||
      !node.tags.every((tag) => typeof tag === 'string')
    ) {
      throw new ModelProviderError('invalid-request', 'AI 请求节点字段无效');
    }
    return {
      id: node.id,
      title: node.title,
      tags: [...node.tags],
    };
  });

  return { nodes };
}

function sanitizeExplorationRequest(input: ExplorationRequest): ExplorationRequest {
  if (!input || !Array.isArray(input.themes) || !Array.isArray(input.projects) || !Array.isArray(input.activity)) {
    throw new ModelProviderError('invalid-request', 'AI 探索请求无效');
  }
  const themes = input.themes.map((item) => {
    if (
      typeof item?.key !== 'string' ||
      typeof item.active !== 'number' ||
      typeof item.total !== 'number'
    ) {
      throw new ModelProviderError('invalid-request', 'AI 主题字段无效');
    }
    return { key: item.key, active: item.active, total: item.total };
  });
  const projects = input.projects.filter((item): item is string => typeof item === 'string');
  const activity = input.activity.map((item) => {
    if (typeof item?.date !== 'string' || typeof item.count !== 'number') {
      throw new ModelProviderError('invalid-request', 'AI 活动字段无效');
    }
    return { date: item.date, count: item.count };
  });
  return { themes, projects, activity };
}

/** 只接受完整 JSON 或完整代码围栏，避免从解释文本中猜测 JSON。 */
export function parseExplorationInsight(
  content: string,
  allowedThemes?: ReadonlySet<string>,
): ExplorationInsight {
  let text = content.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(text);
  if (fence) text = fence[1]!.trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ModelProviderError('invalid-response', 'AI 返回内容不是 JSON');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new ModelProviderError('invalid-response', 'AI 返回内容不是对象');
  }
  const summary = (parsed as { summary?: unknown }).summary;
  const opportunities = (parsed as { opportunities?: unknown }).opportunities;
  if (typeof summary !== 'string' || !summary.trim() || summary.length > 2000) {
    throw new ModelProviderError('invalid-response', 'AI 总结缺失或过长');
  }
  if (!Array.isArray(opportunities) || opportunities.length > 8) {
    throw new ModelProviderError('invalid-response', 'AI 机会列表无效');
  }
  const normalized = opportunities.map((item) => {
    if (typeof item !== 'object' || item === null) {
      throw new ModelProviderError('invalid-response', 'AI 机会项无效');
    }
    const title = (item as { title?: unknown }).title;
    const why = (item as { why?: unknown }).why;
    const nextStep = (item as { nextStep?: unknown }).nextStep;
    const themeList = (item as { themes?: unknown }).themes;
    if (
      typeof title !== 'string' ||
      typeof why !== 'string' ||
      typeof nextStep !== 'string' ||
      !Array.isArray(themeList) ||
      !themeList.every((value) => typeof value === 'string')
    ) {
      throw new ModelProviderError('invalid-response', 'AI 机会字段无效');
    }
    return {
      title: title.trim().slice(0, 120),
      why: why.trim().slice(0, 500),
      nextStep: nextStep.trim().slice(0, 300),
      themes: themeList
        .filter(
          (value): value is string =>
            typeof value === 'string' && (!allowedThemes || allowedThemes.has(value)),
        )
        .slice(0, 12),
    };
  });
  return { summary: summary.trim(), opportunities: normalized };
}

/**
 * v1 默认禁用；只有 enableAI 与 aiConsentGranted 同时为 true 才创建实验适配器。
 * 关闭或不满足授权时始终使用禁用实现。
 */
export function createModelProvider(
  settings: ModelProviderSettings = { enableAI: false, aiConsentGranted: false },
  requestImpl?: typeof fetch,
): ModelProvider {
  if (!settings.enableAI || !settings.aiConsentGranted) {
    return new DisabledModelProvider();
  }
  return new OpenAICompatibleModelProvider(
    DEEPSEEK_V4_PRO_CONFIG,
    requestImpl ?? ((input, init) => fetch(input, init)),
  );
}
