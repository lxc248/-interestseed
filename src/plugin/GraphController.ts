import { Notice, requestUrl } from 'obsidian';
import type { App } from 'obsidian';

import type { ObsidianVaultAdapterImpl } from '../adapters/ObsidianVaultAdapter';
import { detectNodeType, type BuildReport, type InterestSeedGraphBuilder } from '../core/GraphBuilder';
import type { InterestSeedGraphStore } from '../core/GraphStore';
import type { GraphSession } from '../core/GraphSession';
import {
  buildRelationRequest,
  createModelProvider,
  type AiRelationSuggestion,
} from '../services/ModelProvider';
import { emptyGraph } from '../types/graph';
import type {
  GraphViewport,
  InterestSeedEdge,
  InterestSeedNode,
  InterestSeedSettings,
  NodeType,
} from '../types/graph';
import { createId, edgeIdFor, nodeIdForUri } from '../utils/ids';
import { extensionOf, noteTitleFromPath, pathFromUri } from '../utils/paths';
import { downloadGraphJson } from '../utils/exportGraph';
import { confirmAction } from '../ui/ConfirmModal';
import { confirmClearGraph } from './destructiveConfirm';
import type { PersistenceService } from './PersistenceService';
import { writeConfirmedAiSuggestion } from '../services/AiSuggestionConfirmation';

const TYPE_LABELS: Record<NodeType, string> = {
  project: '项目',
  document: '文档',
  topic: '主题',
  image: '图片',
  audio: '音频',
  video: '视频',
  activity: '活动',
};

/**
 * Obsidian 的渲染进程 fetch 可能被 CSP/CORS 拦截；requestUrl 走 Obsidian
 * 网络桥接，不改变 AI 请求体，也不绕过用户授权。
 */
const requestUrlAsFetch: typeof fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input.toString();
  const response = await requestUrl({
    url,
    method: init?.method,
    headers: init?.headers as Record<string, string> | undefined,
    body: typeof init?.body === 'string' ? init.body : undefined,
    throw: false,
  });
  return {
    ok: response.status >= 200 && response.status < 300,
    status: response.status,
    json: async () => JSON.parse(response.text),
  } as Response;
};

/** 桌面端 Node 网络回退；移动端没有 require 时仍使用 requestUrl。 */
const nodeHttpAsFetch: typeof fetch = async (input, init) => {
  const runtimeRequire = (
    globalThis as {
      require?: (id: string) => unknown;
    }
  ).require;
  if (typeof runtimeRequire !== 'function') {
    return requestUrlAsFetch(input, init);
  }
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const http = runtimeRequire('http') as typeof import('http');
  const url = new URL(typeof input === 'string' ? input : input.toString());
  return await new Promise<Response>((resolve, reject) => {
    const request = http.request(
      {
        hostname: url.hostname,
        port: url.port || 80,
        path: `${url.pathname}${url.search}`,
        method: init?.method ?? 'GET',
        headers: init?.headers as Record<string, string> | undefined,
        timeout: 60_000,
      },
      (response) => {
        let text = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          text += chunk;
        });
        response.on('end', () => {
          resolve({
            ok: (response.statusCode ?? 0) >= 200 && (response.statusCode ?? 0) < 300,
            status: response.statusCode ?? 0,
            json: async () => JSON.parse(text),
          } as Response);
        });
      },
    );
    request.on('timeout', () => request.destroy(new Error('AI 请求超时')));
    request.on('error', reject);
    if (typeof init?.body === 'string') request.write(init.body);
    request.end();
  });
};

const aiRequestFetch: typeof fetch = (input, init) => {
  const runtimeRequire = (
    globalThis as {
      require?: (id: string) => unknown;
    }
  ).require;
  if (typeof runtimeRequire === 'function') {
    return nodeHttpAsFetch(input, init);
  }
  return requestUrlAsFetch(input, init);
};

export interface GraphControllerDeps {
  app: App;
  store: InterestSeedGraphStore;
  session: GraphSession;
  persistence: PersistenceService;
  vault: ObsidianVaultAdapterImpl;
  builder: InterestSeedGraphBuilder;
  settings: InterestSeedSettings;
  getSelectedNodeId(): string | null;
  setSelectedNodeId(id: string | null): void;
  getAiApiKey(): Promise<string | undefined>;
  openAiSetup(): void;
  activateView(): Promise<void>;
  markRebuilt(at: string): Promise<void>;
  setScanning(scanning: boolean): void;
  reportError(message: string | null): void;
  openAiSuggestions(suggestions: AiRelationSuggestion[]): void;
}

/**
 * 图谱业务操作：建图、规则建议、节点/关系编辑、AI 扩展、视口与存储操作。
 * 所有写操作都通过 GraphSession，保证可撤销。
 */
export class GraphController {
  private rebuildInFlight = false;

  constructor(private readonly deps: GraphControllerDeps) {}

  async rebuildGraph(silent = false): Promise<void> {
    if (this.rebuildInFlight) return;
    this.rebuildInFlight = true;
    this.deps.setScanning(true);

    try {
      const scan = await this.deps.vault.scanMarkdown({
        includeFolders: this.deps.settings.includeFolders,
        excludeFolders: this.deps.settings.excludeFolders,
        includeTags: this.deps.settings.includeTags,
        maxFiles: 5000,
      });

      this.deps.builder.configure({
        enableRuleSuggestions: this.deps.settings.enableRuleSuggestions,
        minConfidence: 0.35,
      });

      const graph = this.deps.builder.build(scan.nodes, {
        includeFolders: this.deps.settings.includeFolders,
        includeTags: this.deps.settings.includeTags,
        includeOutgoingLinks: true,
      });
      const report = this.deps.builder.lastReport;

      // 收窄目录/标签时，旧节点的受保护关系可能从新图中消失。
      // 先备份并明确告警，避免静默覆盖用户已确认/已拒绝的决定。
      const current = this.deps.store.getGraph();
      const nextNodeIds = new Set(graph.nodes.map((node) => node.id));
      const nextEdgeIds = new Set(graph.edges.map((edge) => edge.id));
      const lostNodes = current.nodes.filter((node) => !nextNodeIds.has(node.id));
      const lostProtected = current.edges.filter(
        (edge) =>
          !nextEdgeIds.has(edge.id) &&
          (edge.status !== 'suggested' || edge.origin === 'ai' || edge.userRenamed === true),
      );
      if (lostProtected.length > 0 || lostNodes.length > 0) {
        try {
          await this.deps.persistence.createBackup();
        } catch (backupError) {
          report.warnings.push(
            `范围收窄导致数据减少，但自动备份失败：${
              backupError instanceof Error ? backupError.message : String(backupError)
            }`,
          );
        }
        report.warnings.push(
          `本次重建移除了 ${lostNodes.length} 个节点、${lostProtected.length} 条已确认/用户关系；已尝试创建备份，请先确认范围设置。`,
        );
      }

      this.deps.session.apply(graph);

      const rebuiltAt = new Date().toISOString();
      await this.deps.markRebuilt(rebuiltAt);
      this.notifyBuildConflicts(report, silent);

      if (!silent) {
        const warningCount = scan.warnings.length + report.warnings.length;
        new Notice(
          `InterestSeed：已构建 ${report.nodes} 个节点、${report.edges} 条关系${
            warningCount > 0 ? `，${warningCount} 条警告（见控制台）` : ''
          }。`,
          6000,
        );
      }

      const warnings = [...scan.warnings, ...report.warnings];
      if (warnings.length > 0) {
        console.warn(`[InterestSeed] 扫描警告：\n${warnings.join('\n')}`);
      }
      this.deps.reportError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[InterestSeed] 重建图谱失败', error);
      this.deps.reportError(`重建图谱失败：${message}。请检查设置中的目录范围与文件权限，然后重试。`);
      new Notice(`InterestSeed：重建失败——${message}`, 8000);
    } finally {
      this.rebuildInFlight = false;
      this.deps.setScanning(false);
    }
  }

  refreshSuggestions(): void {
    this.deps.builder.configure({
      enableRuleSuggestions: this.deps.settings.enableRuleSuggestions,
      minConfidence: 0.35,
    });

    const current = this.deps.store.getGraph();
    const graph = this.deps.builder.build(
      current.nodes.filter((node) => Boolean(node.sourceUri)),
      {
        includeFolders: this.deps.settings.includeFolders,
        includeTags: [],
        includeOutgoingLinks: true,
      },
    );
    const report = this.deps.builder.lastReport;

    this.deps.session.apply(graph);
    this.notifyBuildConflicts(report, false);
    new Notice(`InterestSeed：已刷新关系建议，共 ${report.edges} 条关系。`, 5000);
  }

  private notifyBuildConflicts(report: BuildReport, silent: boolean): void {
    if (report.conflicts.length === 0) return;

    const details = report.conflicts
      .slice(0, 3)
      .map(
        (conflict) =>
          `「${conflict.keptRelation}」←规则候选「${conflict.candidateRelation}」`,
      )
      .join('；');
    const suffix = report.conflicts.length > 3 ? ` 等 ${report.conflicts.length} 条` : '';
    const message =
      `InterestSeed：检测到关系重命名冲突，已保留你的名称：${details}${suffix}。` +
      '未覆盖、未新增重复关系；可在详情面板手动改回规则名称。';
    console.warn(`[InterestSeed] ${message}`);
    if (!silent) new Notice(message, 10000);
  }

  createNode(title: string, type: NodeType = 'topic'): void {
    const now = new Date().toISOString();
    const node: InterestSeedNode = {
      id: createId('node'),
      type,
      title,
      tags: [],
      createdAt: now,
      updatedAt: now,
      metadata: {},
    };

    this.deps.session.addNode(node, `新建${TYPE_LABELS[type]}「${title}」`);
  }

  createFromActiveFile(): void {
    const uri = this.deps.vault.getActiveFileUri();
    if (!uri) {
      new Notice('当前没有打开的文件。');
      return;
    }

    const existing = this.deps.store.findNodeByUri(uri);
    if (existing) {
      this.deps.setSelectedNodeId(existing.id);
      void this.deps.activateView();
      new Notice(`《${existing.title}》已经在图谱里了。`);
      return;
    }

    const path = pathFromUri(uri);
    const extension = extensionOf(path);
    const type = detectNodeType({ path, extension });
    const title = noteTitleFromPath(path);
    const now = new Date().toISOString();

    this.deps.session.addNode(
      {
        id: nodeIdForUri(uri),
        type,
        title,
        sourceUri: uri,
        tags: [],
        createdAt: now,
        updatedAt: now,
        metadata: { path, extension },
      },
      `从文件创建${TYPE_LABELS[type]}「${title}」`,
    );
  }

  confirmEdge(edgeId: string): boolean {
    return this.transitionEdgeStatus(edgeId, 'suggested', 'confirmed', '确认关系');
  }

  rejectEdge(edgeId: string): boolean {
    return this.transitionEdgeStatus(edgeId, 'suggested', 'rejected', '拒绝关系');
  }

  restoreEdge(edgeId: string): boolean {
    return this.transitionEdgeStatus(edgeId, 'rejected', 'suggested', '恢复关系为建议');
  }

  private transitionEdgeStatus(
    edgeId: string,
    expected: 'suggested' | 'rejected',
    next: 'confirmed' | 'suggested' | 'rejected',
    action: string,
  ): boolean {
    const edge = this.deps.store.getEdge(edgeId);
    if (!edge) {
      new Notice('关系不存在，可能已被删除；请刷新后重试。');
      return false;
    }
    if (edge.status !== expected) {
      new Notice(`关系「${edge.relation}」当前状态已变化，未重复处理。`);
      return false;
    }

    try {
      if (expected === 'rejected' && next === 'suggested') {
        this.deps.session.restoreEdge(edgeId, `${action}「${edge.relation}」`);
      } else {
        this.deps.session.updateEdge(
          edgeId,
          { status: next },
          `${action}「${edge.relation}」`,
        );
      }
      this.deps.reportError(null);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.deps.reportError(`${action}失败：${message}`);
      new Notice(`${action}失败：${message}`, 8000);
      return false;
    }
  }

  createRelation(sourceId: string, targetId: string, relation: string): void {
    const name = relation.trim();
    if (!name) {
      new Notice('关系名称不能为空。');
      return;
    }

    const source = this.deps.store.getNode(sourceId);
    const target = this.deps.store.getNode(targetId);
    if (!source || !target || sourceId === targetId) {
      new Notice('请选择不同于源节点的目标节点。');
      return;
    }

    const now = new Date().toISOString();
    const edge: InterestSeedEdge = {
      id: edgeIdFor(sourceId, targetId, name),
      source: sourceId,
      target: targetId,
      relation: name,
      origin: 'user',
      status: 'confirmed',
      confidence: 1,
      evidence: ['用户手动创建'],
      createdAt: now,
      updatedAt: now,
    };

    try {
      this.deps.session.addEdge(edge, `创建关系「${name}」`);
      this.deps.reportError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.deps.reportError(`创建关系失败：${message}`);
      new Notice(`创建关系失败：${message}`, 8000);
    }
  }

  /** 修改关系名称；按已确认规则保留 edge.id、source、target、origin 与 status。 */
  editRelation(edgeId: string, relation: string): void {
    const current = this.deps.store.getEdge(edgeId);
    if (!current) {
      new Notice('关系不存在，可能已被删除。');
      return;
    }

    const name = relation.trim();
    if (!name) {
      new Notice('关系名称不能为空。');
      return;
    }
    if (name === current.relation) return;

    try {
      this.deps.session.updateEdge(
        edgeId,
        { relation: name },
        `编辑关系「${current.relation}」`,
      );
      this.deps.reportError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.deps.reportError(`编辑关系失败：${message}`);
      new Notice(`编辑关系失败：${message}`, 8000);
    }
  }

  deleteEdge(edgeId: string): void {
    try {
      this.deps.session.removeEdge(edgeId, '删除关系');
      this.deps.reportError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.deps.reportError(`删除关系失败：${message}`);
      new Notice(`删除关系失败：${message}`, 8000);
    }
  }

  async deleteNode(nodeId: string): Promise<void> {
    const node = this.deps.store.getNode(nodeId);
    if (!node) return;
    if (!(await confirmAction(this.deps.app, `删除「${node.title}」及其所有关系？`))) {
      return;
    }

    this.deps.session.removeNode(nodeId, `删除节点「${node.title}」`);
    if (this.deps.getSelectedNodeId() === nodeId) this.deps.setSelectedNodeId(null);
  }

  async openSource(uri: string): Promise<void> {
    try {
      await this.deps.vault.openSource(uri);
      this.deps.reportError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.deps.reportError(
        `打开来源失败：${message}。请确认文件仍在 vault 中，必要时重新扫描。`,
      );
      new Notice(`打开来源失败：${message}`, 8000);
    }
  }

  async expandWithAI(nodeId?: string): Promise<void> {
    const graph = this.deps.store.getGraph();
    const focusNodeId = nodeId ?? this.deps.getSelectedNodeId() ?? undefined;
    const request = buildRelationRequest(graph.nodes, {
      focusNodeId,
      existingEdges: graph.edges.map((edge) => ({
        source: edge.source,
        target: edge.target,
      })),
      maxSuggestions: 5,
    });
    const apiKey = await this.deps.getAiApiKey();
    const provider = createModelProvider(
      {
        enableAI: this.deps.settings.enableAI,
        aiConsentGranted: this.deps.settings.aiConsentGranted,
        model: this.deps.settings.aiModel,
      },
      aiRequestFetch,
      apiKey,
    );
    try {
      const available = await provider.isAvailable();
      if (!available) {
        this.deps.openAiSetup();
        return;
      }

      const result = await provider.suggestRelations(request);
      const suggestions = (result as { suggestions?: AiRelationSuggestion[] }).suggestions;
      if (!Array.isArray(suggestions) || suggestions.length === 0) {
        new Notice('AI 没有返回候选关系；本地规则发现保持不变。', 8000);
        return;
      }
      this.deps.openAiSuggestions(suggestions);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/\b401\b|\b403\b/.test(message)) {
        this.deps.openAiSetup();
        return;
      }
      new Notice(`AI 建议不可用：${message}。已保留本地规则发现。`, 10_000);
    } finally {
      provider.dispose();
    }
  }

  /**
   * 用户确认一条 AI 候选关系后才进入正式写入路径。
   * 重新校验节点、自环、重复关系，并等待持久化结果。
   */
  async confirmAiSuggestion(
    suggestion: AiRelationSuggestion,
  ): Promise<{ ok: boolean; message?: string }> {
    const result = await writeConfirmedAiSuggestion(
      suggestion,
      {
        aiEnabled: this.deps.settings.enableAI,
        consentGranted: this.deps.settings.aiConsentGranted,
        hasNode: (id) => this.deps.store.getNode(id) !== undefined,
        hasEdge: (source, target, relation) =>
          this.deps.store.findEdge(source, target, relation) !== undefined ||
          this.deps.store.findEdge(target, source, relation) !== undefined,
      },
      {
        addEdge: (edge) =>
          this.deps.session.addEdge(edge, `确认 AI 建议「${edge.relation}」`),
        removeEdge: (edgeId) => this.deps.store.removeEdge(edgeId),
        flush: () => this.deps.persistence.flush(),
        saveFailed: () => this.deps.persistence.state.saveFailed,
      },
    );
    if (!result.ok) {
      this.deps.reportError(`确认 AI 建议失败：${result.message ?? '未知错误'}`);
    } else {
      this.deps.reportError(null);
    }
    return result;
  }

  saveViewport(viewport: GraphViewport): void {
    this.deps.store.setViewport(viewport, { silent: true });
    this.deps.persistence.scheduleSave();
  }

  /** 将当前图谱导出为本地 JSON 下载；不写入 Vault、不发起网络请求。 */
  exportGraph(): void {
    try {
      const filename = downloadGraphJson(this.deps.store.toJSON());
      new Notice(`InterestSeed：已导出图谱 ${filename}`, 6000);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      new Notice(`InterestSeed：导出图谱失败——${message}`, 8000);
    }
  }

  async clearGraph(): Promise<void> {
    if (this.deps.persistence.isBlocked) {
      new Notice('存储处于暂停状态，请先运行“备份旧数据并重置图谱存储”。');
      return;
    }
    if (this.deps.store.isEmpty()) {
      new Notice('图谱已经是空的。');
      return;
    }
    if (!(await confirmClearGraph(this.deps.app))) {
      return;
    }

    this.deps.session.replace(emptyGraph(new Date().toISOString()), '清空图谱');
    this.deps.setSelectedNodeId(null);
    await this.deps.persistence.flush();
  }

  async retrySave(): Promise<void> {
    if (this.deps.persistence.isBlocked) {
      new Notice('存储处于暂停状态，请先运行“备份旧数据并重置图谱存储”。');
      return;
    }

    const saved = await this.deps.persistence.retry();
    new Notice(
      saved
        ? '图谱已保存。'
        : '保存仍然失败，修改保留在内存中。请检查磁盘空间与插件目录权限，或执行“创建图谱备份”。',
      10_000,
    );
  }

  async createBackup(): Promise<void> {
    try {
      const key = await this.deps.persistence.createBackup();
      new Notice(`InterestSeed：已创建图谱备份：${key ?? '(未知路径)'}`, 8000);
    } catch (error) {
      new Notice(
        `备份失败：${
          error instanceof Error ? error.message : String(error)
        }。请检查磁盘空间与插件目录权限后重试。`,
        10_000,
      );
    }
  }

  async repairGraphStorage(): Promise<void> {
    if (!this.deps.persistence.isBlocked) {
      new Notice('当前没有需要修复的存储状态。');
      return;
    }
    if (
      !(await confirmAction(
        this.deps.app,
        '将先把原文件复制为备份，然后允许写入当前图谱。原文件不会被删除，继续？',
      ))
    ) {
      return;
    }

    try {
      const backup = await this.deps.persistence.repair();
      new Notice(
        backup
          ? `已备份原文件到 ${backup}，图谱存储已恢复。`
          : '图谱存储已恢复。',
        10_000,
      );
    } catch (error) {
      new Notice(
        `修复失败：${error instanceof Error ? error.message : String(error)}`,
        10_000,
      );
    }
  }

  async flush(): Promise<void> {
    await this.deps.persistence.flush();
  }
}
