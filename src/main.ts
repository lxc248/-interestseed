import { Notice, Plugin } from 'obsidian';
import type { WorkspaceLeaf } from 'obsidian';

import { ObsidianVaultAdapterImpl } from './adapters/ObsidianVaultAdapter';
import { InterestSeedGraphBuilder } from './core/GraphBuilder';
import { GraphSession } from './core/GraphSession';
import { InterestSeedGraphStore } from './core/GraphStore';
import { InsightEngine, type GraphInsights } from './core/InsightEngine';
import { InterestSeedRelationEngine } from './core/RelationEngine';
import { UndoHistory } from './core/UndoManager';
import { DiscoveryEngine } from './discovery/DiscoveryEngine';
import { applyDiscoveryFeedback, undoDiscoveryFeedback } from './discovery/feedback';
import { sortDiscoveries } from './discovery/ranking';
import { DiscoveryRepository } from './discovery/DiscoveryRepository';
import type { DiscoveryBackupStatus } from './discovery/DiscoveryRepository';
import {
  DiscoveryApplicationService,
  type DiscoveryApplicationDraft,
  type DiscoveryApplicationPreview,
  type DiscoveryApplicationResult,
} from './discovery/application';
import { DiscoveryWriteQueue } from './discovery/DiscoveryWriteQueue';
import { hasDiscoveryContentChanged } from './discovery/refresh';
import { AuditVaultBinding } from './discovery/auditBinding';
import {
  buildDiscoveryAuditFromProjection,
  formatDiscoveryAudit,
  type DiscoveryAuditScope,
} from './discovery/audit';
import {
  AuditRuntimeSession,
  loadDiscoveryAuditSource,
  type AuditRuntimeState,
} from './discovery/auditSource';
import { AuditTaskCoordinator, type AuditTaskToken } from './discovery/auditTask';
import { ObsidianDiscoveryAuditAdapter } from './adapters/ObsidianDiscoveryAuditAdapter';
import { notifyDiscoveryListenersSafely } from './discovery/notify';
import type {
  Discovery,
  DiscoveryCorrection,
  DiscoveryFeedbackAction,
  DiscoveryFile,
} from './discovery/types';
import { GraphController } from './plugin/GraphController';
import { PersistenceService, type PersistenceState } from './plugin/PersistenceService';
import { registerCommands } from './plugin/commands';
import { AiSuggestionModal } from './ui/AiSuggestionModal';
import type { AiRelationSuggestion } from './services/ModelProvider';
import { InterestSeedSettingsTab, normalizeSettings } from './settings/SettingsTab';
import { VaultGraphRepository, type LoadResult } from './storage/GraphRepository';
import {
  GRAPH_FILE,
  PluginDataStorage,
  migrateLegacyGraphFile,
} from './storage/PluginDataStorage';
import type { GraphViewport, InterestSeedNode, InterestSeedSettings } from './types/graph';
import { INTERESTSEED_VIEW_TYPE, InterestSeedView } from './ui/InterestSeedView';
import { AgentView, INTERESTSEED_AGENT_VIEW_TYPE } from './ui/AgentView';
import { NodeCreateModal } from './ui/NodeCreateModal';
import { SeedSprintModal } from './ui/SeedSprintModal';
import { SparkCaptureModal } from './ui/SparkCaptureModal';
import { GapCoachModal } from './ui/GapCoachModal';
import { ExperimentModal } from './ui/ExperimentModal';
import type { Insight } from './core/InsightEngine';
import {
  canRecordToday,
  createExperiment,
  experimentSummary,
  parseExperiment,
  recordExperimentLog,
  type ExperimentInput,
  type ExperimentState,
} from './experiment/experiment';
import type { SeedSprintDraft } from './onboarding/seedSprint';
import { edgeIdFor, hashString, nodeIdForUri } from './utils/ids';
import { RelationCreateModal } from './ui/RelationCreateModal';
import { RelationEditModal } from './ui/RelationEditModal';
import { ScanConfirmModal } from './ui/ScanConfirmModal';
import {
  DiscoveryAuditPreviewModal,
  DiscoveryAuditSaveModal,
  DiscoveryAuditScopeModal,
} from './ui/DiscoveryAuditModal';
import { DiscoveryOverviewModal } from './ui/DiscoveryOverviewModal';
import { DiscoveryExplorerModal } from './ui/DiscoveryExplorerModal';
import { buildDiscoveryOverview } from './discovery/overview';
import { buildExploration } from './discovery/exploration';
import {
  createModelProvider,
  type ExplorationInsight,
  type ExplorationRequest,
} from './services/ModelProvider';
import { exploreWithClaudian, hasClaudianApi } from './services/ClaudianProvider';
import { isRecord } from './utils/validation';

const DATA_SCHEMA_VERSION = 1;

/** 主界面底部状态栏使用的快照。 */
export interface InterestSeedStatus {
  scanning: boolean;
  lastError: string | null;
  blocked: boolean;
  blockedReason: string | null;
  saveFailed: boolean;
  nodes: number;
  edges: number;
  confirmed: number;
  suggested: number;
}

interface StoredPluginData {
  schemaVersion?: unknown;
  settings?: unknown;
  lastRebuiltAt?: unknown;
}

/**
 * 插件入口只负责生命周期与装配：
 * 业务操作在 GraphController，存储在 PersistenceService + GraphRepository，
 * 写操作统一经过 GraphSession（可撤销），命令注册在 plugin/commands。
 */
export default class InterestSeedPlugin extends Plugin {
  override settings: InterestSeedSettings = normalizeSettings(undefined);

  readonly store = new InterestSeedGraphStore();
  readonly undo = new UndoHistory({ maxDepth: 80 });
  readonly session = new GraphSession(this.store, this.undo);

  settingsLastRebuiltAt: string | null = null;

  private readonly relations = new InterestSeedRelationEngine();
  private readonly builder = new InterestSeedGraphBuilder(
    () => this.store.getGraph(),
    this.relations,
  );
  private readonly insightEngine = new InsightEngine();

  private storage!: PluginDataStorage;
  private repository!: VaultGraphRepository;
  private persistence!: PersistenceService;
  private controller!: GraphController;
  private vaultAdapter!: ObsidianVaultAdapterImpl;

  private discoveryStorage!: PluginDataStorage;
  private discoveryRepository!: DiscoveryRepository;
  private discoveryFile!: DiscoveryFile;
  private discoveryQueue!: DiscoveryWriteQueue;
  private discoveryApplication!: DiscoveryApplicationService;
  private discoveryLoadBlocked: string | null = null;
  private discoveryLoadBackupStatus: DiscoveryBackupStatus | null = null;
  private auditVaultBinding: AuditVaultBinding | null = null;
  private auditRuntimeSession: AuditRuntimeSession | null = null;
  readonly auditTasks = new AuditTaskCoordinator();
  private readonly discoveryListeners = new Set<() => void>();
  private unloading = false;

  private statusBarEl: HTMLElement | null = null;
  private selectedId: string | null = null;
  private insightsCache: { key: string; value: GraphInsights } | null = null;
  private scanning = false;
  private lastError: string | null = null;
  private readonly statusListeners = new Set<(status: InterestSeedStatus) => void>();

  override async onload(): Promise<void> {
    await this.loadState();
    this.auditVaultBinding = AuditVaultBinding.fromVault(this.app.vault);
    this.auditRuntimeSession = AuditRuntimeSession.fromLiveRuntime(
      () => this.getAuditRuntimeState() ?? {
        blocked: true,
        issues: ['runtime-state-unavailable'],
        queuePending: true,
        queueFailed: true,
        queueClosed: true,
        memoryMatchesPersisted: false,
        sourceRegistered: false,
      },
    );

    this.vaultAdapter = new ObsidianVaultAdapterImpl(this.app);
    this.storage = new PluginDataStorage(this);
    this.repository = new VaultGraphRepository(this.storage, { key: GRAPH_FILE });

    const migration = await migrateLegacyGraphFile(this.app, this.storage.pluginDir());
    if (migration === 'migrated') {
      new Notice('InterestSeed：已把 graph.json 迁移到 graphs/default.json。', 5000);
    } else if (migration === 'kept' || migration === 'failed') {
      console.warn(
        '[InterestSeed] 旧 graph.json 未迁移（目标已存在或迁移失败），读取逻辑会兜底处理。',
      );
    }

    this.persistence = new PersistenceService({
      store: this.store,
      repository: this.repository,
      onStateChange: (state) => this.handlePersistenceState(state),
      onError: (message) => {
        this.lastError = message;
        this.updateStatusBar();
        this.notifyStatus();
        new Notice(`InterestSeed：${message}`, 10_000);
      },
    });

    const loaded = await this.persistence.load();

    this.discoveryStorage = new PluginDataStorage(this, 'discoveries');
    this.discoveryRepository = new DiscoveryRepository(
      this.discoveryStorage,
      'discoveries.json',
    );
    const discoveryResult = await this.discoveryRepository.loadDetailed();
    this.discoveryFile = discoveryResult.file;
    this.discoveryLoadBlocked = discoveryResult.blockedReason;
    this.discoveryLoadBackupStatus = discoveryResult.backupStatus;
    const discoveryMigration = discoveryResult.migration;
    if (
      discoveryMigration &&
      (discoveryMigration.legacyRecords > 0 ||
        discoveryMigration.emptyEvidenceRecords > 0 ||
        discoveryMigration.supersededRecords > 0)
    ) {
      console.warn(
        `[InterestSeed] 发现迁移诊断（本次加载）：总 ${discoveryMigration.totalRecords}，legacy ${discoveryMigration.legacyRecords}，空证据 ${discoveryMigration.emptyEvidenceRecords}，自动收敛 ${discoveryMigration.supersededRecords}，本次实例持久化 ${discoveryMigration.persistedInThisInstance}；历史持久化 ${discoveryMigration.persistedHistory}`,
      );
      new Notice(
        `发现迁移诊断：本次加载 legacy ${discoveryMigration.legacyRecords}，空证据 ${discoveryMigration.emptyEvidenceRecords}，自动收敛 ${discoveryMigration.supersededRecords}；历史持久化未知`,
      );
    }
    this.discoveryQueue = new DiscoveryWriteQueue(
      this.discoveryFile,
      (file) => this.discoveryRepository.save(file),
      (file) => {
        this.discoveryFile = file;
        if (!this.unloading) this.notifyDiscoveryListeners();
      },
    );
    this.discoveryApplication = new DiscoveryApplicationService({
      store: this.store,
      session: this.session,
      persistence: this.persistence,
      getDiscovery: (id) =>
        this.discoveryQueue.getState().discoveries.find((item) => item.id === id),
      getState: () => this.discoveryQueue.getState(),
      enqueue: (mutator) => this.discoveryQueue.enqueue(mutator),
    });
    if (this.discoveryLoadBlocked) {
      const backupHint =
        this.discoveryLoadBackupStatus === 'succeeded'
          ? '原始内容已备份'
          : this.discoveryLoadBackupStatus === 'failed'
            ? '备份失败，原文件未被覆盖'
            : this.discoveryLoadBackupStatus === 'unavailable'
              ? '读取失败，原文件未被修改'
              : '';
      new Notice(
        `InterestSeed：${this.discoveryLoadBlocked}${backupHint ? `（${backupHint}）` : ''}`,
        10_000,
      );
    }

    this.controller = new GraphController({
      app: this.app,
      store: this.store,
      session: this.session,
      persistence: this.persistence,
      vault: this.vaultAdapter,
      builder: this.builder,
      settings: this.settings,
      getSelectedNodeId: () => this.selectedId,
      setSelectedNodeId: (nodeId) => this.setSelectedNode(nodeId),
      activateView: () => this.activateView(),
      markRebuilt: async (at) => {
        this.settingsLastRebuiltAt = at;
        await this.saveSettings();
      },
      setScanning: (scanning) => this.setScanning(scanning),
      reportError: (message) => this.reportError(message),
      openAiSuggestions: (suggestions) => this.openAiSuggestions(suggestions),
    });

    this.registerView(INTERESTSEED_VIEW_TYPE, (leaf) => new InterestSeedView(leaf, this));
    this.registerView(INTERESTSEED_AGENT_VIEW_TYPE, (leaf) => new AgentView(leaf, this));
    this.addRibbonIcon('sprout', '打开兴趣图谱', () => {
      void this.activateView();
    });
    this.addRibbonIcon('sparkles', '打开 InterestSeed Agent', () => {
      void this.activateAgentView();
    });
    registerCommands(this, this);
    this.addSettingTab(new InterestSeedSettingsTab(this.app, this));

    this.statusBarEl = this.addStatusBarItem();
    this.statusBarEl.addClass('interestseed-status-bar');
    this.statusBarEl.setAttribute('role', 'button');
    this.statusBarEl.setAttribute('tabindex', '0');
    this.statusBarEl.setAttribute('aria-label', '打开兴趣图谱');
    this.statusBarEl.addEventListener('click', () => {
      void this.activateView();
    });
    this.statusBarEl.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        void this.activateView();
      }
    });

    this.register(
      this.store.subscribe(() => {
        this.insightsCache = null;
        this.persistence.scheduleSave();
        this.updateStatusBar();
        this.notifyStatus();
      }),
    );
    this.register(
      this.undo.subscribe(() => {
        this.updateStatusBar();
        this.notifyStatus();
      }),
    );

    this.reportLoadResult(loaded);
    this.updateStatusBar();
    if (!this.discoveryLoadBlocked) {
      try {
        await this.discoveryApplication.reconcile();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        new Notice(`InterestSeed：发现应用状态调和失败——${message}`, 10_000);
      }
    }
    await this.refreshDiscoveries();

    this.app.workspace.onLayoutReady(() => {
      if (this.unloading) return;
      if (
        this.settings.autoBuildOnOpen &&
        !this.persistence.isBlocked &&
        this.store.isEmpty()
      ) {
        void this.rebuildGraph(true);
      }
    });
  }

  override onunload(): void {
    // best-effort：Obsidian 的 onunload 不能可靠等待异步完成，应用退出窗口仍可能存在。
    this.unloading = true;
    this.auditTasks.invalidate();
    this.auditRuntimeSession?.invalidate();
    this.auditRuntimeSession = null;
    this.auditVaultBinding?.invalidate();
    this.auditVaultBinding = null;
    // 先 detach，让 view.onClose 的 saveViewport 在 flush 前提交。
    this.app.workspace.detachLeavesOfType(INTERESTSEED_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(INTERESTSEED_AGENT_VIEW_TYPE);
    this.discoveryQueue?.close();
    void this.discoveryQueue?.flush();
    void this.persistence?.flush();
    this.persistence?.dispose();
  }

  // ------------------------------------------------------------ 视图

  async activateView(): Promise<void> {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(INTERESTSEED_VIEW_TYPE);
    let leaf: WorkspaceLeaf | null = existing[0] ?? null;

    if (!leaf) {
      leaf = workspace.getLeaf('tab');
      await leaf.setViewState({ type: INTERESTSEED_VIEW_TYPE, active: true });
    }

    await workspace.revealLeaf(leaf);
  }

  getActiveExperiment(): {
    node: InterestSeedNode;
    state: ExperimentState;
    day: number;
    gate: ReturnType<typeof canRecordToday>;
    summary: ReturnType<typeof experimentSummary>;
  } | null {
    const node = this.store
      .listNodes()
      .find((candidate) => candidate.metadata?.nextStep === true);
    if (!node) return null;
    const state =
      parseExperiment(node.metadata, node.title) ??
      createExperiment({ title: node.title, hypothesis: '这个兴趣值得我投入一周的真实注意力。' });
    return {
      node,
      state,
      day: Math.min(7, state.logs.length + 1),
      gate: canRecordToday(state),
      summary: experimentSummary(state),
    };
  }

  openExperiment(): void {
    new ExperimentModal(this.app, this).open();
  }

  recordExperimentCheckIn(input: ExperimentInput): boolean {
    const active = this.getActiveExperiment();
    if (!active) {
      new Notice('没有进行中的兴趣实验。');
      return false;
    }
    try {
      const state = recordExperimentLog(active.state, input);
      this.session.updateNode(
        active.node.id,
        {
          metadata: {
            ...active.node.metadata,
            experimentState: state,
            experimentDay: state.logs.length,
            experimentStatus: state.status,
            experimentLastCheckInAt: new Date().toISOString(),
          },
        },
        `兴趣实验：记录第 ${state.logs.length} 天`,
      );
      this.insightsCache = null;
      this.notifyStatus();
      void this.persist();
      new Notice(
        state.status === 'complete'
          ? '7 天实验完成。现在可以回看你的兴趣曲线。'
          : `第 ${state.logs.length} 天已记录。明天再来。`,
      );
      return true;
    } catch (error) {
      new Notice(error instanceof Error ? error.message : '实验记录失败。');
      return false;
    }
  }

  openGapCoach(insight: Insight): void {
    new GapCoachModal(this.app, this, insight).open();
  }

  captureGapSeed(insight: Insight, text: string): string | null {
    const value = text.trim();
    if (!value) return null;
    const now = new Date().toISOString();
    const id = nodeIdForUri(`interestseed://gap/${hashString(`${insight.id}:${value}`)}`);
    if (this.store.getNode(id)) return id;
    this.session.addNode(
      {
        id,
        type: 'topic',
        title: value.slice(0, 96),
        tags: ['缺口', '观察'],
        createdAt: now,
        updatedAt: now,
        metadata: {
          gapCoach: true,
          insightId: insight.id,
          insightTitle: insight.title,
          evidence: insight.detail,
        },
      },
      '兴趣缺口：种下一个观察',
    );
    const target = insight.nodeIds.find((nodeId) => this.store.getNode(nodeId));
    if (target) {
      this.session.addEdge(
        {
          id: edgeIdFor(target, id, '补充观察'),
          source: target,
          target: id,
          relation: '补充观察',
          origin: 'user',
          status: 'suggested',
          evidence: [`来自图谱缺口：${insight.title}`],
          createdAt: now,
          updatedAt: now,
        },
        '把观察接到缺口上',
      );
    }
    this.insightsCache = null;
    this.notifyStatus();
    void this.persist();
    this.setSelectedNode(id);
    return id;
  }

  openSparkCapture(): void {
    new SparkCaptureModal(this.app, this).open();
  }

  isVideoSpark(text: string): boolean {
    return /(youtube\.com|youtu\.be|bilibili\.com|douyin\.com|tiktok\.com|vimeo\.com)/i.test(
      text,
    );
  }

  describeSpark(text: string): string {
    const value = text.trim();
    if (!value) return '';
    const url = value.match(/https?:\/\/[^\s]+/i)?.[0];
    if (url) {
      try {
        const host = new URL(url).hostname.replace(/^www\./, '');
        const prefix = value.replace(url, '').trim();
        return (prefix || `视频火花 · ${host}`).slice(0, 96);
      } catch {
        return '视频火花';
      }
    }
    return value.slice(0, 96);
  }

  captureInterestSpark(text: string, targetId?: string, why?: string): string | null {
    const value = text.trim();
    const title = this.describeSpark(value);
    if (!title) {
      new Notice('先写下一句话，或粘贴一个链接。');
      return null;
    }
    const url = value.match(/https?:\/\/[^\s]+/i)?.[0];
    const id = nodeIdForUri(`interestseed://spark/${hashString(value.toLowerCase())}`);
    if (this.store.getNode(id)) {
      new Notice('这个火花已经在图谱里了。');
      return id;
    }
    const now = new Date().toISOString();
    const video = this.isVideoSpark(value);
    this.session.addNode(
      {
        id,
        type: video ? 'video' : 'topic',
        title,
        ...(url ? { sourceUri: url } : {}),
        tags: ['火花', video ? '视频' : '文本'],
        createdAt: now,
        updatedAt: now,
        metadata: {
          spark: true,
          raw: value,
          capturedAt: now,
          ...(why?.trim() ? { why: why.trim() } : {}),
        },
      },
      '种下一个兴趣火花',
    );
    if (targetId && this.store.getNode(targetId)) {
      this.session.addEdge(
        {
          id: edgeIdFor(targetId, id, '引出'),
          source: targetId,
          target: id,
          relation: '引出',
          origin: 'user',
          status: 'confirmed',
          evidence: ['来自你的火花捕获'],
          createdAt: now,
          updatedAt: now,
        },
        '把火花连接到已有兴趣',
      );
    }
    this.insightsCache = null;
    this.notifyStatus();
    void this.persist();
    this.setSelectedNode(id);
    return id;
  }

  openSeedSprint(): void {
    new SeedSprintModal(this.app, this).open();
  }

  applySeedSprint(
    draft: SeedSprintDraft,
    acceptedNodeIds: ReadonlySet<string>,
    acceptedEdgeIds: ReadonlySet<string>,
  ): number {
    const now = new Date().toISOString();
    const current = this.store.getGraph();
    const nodes = [...current.nodes];
    const edges = [...current.edges];
    const knownNodes = new Set(nodes.map((node) => node.id));
    const knownEdges = new Set(edges.map((edge) => edge.id));
    const idMap = new Map<string, string>();

    for (const proposal of draft.nodes) {
      if (!acceptedNodeIds.has(proposal.id)) continue;
      const id = nodeIdForUri(`interestseed://seed-sprint/${proposal.id}`);
      idMap.set(proposal.id, id);
      if (knownNodes.has(id)) continue;
      nodes.push({
        id,
        type: proposal.type,
        title: proposal.title,
        tags: [...proposal.tags],
        createdAt: now,
        updatedAt: now,
        metadata: {
          seedSprint: true,
          evidence: proposal.evidence,
          confidence: proposal.confidence,
          nextStep: proposal.nextStep === true,
          ...(proposal.nextStep
            ? {
                experimentDay: 0,
                experimentStartedAt: now,
                experimentStatus: 'active',
                experimentState: createExperiment({
                  title: proposal.title,
                  hypothesis: draft.experiment.hypothesis,
                  metric: draft.experiment.metric,
                  startedAt: now,
                }),
              }
            : {}),
        },
      });
      knownNodes.add(id);
    }

    for (const proposal of draft.edges) {
      if (!acceptedEdgeIds.has(proposal.id)) continue;
      const source = idMap.get(proposal.source);
      const target = idMap.get(proposal.target);
      if (!source || !target) continue;
      const id = edgeIdFor(source, target, proposal.relation);
      if (knownEdges.has(id)) continue;
      edges.push({
        id,
        source,
        target,
        relation: proposal.relation,
        origin: 'ai',
        status: 'confirmed',
        confidence: proposal.confidence,
        evidence: [proposal.evidence],
        createdAt: now,
        updatedAt: now,
      });
      knownEdges.add(id);
    }

    const added = nodes.length - current.nodes.length;
    if (added === 0) return 0;
    this.session.replace(
      {
        ...current,
        schemaVersion: current.schemaVersion,
        updatedAt: now,
        nodes,
        edges,
      },
      '兴趣起跑：种下第一张星图',
    );
    this.settings.seedSprintCompletedAt = now;
    void this.saveSettings();
    this.insightsCache = null;
    this.notifyStatus();
    void this.persist();
    return added;
  }

  async activateAgentView(): Promise<void> {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(INTERESTSEED_AGENT_VIEW_TYPE);
    let leaf: WorkspaceLeaf | null = existing[0] ?? null;
    if (!leaf) {
      leaf = workspace.getLeaf('tab');
      await leaf.setViewState({ type: INTERESTSEED_AGENT_VIEW_TYPE, active: true });
    }
    await workspace.revealLeaf(leaf);
  }

  setSelectedNode(nodeId: string | null): void {
    this.selectedId = nodeId;
    this.updateStatusBar();
  }

  getSelectedNodeId(): string | null {
    return this.selectedId;
  }

  getInsights(): GraphInsights {
    const graph = this.store.getGraph();
    if (!this.insightsCache || this.insightsCache.key !== graph.updatedAt) {
      this.insightsCache = {
        key: graph.updatedAt,
        value: this.insightEngine.analyze(graph),
      };
    }
    return this.insightsCache.value;
  }

  // ------------------------------------------------------------ 发现功能

  getDiscoveryLoadBlocked(): string | null {
    return this.discoveryLoadBlocked;
  }

  private getAuditVaultBinding(): AuditVaultBinding | null {
    return this.auditVaultBinding?.isActive ? this.auditVaultBinding : null;
  }

  private getAuditRuntimeSession(): AuditRuntimeSession | null {
    return this.auditRuntimeSession?.isActive ? this.auditRuntimeSession : null;
  }

  private getAuditRuntimeState(): AuditRuntimeState | null {
    const binding = this.getAuditVaultBinding();
    if (!binding || !this.discoveryQueue || !this.discoveryRepository.lastLoadResult) {
      return null;
    }
    const last = this.discoveryRepository.lastLoadResult;
    return {
      blocked: Boolean(this.discoveryLoadBlocked),
      issues: last.issues,
      queuePending: this.discoveryQueue.hasPending(),
      queueFailed: this.discoveryQueue.hasSaveFailed,
      queueClosed: this.discoveryQueue.isClosed,
      memoryMatchesPersisted:
        !this.discoveryQueue.hasPending() &&
        !this.discoveryQueue.hasSaveFailed &&
        !this.discoveryQueue.isClosed,
      sourceRegistered: true,
    };
  }

  private getDiscoveryAuditAdapter(): ObsidianDiscoveryAuditAdapter | null {
    const binding = this.getAuditVaultBinding();
    if (!binding) return null;
    return new ObsidianDiscoveryAuditAdapter(
      this.app,
      this.manifest.dir ?? '.obsidian/plugins/interestseed',
      binding,
    );
  }

  openDiscoveryOverview(): void {
    const overview = buildDiscoveryOverview(
      this.discoveryQueue.getState(),
      this.store.getGraph(),
    );
    new DiscoveryOverviewModal(this.app, overview).open();
  }

  openDiscoveryExplorer(): void {
    const file = this.discoveryQueue.getState();
    const overview = buildDiscoveryOverview(file, this.store.getGraph());
    const data = buildExploration(file);
    const claudianReady =
      this.settings.aiProvider !== 'claudian' || hasClaudianApi(this.app);
    const aiAvailable =
      this.settings.enableAI && this.settings.aiConsentGranted && claudianReady;
    const aiUnavailableReason = !this.settings.enableAI
      ? 'AI 未启用'
      : !this.settings.aiConsentGranted
        ? 'AI 未授权'
        : !claudianReady
          ? '未检测到 Claudian'
          : undefined;
    new DiscoveryExplorerModal(this.app, data, overview, {
      onThemeSelect: (theme) => {
        void this.showDiscoveriesForTheme(theme);
      },
      aiAvailable,
      aiUnavailableReason,
      onGenerateAi: (request) => this.generateExplorationInsight(request),
    }).open();
  }

  async showDiscoveriesForTheme(theme: string): Promise<void> {
    await this.activateView();
    const leaf = this.app.workspace.getLeavesOfType(INTERESTSEED_VIEW_TYPE)[0];
    const view = leaf?.view;
    if (view instanceof InterestSeedView) view.showDiscoveriesForTheme(theme);
  }

  private async generateExplorationInsight(
    request: ExplorationRequest,
  ): Promise<ExplorationInsight> {
    if (this.settings.aiProvider === 'claudian') {
      return exploreWithClaudian(this.app, request);
    }
    const provider = createModelProvider({
      enableAI: this.settings.enableAI,
      aiConsentGranted: this.settings.aiConsentGranted,
    });
    try {
      if (!provider.explore) {
        throw new Error('AI 尚未启用或未授权；请在设置中启用 AI 并确认隐私授权。');
      }
      const result = await provider.explore(request);
      return result as ExplorationInsight;
    } finally {
      provider.dispose();
    }
  }

  promptAudit(): void {
    const binding = this.getAuditVaultBinding();
    if (!binding) {
      new Notice('InterestSeed：当前 Vault 绑定不可用，无法审计。');
      return;
    }
    const projectKeys = [
      ...new Set(
        this.listDiscoveries()
          .flatMap((item) => item.projectKeys)
          .map((key) => key.trim())
          .filter(Boolean),
      ),
    ].sort();
    if (projectKeys.length === 0) {
      new Notice('InterestSeed：当前没有可审计的顶层项目范围。');
      return;
    }
    new DiscoveryAuditScopeModal(this.app, {
      binding,
      projectKeys,
      onConfirm: (scope) => {
        void this.runDiscoveryAudit(scope);
      },
    }).open();
  }

  private async runDiscoveryAudit(scope: DiscoveryAuditScope): Promise<void> {
    const token = this.auditTasks.begin();
    if (!token) {
      new Notice('InterestSeed：插件上下文已失效，无法审计。');
      return;
    }
    const binding = this.getAuditVaultBinding();
    const session = this.getAuditRuntimeSession();
    const adapter = this.getDiscoveryAuditAdapter();
    if (!binding || scope.binding !== binding || !session || !adapter) {
      this.auditTasks.cancel();
      new Notice('InterestSeed：Vault 绑定或数据完整性状态不可用，已取消审计。');
      return;
    }

    try {
      const source = await loadDiscoveryAuditSource(adapter, binding, session, {
        signal: token.signal,
      });
      if (!this.auditTasks.isCurrent(token)) return;
      if (!source.ok) {
        new Notice(`InterestSeed：${source.message}（${source.code}）`, 10_000);
        return;
      }
      const summary = buildDiscoveryAuditFromProjection(source.projection, scope);
      if (!this.auditTasks.isCurrent(token)) return;
      const text = formatDiscoveryAudit(summary);
      new DiscoveryAuditPreviewModal(this.app, {
        text,
        onSave: () => {
          if (!this.auditTasks.isCurrent(token)) {
            new Notice('InterestSeed：审计任务已失效，未保存报告。', 8000);
            return;
          }
          this.openAuditSaveDialog(text, token);
        },
        onClose: () => this.auditTasks.cancel(),
      }).open();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      new Notice(`InterestSeed：审计失败——${message}`, 10_000);
    } finally {
      this.auditTasks.finish(token);
    }
  }

  private openAuditSaveDialog(text: string, token: AuditTaskToken): void {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    new DiscoveryAuditSaveModal(this.app, {
      text,
      defaultName: `InterestSeed-audit-${stamp}.md`,
      canSave: () => this.auditTasks.isCurrent(token),
      onSaved: () => {
        new Notice('InterestSeed：聚合审计报告已保存。', 6000);
      },
    }).open();
  }

  async reconcileDiscoveries(): Promise<void> {
    await this.discoveryApplication.reconcile();
    await this.refreshDiscoveries();
    new Notice('InterestSeed：发现应用状态已按当前图谱核对。');
  }

  listDiscoveries(): Discovery[] {
    return sortDiscoveries((this.discoveryQueue?.getState() ?? this.discoveryFile)?.discoveries ?? []);
  }

  async refreshDiscoveries(): Promise<void> {
    if (this.discoveryLoadBlocked) {
      new Notice(`InterestSeed：${this.discoveryLoadBlocked}`, 8000);
      return;
    }
    try {
      await this.discoveryQueue.enqueue((state) => {
        // 在队列任务内部基于最新状态重算，避免反馈/其他保存刚写入后被旧快照覆盖。
        const next = new DiscoveryEngine().generate(this.store.getGraph(), state);
        return hasDiscoveryContentChanged(state, next) ? next : state;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      new Notice(`InterestSeed：发现数据保存失败——${message}`, 10_000);
    }
  }

  async setDiscoveryFeedback(
    id: string,
    action: DiscoveryFeedbackAction,
    correction?: DiscoveryCorrection,
  ): Promise<void> {
    if (this.discoveryLoadBlocked) {
      new Notice(`InterestSeed：${this.discoveryLoadBlocked}`, 8000);
      return;
    }
    const current = this.discoveryQueue.getState();
    const discovery = current.discoveries.find((item) => item.id === id);
    if (!discovery) {
      new Notice('这条发现已不存在，无法操作。');
      return;
    }

    try {
      await this.discoveryQueue.enqueue((state) =>
        applyDiscoveryFeedback(state, id, action, undefined, correction),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      new Notice(`InterestSeed：反馈保存失败——${message}`, 10_000);
    }
  }

  async undoDiscoveryFeedback(id: string): Promise<void> {
    if (this.discoveryLoadBlocked) {
      new Notice(`InterestSeed：${this.discoveryLoadBlocked}`, 8000);
      return;
    }
    try {
      await this.discoveryQueue.enqueue((state) =>
        undoDiscoveryFeedback(state, id),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      new Notice(`InterestSeed：撤销反馈失败——${message}`, 10_000);
    }
  }

  subscribeDiscoveries(listener: () => void): () => void {
    this.discoveryListeners.add(listener);
    return () => {
      this.discoveryListeners.delete(listener);
    };
  }

  getDiscoveryApplicationPreview(
    id: string,
    draft: DiscoveryApplicationDraft,
  ): DiscoveryApplicationPreview {
    return this.discoveryApplication.preview(id, draft);
  }

  async applyDiscovery(
    id: string,
    draft: DiscoveryApplicationDraft,
  ): Promise<DiscoveryApplicationResult> {
    return this.discoveryApplication.apply(id, draft);
  }

  private notifyDiscoveryListeners(): void {
    notifyDiscoveryListenersSafely(this.discoveryListeners);
  }

  // ------------------------------------------------------------ 图操作委托

  rebuildGraph(silent = false): Promise<void> {
    return this.controller.rebuildGraph(silent);
  }

  refreshSuggestions(): void {
    this.controller.refreshSuggestions();
  }

  promptCreateNode(): void {
    new NodeCreateModal(this.app, (title, type) => {
      this.controller.createNode(title, type);
    }).open();
  }

  createFromActiveFile(): void {
    this.controller.createFromActiveFile();
  }

  confirmEdge(edgeId: string): boolean {
    return this.controller.confirmEdge(edgeId);
  }

  rejectEdge(edgeId: string): boolean {
    return this.controller.rejectEdge(edgeId);
  }

  restoreEdge(edgeId: string): boolean {
    return this.controller.restoreEdge(edgeId);
  }

  deleteNode(nodeId: string): void {
    this.controller.deleteNode(nodeId);
  }

  expandWithAI(nodeId?: string): Promise<void> {
    return this.controller.expandWithAI(nodeId);
  }

  openSource(uri: string): Promise<void> {
    return this.controller.openSource(uri);
  }

  saveViewport(viewport: GraphViewport): void {
    this.controller.saveViewport(viewport);
  }

  exportGraph(): void {
    this.controller.exportGraph();
  }

  clearGraph(): Promise<void> {
    return this.controller.clearGraph();
  }

  retrySave(): Promise<void> {
    return this.controller.retrySave();
  }

  repairGraphStorage(): Promise<void> {
    return this.controller.repairGraphStorage();
  }

  createBackup(): Promise<void> {
    return this.controller.createBackup();
  }

  // ------------------------------------------------------------ 设置与持久化

  async saveSettings(): Promise<void> {
    await this.persist();
  }

  // ------------------------------------------------------------ 内部实现

  private async persist(): Promise<void> {
    try {
      await this.saveData({
        schemaVersion: DATA_SCHEMA_VERSION,
        settings: this.settings,
        lastRebuiltAt: this.settingsLastRebuiltAt,
      });
    } catch (error) {
      console.error('[InterestSeed] 保存设置失败', error);
      new Notice(
        `InterestSeed：设置保存失败。${error instanceof Error ? error.message : String(error)}`,
        10_000,
      );
    }
  }

  private reportLoadResult(result: LoadResult): void {
    if (result.issues.length > 0) {
      console.warn(`[InterestSeed] 图谱数据问题：\n${result.issues.join('\n')}`);
    }
    if (result.appliedMigrations.length > 0) {
      console.warn(`[InterestSeed] 已迁移图谱数据：\n${result.appliedMigrations.join('\n')}`);
    }
    if (result.preMigrationBackupKey) {
      console.warn(`[InterestSeed] 迁移前旧数据已备份：${result.preMigrationBackupKey}`);
    }
    if (result.corruptedBackupKey) {
      console.warn(`[InterestSeed] 原始数据已备份：${result.corruptedBackupKey}`);
    }
    if (result.issuesBackupKey) {
      console.warn(`[InterestSeed] 清洗前图谱已备份：${result.issuesBackupKey}`);
    }
    if (result.issues.length > 0 && !result.blocked) {
      new Notice(
        `InterestSeed：图谱加载时清洗了 ${result.issues.length} 条问题记录；原始文件已备份到插件目录。`,
        10_000,
      );
    }

    if (result.blocked) {
      new Notice(
        `InterestSeed：${result.blockedReason ?? '图谱存储已暂停'}。请在命令面板运行“备份旧数据并重置图谱存储”。`,
        15_000,
      );
    } else if (result.source === 'recovered') {
      new Notice(
        'InterestSeed：图谱主文件损坏，已从备份恢复；原主文件已备份在插件目录。',
        10_000,
      );
    }
  }

  private async loadState(): Promise<void> {
    const stored = (await this.loadData()) as StoredPluginData | null;
    const record = isRecord(stored) ? stored : {};

    const dataVersion = typeof record.schemaVersion === 'number' ? record.schemaVersion : 0;
    if (dataVersion > DATA_SCHEMA_VERSION) {
      console.warn(
        `[InterestSeed] data.json 版本 ${dataVersion} 高于插件支持的 ${DATA_SCHEMA_VERSION}，已按默认值加载。`,
      );
    }

    this.settings = normalizeSettings(record.settings);

    const lastRebuilt = record.lastRebuiltAt;
    if (typeof lastRebuilt === 'string' && !Number.isNaN(Date.parse(lastRebuilt))) {
      this.settingsLastRebuiltAt = new Date(lastRebuilt).toISOString();
    } else if (typeof lastRebuilt === 'number') {
      this.settingsLastRebuiltAt = new Date(lastRebuilt).toISOString();
    }
  }

  getStatus(): InterestSeedStatus {
    const stats = this.store.stats();
    const state = this.persistence?.state;
    return {
      scanning: this.scanning,
      lastError: this.lastError,
      blocked: state?.blocked ?? false,
      blockedReason: state?.blockedReason ?? null,
      saveFailed: state?.saveFailed ?? false,
      nodes: stats.nodes,
      edges: stats.edges,
      confirmed: stats.confirmed,
      suggested: stats.suggested,
    };
  }

  subscribeStatus(listener: (status: InterestSeedStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  /** 重新扫描前展示范围、预计读取数量与操作说明。 */
  promptRebuild(): void {
    const options = {
      includeFolders: this.settings.includeFolders,
      excludeFolders: this.settings.excludeFolders,
      includeTags: this.settings.includeTags,
      maxFiles: 5000,
    };

    new ScanConfirmModal(
      this.app,
      {
        count: this.vaultAdapter.countMarkdown(options),
        includeFolders: this.settings.includeFolders,
        excludeFolders: this.settings.excludeFolders,
        includeTags: this.settings.includeTags,
      },
      () => {
        void this.controller.rebuildGraph();
      },
    ).open();
  }

  promptCreateRelation(sourceId: string): void {
    const source = this.store.getNode(sourceId);
    if (!source) return;

    const targets = this.store.listNodes().filter((node) => node.id !== sourceId);
    if (targets.length === 0) {
      new Notice('图谱里还没有其他节点，先创建或扫描一个节点再来连边。');
      return;
    }

    new RelationCreateModal(this.app, source, targets, ({ targetId, relation }) => {
      this.controller.createRelation(sourceId, targetId, relation);
    }).open();
  }

  createRelation(sourceId: string, targetId: string, relation: string): void {
    this.controller.createRelation(sourceId, targetId, relation);
  }

  promptEditRelation(edgeId: string): void {
    const edge = this.store.getEdge(edgeId);
    if (!edge) return;
    new RelationEditModal(this.app, edge.relation, (relation) => {
      this.controller.editRelation(edgeId, relation);
    }).open();
  }

  editRelation(edgeId: string, relation: string): void {
    this.controller.editRelation(edgeId, relation);
  }

  deleteEdge(edgeId: string): void {
    this.controller.deleteEdge(edgeId);
  }

  /** 拖动结束后的布局持久化：只更新 position 元数据，不进入撤销历史。 */
  saveNodePosition(nodeId: string, position: { x: number; y: number }): void {
    const node = this.store.getNode(nodeId);
    if (!node) return;

    this.store.updateNode(nodeId, {
      metadata: { ...node.metadata, position },
    });
    this.persistence.scheduleSave();
  }

  private setScanning(scanning: boolean): void {
    this.scanning = scanning;
    this.updateStatusBar();
    this.notifyStatus();
  }

  private openAiSuggestions(suggestions: AiRelationSuggestion[]): void {
    new AiSuggestionModal(this.app, suggestions, {
      getNodeTitle: (id) => this.store.getNode(id)?.title ?? null,
      confirm: (suggestion) => this.controller.confirmAiSuggestion(suggestion),
    }).open();
  }

  private reportError(message: string | null): void {
    this.lastError = message;
    this.updateStatusBar();
    this.notifyStatus();
  }

  private handlePersistenceState(state: PersistenceState): void {
    if (!state.saveFailed && this.lastError?.startsWith('保存图谱失败')) {
      this.lastError = null;
    }
    this.updateStatusBar();
    this.notifyStatus();
  }

  private notifyStatus(): void {
    const status = this.getStatus();
    for (const listener of [...this.statusListeners]) {
      try {
        listener(status);
      } catch (error) {
        console.error('[InterestSeed] 状态监听器执行失败', error);
      }
    }
  }

  private updateStatusBar(): void {
    if (!this.statusBarEl) return;

    const stats = this.store.stats();
    const state = this.persistence?.state;
    const suffix = state?.blocked
      ? ' · ⚠ 存储已暂停'
      : state?.saveFailed
        ? ' · ⚠ 未保存'
        : this.lastError
          ? ' · ⚠ 错误'
          : '';

    this.statusBarEl.setText(
      `InterestSeed · ${stats.nodes} 节点 / ${stats.confirmed} 已确认 / ${stats.suggested} 建议${suffix}`,
    );
    this.statusBarEl.setAttribute('aria-label', '打开兴趣图谱');
    const tooltip = state?.blockedReason ?? this.lastError ?? null;
    if (tooltip) {
      this.statusBarEl.setAttribute('title', tooltip);
    } else {
      this.statusBarEl.removeAttribute('title');
    }
  }
}
