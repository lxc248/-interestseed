import type { App, EventRef } from 'obsidian';

import {
  ModelProviderError,
  parseExplorationInsight,
  sanitizeExplorationRequest,
  type ExplorationInsight,
  type ExplorationRequest,
} from './ModelProvider';

interface ClaudianApi {
  readonly version: number;
  getActiveSessionId(): string | null;
  send(
    sessionId: string,
    options: { text?: string; mode?: 'queue' | 'steer' | 'interrupt' },
  ): Promise<unknown>;
  read(sessionId: string): Promise<string>;
}

interface ClaudianHost {
  api?: ClaudianApi;
}

interface WorkspaceWithClaudian {
  on(name: string, callback: (payload: { sessionId: string }) => void): EventRef;
  offref(ref: EventRef): void;
}

function getClaudianApi(app: App): ClaudianApi | null {
  const plugins = (app as unknown as { plugins?: { getPlugin(id: string): unknown } }).plugins;
  const host = plugins?.getPlugin('realclaudian') as ClaudianHost | null | undefined;
  const api = host?.api;
  return api?.version === 1 ? api : null;
}

export function hasClaudianApi(app: App): boolean {
  return getClaudianApi(app) !== null;
}

function buildPrompt(request: ExplorationRequest): string {
  const safe = sanitizeExplorationRequest(request);
  return [
    'You are the explanation layer for a local-first personal knowledge explorer.',
    'Return exactly one JSON object. No prose, no Markdown, no code fences.',
    'Shape: {"summary":"<short Chinese summary>","confidence":0.0,"reasoning":["<observation>","<inference>","<action>"],"opportunities":[{"title":"<short title>","why":"<why supported by aggregate counts>","nextStep":"<concrete next action>","themes":["<theme alias>"],"evidence":["<count or spread from input>"],"confidence":0.0}]}.',
    'Use only the aggregate themes, project aliases, counts and activity supplied below.',
    'Every opportunity must cite at least one numeric observation from the input in evidence.',
    'Do not invent facts, note content, sources or causes. If evidence is insufficient, use confidence below 0.5 and 0-2 opportunities.',
    '',
    JSON.stringify(safe),
  ].join('\n');
}

function waitForTurnEnd(
  app: App,
  sessionId: string,
  timeoutMs: number,
): { promise: Promise<void>; cancel: () => void } {
  const workspace = app.workspace as unknown as WorkspaceWithClaudian;
  let cancel = (): void => {};
  const promise = new Promise<void>((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let ref: EventRef | null = null;
    const cleanup = (): void => {
      if (timer !== null) clearTimeout(timer);
      if (ref) workspace.offref(ref);
      timer = null;
      ref = null;
    };
    const finish = (error?: Error): void => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve();
    };
    cancel = () => finish();
    ref = workspace.on('claudian:turn-ended', (payload) => {
      if (payload?.sessionId === sessionId) finish();
    });
    timer = setTimeout(() => {
      finish(new ModelProviderError('timeout', 'Claudian 会话响应超时，请稍后重试'));
    }, timeoutMs);
  });
  return { promise, cancel };
}

/**
 * 可选接入：使用已安装并启用的 Claudian 插件 API。
 *
 * 不复制 Claudian 的实现，也不依赖其内部文件；只调用其公开的
 * experimental v1 API。未安装、未启用或没有活动会话时给出明确错误。
 */
export async function exploreWithClaudian(
  app: App,
  request: ExplorationRequest,
): Promise<ExplorationInsight> {
  const api = getClaudianApi(app);
  if (!api) {
    throw new ModelProviderError(
      'disabled',
      '未检测到可用的 Claudian API；请先安装并启用 Claudian，或改用本地 OpenAI-compatible 服务。',
    );
  }
  const sessionId = api.getActiveSessionId();
  if (!sessionId) {
    throw new ModelProviderError(
      'not-authorized',
      '请先在 Claudian 中打开或选中一个会话，再生成探索解读。',
    );
  }

  const waiter = waitForTurnEnd(app, sessionId, 90_000);
  try {
    await api.send(sessionId, { text: buildPrompt(request), mode: 'queue' });
  } catch (error) {
    waiter.cancel();
    throw new ModelProviderError(
      'network',
      `Claudian 发送失败：${error instanceof Error ? error.message : String(error)}`,
    );
  }
  await waiter.promise;

  let reply: string;
  try {
    reply = await api.read(sessionId);
  } catch (error) {
    throw new ModelProviderError(
      'network',
      `Claudian 读取回复失败：${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return parseExplorationInsight(
    reply,
    new Set(request.themes.map((theme) => theme.key)),
  );
}
