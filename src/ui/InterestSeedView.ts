import { ItemView, Notice, setIcon } from 'obsidian';
import type { WorkspaceLeaf } from 'obsidian';
import type InterestSeedPlugin from '../main';
import type { InterestSeedStatus } from '../main';
import type { GraphViewport } from '../types/graph';
import { DetailPanel } from './DetailPanel';
import { EmptyState } from './EmptyState';
import {
  createDefaultFilter,
  FilterBar,
  filterGraph,
  isEmptyFilter,
  matchesNode,
  type GraphFilter,
} from './FilterBar';
import { CosmicGraphCanvas } from './CosmicGraphCanvas';
import { DiscoveryApplyModal } from './DiscoveryApplyModal';
import { DiscoveryCorrectionModal } from './DiscoveryCorrectionModal';
import { DiscoveryPanel } from './DiscoveryPanel';
import {
  getDiscoveryThemeKeys,
  UNCATEGORIZED_THEME,
} from '../discovery/exploration';

export const INTERESTSEED_VIEW_TYPE = 'interestseed-graph-view';

/**
 * 图谱视图：把 FilterBar、GraphCanvas、DetailPanel、EmptyState 组装起来。
 * 视图不直接修改数据，所有写操作都回调到插件，保证撤销 / 持久化统一。
 */
export class InterestSeedView extends ItemView {
  private canvas: CosmicGraphCanvas | null = null;
  private filterBar: FilterBar | null = null;
  private detail: DetailPanel | null = null;
  private emptyState: EmptyState | null = null;
  private discoveryPanel: DiscoveryPanel | null = null;

  private canvasHost: HTMLElement | null = null;
  private detailHost: HTMLElement | null = null;
  private detailContentHost: HTMLElement | null = null;
  private discoveryHost: HTMLElement | null = null;
  private countEl: HTMLElement | null = null;
  private nextStepEl: HTMLElement | null = null;
  private nextStepLabelEl: HTMLElement | null = null;
  private nextStepTitleEl: HTMLElement | null = null;
  private nextStepDetailEl: HTMLElement | null = null;
  private nextStepButton: HTMLButtonElement | null = null;
  private clusterRailEl: HTMLElement | null = null;
  private clusterFocus: string | null = null;
  private clusterInitialized = false;
  private footerScanEl: HTMLElement | null = null;
  private footerSaveEl: HTMLElement | null = null;
  private footerErrorEl: HTMLElement | null = null;
  private totalNodes = 0;
  private totalEdges = 0;
  private visibleNodes = 0;
  private visibleEdges = 0;

  private undoButton: HTMLButtonElement | null = null;
  private redoButton: HTMLButtonElement | null = null;
  private inboxButton: HTMLButtonElement | null = null;
  private inboxOpen = false;
  private discoveryButton: HTMLButtonElement | null = null;
  private discoveryOpen = false;
  private discoveryThemeFilter: string | null = null;
  private quickUndoButton: HTMLButtonElement | null = null;
  private quickRedoButton: HTMLButtonElement | null = null;
  private quickInboxButton: HTMLButtonElement | null = null;
  private quickShareInboxButton: HTMLButtonElement | null = null;
  private shareInboxBadgeEl: HTMLElement | null = null;
  private quickDiscoveryButton: HTMLButtonElement | null = null;

  private filter: GraphFilter = createDefaultFilter();
  private selectedId: string | null = null;
  private refreshHandle: number | null = null;
  private viewportApplied = false;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: InterestSeedPlugin,
  ) {
    super(leaf);
  }

  override getViewType(): string {
    return INTERESTSEED_VIEW_TYPE;
  }

  override getDisplayText(): string {
    return '兴趣图谱';
  }

  override getIcon(): string {
    return 'sprout';
  }

  override async onOpen(): Promise<void> {
    const root = this.contentEl;
    root.empty();
    root.addClass('interestseed-root');
    root.addClass('is-cosmic');

    const header = root.createDiv({ cls: 'interestseed-header' });
    const heading = header.createDiv({ cls: 'interestseed-heading' });
    const icon = heading.createDiv({ cls: 'interestseed-heading-icon' });
    setIcon(icon, 'sprout');
    heading.createEl('h2', { cls: 'interestseed-heading-title', text: '兴趣图谱' });
    heading.createSpan({
      cls: 'interestseed-heading-vault',
      text: this.app.vault.getName(),
    });
    this.countEl = heading.createSpan({ cls: 'interestseed-heading-count', text: '' });
    heading.createDiv({
      cls: 'interestseed-heading-subtitle',
      text: '把零散笔记连接成可行动的兴趣结构',
    });

    const agentCta = header.createEl('button', {
      cls: 'interestseed-header-cta',
      attr: { type: 'button', 'aria-label': '打开 InterestSeed Agent' },
    });
    setIcon(agentCta, 'sparkles');
    agentCta.createSpan({ text: 'Agent' });
    agentCta.addEventListener('click', () => {
      void this.plugin.activateAgentView();
    });

    const actions = header.createDiv({ cls: 'interestseed-header-actions' });
    this.createAction(actions, 'refresh-cw', '重新扫描', () => {
      this.plugin.promptRebuild();
    });
    this.createAction(actions, 'plus', '新建节点', () => this.plugin.promptCreateNode());
    this.createAction(actions, 'sparkles', '记录兴趣火花', () => this.plugin.openSparkCapture());
    this.createAction(actions, 'archive', '分享收件箱', () => this.plugin.openInbox());
    this.createAction(actions, 'git-fork', '刷新规则建议', () => {
      this.plugin.refreshSuggestions();
    });
    this.inboxButton = this.createAction(actions, 'inbox', '建议收件箱', () => {
      this.toggleInbox();
    });
    this.undoButton = this.createAction(actions, 'undo-2', '撤销图谱操作', () => {
      this.plugin.undo.undo();
    });
    this.redoButton = this.createAction(actions, 'redo-2', '重做图谱操作', () => {
      this.plugin.undo.redo();
    });
    this.createAction(actions, 'maximize-2', '适应画布', () => this.canvas?.zoomToFit());
    this.createAction(actions, 'download', '导出图谱 JSON', () => {
      this.plugin.exportGraph();
    });
    this.createAction(actions, 'share-2', '导出分享星图', () => {
      this.plugin.openShareCard();
    });
    this.discoveryButton = this.createAction(actions, 'lightbulb', '发现', () => {
      this.toggleDiscoveries();
    });
    this.createAction(actions, 'layout-dashboard', '兴趣总览', () => {
      this.plugin.openDiscoveryOverview();
    });

    const nextStep = root.createDiv({ cls: 'interestseed-next-step is-hidden' });
    this.nextStepEl = nextStep;
    const nextMark = nextStep.createDiv({ cls: 'interestseed-next-step-mark' });
    setIcon(nextMark, 'arrow-up-right');
    const nextCopy = nextStep.createDiv({ cls: 'interestseed-next-step-copy' });
    this.nextStepLabelEl = nextCopy.createDiv({ cls: 'interestseed-next-step-label', text: 'NEXT' });
    this.nextStepTitleEl = nextCopy.createDiv({ cls: 'interestseed-next-step-title', text: '' });
    this.nextStepDetailEl = nextCopy.createDiv({ cls: 'interestseed-next-step-detail', text: '' });
    this.nextStepButton = nextStep.createEl('button', {
      cls: 'interestseed-next-step-button',
      text: '',
      attr: { type: 'button' },
    });

    this.clusterRailEl = root.createDiv({ cls: 'interestseed-cluster-rail is-hidden' });

    if (!this.plugin.settings.seedSprintCompletedAt) {
      const sprintBanner = root.createDiv({ cls: 'interestseed-sprint-banner' });
      const sprintMark = sprintBanner.createDiv({ cls: 'interestseed-sprint-banner-mark' });
      setIcon(sprintMark, 'sparkles');
      const sprintCopy = sprintBanner.createDiv({ cls: 'interestseed-sprint-banner-copy' });
      sprintCopy.createDiv({
        cls: 'interestseed-sprint-banner-kicker',
        text: 'FIRST CONSTELLATION',
      });
      sprintCopy.createDiv({
        cls: 'interestseed-sprint-banner-title',
        text: '你的兴趣，还没有连成一张地图。',
      });
      sprintCopy.createDiv({
        cls: 'interestseed-sprint-banner-detail',
        text: '做 4 个选择，用 3 分钟长出第一张会生长的兴趣星图。',
      });
      const sprintButton = sprintBanner.createEl('button', {
        cls: 'mod-cta interestseed-sprint-banner-button',
        text: '开始建图',
        attr: { type: 'button' },
      });
      sprintButton.addEventListener('click', () => this.plugin.openSeedSprint());
    }
    const experiment = this.plugin.getActiveExperiment();
    if (experiment) {
      root.addClass('has-experiment');
      const strip = root.createDiv({ cls: 'interestseed-experiment-strip' });
      const stripIcon = strip.createDiv({ cls: 'interestseed-experiment-strip-icon' });
      setIcon(stripIcon, 'flask-conical');
      const stripCopy = strip.createDiv({ cls: 'interestseed-experiment-strip-copy' });
      stripCopy.createDiv({
        cls: 'interestseed-experiment-strip-kicker',
        text:
          experiment.state.status === 'complete'
            ? 'EXPERIMENT COMPLETE · REVIEW'
            : `INTEREST EXPERIMENT · DAY ${experiment.day} / ${experiment.state.targetDays}`,
      });
      stripCopy.createDiv({
        cls: 'interestseed-experiment-strip-title',
        text: experiment.state.title,
      });
      const dots = stripCopy.createDiv({ cls: 'interestseed-experiment-dots' });
      for (let day = 1; day <= experiment.state.targetDays; day += 1) {
        const dot = dots.createSpan({ cls: 'interestseed-experiment-dot' });
        if (day <= experiment.state.logs.length) dot.addClass('is-done');
        if (day === experiment.gate.day && experiment.state.status !== 'complete') {
          dot.addClass('is-today');
        }
      }
      const open = strip.createEl('button', {
        cls: 'interestseed-experiment-advance',
        text:
          experiment.state.status === 'complete'
            ? '查看复盘'
            : experiment.gate.ok
              ? '记录今天'
              : '今日已记录',
        attr: { type: 'button' },
      });
      open.disabled = !experiment.gate.ok && experiment.state.status !== 'complete';
      open.addEventListener('click', () => this.plugin.openExperiment());
    }

    const launchpad = root.createDiv({ cls: 'interestseed-launchpad' });
    this.createLaunchCard(
      launchpad,
      'sparkles',
      'Agent',
      '连接自己的 Agent，执行任务',
      'is-primary',
      () => void this.plugin.activateAgentView(),
    );
    this.createLaunchCard(
      launchpad,
      'compass',
      '兴趣探索',
      '主题、项目矩阵与趋势',
      '',
      () => this.plugin.openDiscoveryExplorer(),
    );
    this.createLaunchCard(
      launchpad,
      'lightbulb',
      '发现',
      '处理建议、反馈与应用',
      '',
      () => this.toggleDiscoveries(),
    );
    this.createLaunchCard(
      launchpad,
      'layout-dashboard',
      '总览',
      '回看整体结构与节奏',
      '',
      () => this.plugin.openDiscoveryOverview(),
    );

    const quickbar = root.createDiv({ cls: 'interestseed-quickbar' });
    const recordAction = this.createQuickAction(quickbar, 'sparkles', '记录', () =>
      this.plugin.openSparkCapture(),
    );
    recordAction.addClass('is-primary');
    this.quickShareInboxButton = this.createQuickAction(quickbar, 'archive', '收件箱', () =>
      this.plugin.openInbox(),
    );
    this.shareInboxBadgeEl = this.quickShareInboxButton.createSpan({
      cls: 'interestseed-quick-badge is-hidden',
      text: '0',
    });
    const filterToggle = this.createQuickAction(quickbar, 'filter', '筛选', () => {
      root.classList.toggle('is-filter-open');
      filterToggle.setAttribute(
        'aria-pressed',
        root.classList.contains('is-filter-open') ? 'true' : 'false',
      );
      window.setTimeout(() => this.canvas?.zoomToFit(), 50);
    });
    filterToggle.setAttribute('aria-pressed', 'false');
    filterToggle.addClass('is-filter-toggle');

    const more = quickbar.createEl('details', { cls: 'interestseed-more' });
    const moreSummary = more.createEl('summary', {
      cls: 'interestseed-quick-action',
      attr: { 'aria-label': '更多操作', title: '更多操作' },
    });
    setIcon(moreSummary, 'more-horizontal');
    moreSummary.createSpan({ text: '更多' });
    const moreMenu = more.createDiv({ cls: 'interestseed-more-menu' });
    this.createQuickAction(moreMenu, 'refresh-cw', '重新扫描', () => this.plugin.promptRebuild());
    this.createQuickAction(moreMenu, 'plus', '新建节点', () => this.plugin.promptCreateNode());
    this.createQuickAction(moreMenu, 'git-fork', '刷新建议', () => this.plugin.refreshSuggestions());
    this.quickInboxButton = this.createQuickAction(moreMenu, 'inbox', '待确认关系', () =>
      this.toggleInbox(),
    );
    this.quickUndoButton = this.createQuickAction(moreMenu, 'undo-2', '撤销', () =>
      this.plugin.undo.undo(),
    );
    this.quickRedoButton = this.createQuickAction(moreMenu, 'redo-2', '重做', () =>
      this.plugin.undo.redo(),
    );
    this.createQuickAction(moreMenu, 'maximize-2', '适应画布', () => this.canvas?.zoomToFit());
    this.quickDiscoveryButton = this.createQuickAction(moreMenu, 'lightbulb', '发现', () =>
      this.toggleDiscoveries(),
    );
    this.quickDiscoveryButton.setAttribute('aria-pressed', 'false');
    this.quickInboxButton?.setAttribute('aria-pressed', 'false');
    this.discoveryButton?.setAttribute('aria-pressed', 'false');
    this.inboxButton?.setAttribute('aria-pressed', 'false');
    this.createQuickAction(moreMenu, 'layout-dashboard', '兴趣总览', () =>
      this.plugin.openDiscoveryOverview(),
    );
    this.createQuickAction(moreMenu, 'compass', '兴趣探索', () =>
      this.plugin.openDiscoveryExplorer(),
    );
    this.createQuickAction(moreMenu, 'download', '导出 JSON', () => this.plugin.exportGraph());
    this.createQuickAction(moreMenu, 'share-2', '导出分享星图', () =>
      this.plugin.openShareCard(),
    );

    const filterHost = root.createDiv({ cls: 'interestseed-filter-host' });
    this.filterBar = new FilterBar(filterHost, (filter) => {
      this.filter = filter;
      this.refresh();
    });

    const body = root.createDiv({ cls: 'interestseed-body' });
    body.style.setProperty('background', '#05070d', 'important');
    const canvasHost = body.createDiv({ cls: 'interestseed-canvas-container' });
    this.canvasHost = canvasHost;
    const detailHost = body.createDiv({ cls: 'interestseed-detail' });
    detailHost.style.setProperty('background', 'linear-gradient(180deg, #0d1320 0%, #080c15 100%)', 'important');
    detailHost.style.setProperty('color', '#f2efe9', 'important');
    this.detailHost = detailHost;
    this.detailContentHost = detailHost.createDiv({ cls: 'interestseed-detail-content' });
    this.detailContentHost.style.setProperty('background', 'transparent', 'important');
    this.discoveryHost = detailHost.createDiv({
      cls: 'interestseed-discovery-panel is-hidden',
    });

    const footer = root.createDiv({ cls: 'interestseed-footer' });
    this.footerScanEl = footer.createSpan({ cls: 'interestseed-footer-item' });
    this.footerSaveEl = footer.createSpan({ cls: 'interestseed-footer-item' });
    this.footerErrorEl = footer.createSpan({ cls: 'interestseed-footer-error' });

    this.emptyState = new EmptyState(canvasHost);

    this.canvas = new CosmicGraphCanvas(canvasHost, {
      onSelect: (nodeId) => this.select(nodeId),
      onDoubleClick: (nodeId) => {
        this.select(nodeId);
        const node = this.plugin.store.getNode(nodeId);
        if (node?.sourceUri) void this.plugin.openSource(node.sourceUri);
      },
      onViewportChange: (viewport: GraphViewport) => {
        this.plugin.saveViewport(viewport);
      },
      onNodeMoved: (nodeId, position) => {
        this.plugin.saveNodePosition(nodeId, position);
      },
    });

    this.detail = new DetailPanel(this.app, this.detailContentHost, this.plugin.store, {
      openSource: (uri) => {
        void this.plugin.openSource(uri);
      },
      selectNode: (nodeId) => this.select(nodeId),
      deleteNode: (nodeId) => this.plugin.deleteNode(nodeId),
      confirmEdge: (edgeId) => this.plugin.confirmEdge(edgeId),
      rejectEdge: (edgeId) => this.plugin.rejectEdge(edgeId),
      restoreEdge: (edgeId) => this.plugin.restoreEdge(edgeId),
      editRelation: (edgeId) => this.plugin.promptEditRelation(edgeId),
      deleteEdge: (edgeId) => this.plugin.deleteEdge(edgeId),
      createRelation: (sourceId) => this.plugin.promptCreateRelation(sourceId),
      expandWithAI: (nodeId) => {
        void this.plugin.expandWithAI(nodeId);
      },
      openGapCoach: (insight) => this.plugin.openGapCoach(insight),
    });

    this.discoveryPanel = new DiscoveryPanel(this.discoveryHost, {
      nodeTitle: (nodeId) => this.plugin.store.getNode(nodeId)?.title ?? nodeId,
      sourceUri: (nodeId) => this.plugin.store.getNode(nodeId)?.sourceUri,
      edgeSummary: (edgeId) => {
        const edge = this.plugin.store.getEdge(edgeId);
        if (!edge) return undefined;
        const source = this.plugin.store.getNode(edge.source)?.title ?? edge.source;
        const target = this.plugin.store.getNode(edge.target)?.title ?? edge.target;
        return `${source} → ${target}（${edge.relation}）`;
      },
      onAccept: (id) => {
        void this.plugin
          .setDiscoveryFeedback(id, 'accepted')
          .finally(() => this.scheduleRefresh());
      },
      onReject: (id) => {
        void this.plugin
          .setDiscoveryFeedback(id, 'rejected')
          .finally(() => this.scheduleRefresh());
      },
      onCorrect: (id) => {
        const discovery = this.plugin.listDiscoveries().find((item) => item.id === id);
        if (!discovery) return;
        const modal = new DiscoveryCorrectionModal(
          this.app,
          discovery.title,
          discovery.description,
          {
            onSubmit: async (correction) => {
              await this.plugin.setDiscoveryFeedback(id, 'corrected', correction);
              this.scheduleRefresh();
            },
          },
        );
        modal.open();
      },
      onLowValue: (id) => {
        void this.plugin
          .setDiscoveryFeedback(id, 'low-value')
          .finally(() => this.scheduleRefresh());
      },
      onUndo: (id) => {
        void this.plugin
          .undoDiscoveryFeedback(id)
          .finally(() => this.scheduleRefresh());
      },
      onNeedsVerification: (id) => {
        void this.plugin
          .setDiscoveryFeedback(id, 'needs-verification')
          .finally(() => this.scheduleRefresh());
      },
      onApply: (id) => {
        const discovery = this.plugin.listDiscoveries().find((item) => item.id === id);
        if (!discovery) return;
        const modal = new DiscoveryApplyModal(this.app, discovery, {
          nodes: this.plugin.store.listNodes(),
          preview: (draft) =>
            this.plugin.getDiscoveryApplicationPreview(id, draft),
          apply: (draft) => this.plugin.applyDiscovery(id, draft),
          onFinished: () => {
            void this.plugin.refreshDiscoveries();
            this.scheduleRefresh();
          },
        });
        modal.open();
      },
      onOpenEdge: (edgeId) => {
        const edge = this.plugin.store.getEdge(edgeId);
        if (!edge) {
          new Notice('该关系已不存在。');
          return;
        }
        this.plugin.setSelectedNode(edge.source);
        new Notice(`关系：${edge.source} → ${edge.target}（${edge.relation}）`, 5000);
      },
      onRefresh: () => {
        void this.plugin.refreshDiscoveries().finally(() => this.scheduleRefresh());
      },
    });

    this.register(this.plugin.store.subscribe(() => this.scheduleRefresh()));
    this.register(this.plugin.subscribeDiscoveries(() => this.scheduleRefresh()));
    this.register(this.plugin.undo.subscribe(() => this.updateUndoButtons()));
    this.register(
      this.plugin.subscribeStatus((status) => this.renderFooter(status)),
    );

    this.refresh();
    this.renderFooter(this.plugin.getStatus());
  }

  override async onClose(): Promise<void> {
    if (this.refreshHandle !== null) window.cancelAnimationFrame(this.refreshHandle);
    this.refreshHandle = null;

    if (this.canvas) {
      this.plugin.saveViewport(this.canvas.getViewport());
      this.canvas.destroy();
      this.canvas = null;
    }

    this.detail?.destroy();
    this.detail = null;
    this.filterBar?.destroy();
    this.filterBar = null;
    this.emptyState?.destroy();
    this.emptyState = null;

    await super.onClose();
  }

  focusSelectedNode(): void {
    if (this.selectedId) this.canvas?.focusNode(this.selectedId);
  }

  private toggleInbox(): void {
    this.inboxOpen = !this.inboxOpen;
    this.inboxButton?.toggleClass('is-active', this.inboxOpen);
    this.quickInboxButton?.toggleClass('is-active', this.inboxOpen);
    this.inboxButton?.setAttribute('aria-pressed', String(this.inboxOpen));
    this.quickInboxButton?.setAttribute('aria-pressed', String(this.inboxOpen));

    if (this.inboxOpen) {
      this.discoveryOpen = false;
      this.discoveryButton?.removeClass('is-active');
      this.quickDiscoveryButton?.removeClass('is-active');
      this.discoveryButton?.setAttribute('aria-pressed', 'false');
      this.quickDiscoveryButton?.setAttribute('aria-pressed', 'false');
      this.selectedId = null;
      this.plugin.setSelectedNode(null);
      this.canvas?.setSelected(null);
    }

    this.refresh();
  }

  private toggleDiscoveries(): void {
    if (!this.discoveryOpen) this.discoveryThemeFilter = null;
    this.discoveryOpen = !this.discoveryOpen;
    this.discoveryButton?.toggleClass('is-active', this.discoveryOpen);
    this.quickDiscoveryButton?.toggleClass('is-active', this.discoveryOpen);
    this.discoveryButton?.setAttribute('aria-pressed', String(this.discoveryOpen));
    this.quickDiscoveryButton?.setAttribute('aria-pressed', String(this.discoveryOpen));

    if (this.discoveryOpen) {
      this.inboxOpen = false;
      this.inboxButton?.removeClass('is-active');
      this.quickInboxButton?.removeClass('is-active');
      this.inboxButton?.setAttribute('aria-pressed', 'false');
      this.quickInboxButton?.setAttribute('aria-pressed', 'false');
      this.selectedId = null;
      this.plugin.setSelectedNode(null);
      this.canvas?.setSelected(null);
    }

    this.syncDiscoveryVisibility();
    this.refresh();
  }

  private renderDiscoveries(): void {
    const all = this.plugin.listDiscoveries();
    const filtered = this.discoveryThemeFilter
      ? all.filter((item) => {
          const keys = getDiscoveryThemeKeys(item);
          return (
            (keys.length > 0 ? keys : [UNCATEGORIZED_THEME]).includes(
              this.discoveryThemeFilter!,
            )
          );
        })
      : all;
    this.discoveryPanel?.render(
      filtered,
      this.plugin.getDiscoveryLoadBlocked(),
      this.discoveryThemeFilter,
      () => {
        this.discoveryThemeFilter = null;
        this.refresh();
      },
    );
  }

  public showDiscoveriesForTheme(theme: string): void {
    this.discoveryThemeFilter = theme;
    this.discoveryOpen = true;
    this.inboxOpen = false;
    this.discoveryButton?.addClass('is-active');
    this.quickDiscoveryButton?.addClass('is-active');
    this.inboxButton?.removeClass('is-active');
    this.quickInboxButton?.removeClass('is-active');
    this.discoveryButton?.setAttribute('aria-pressed', 'true');
    this.quickDiscoveryButton?.setAttribute('aria-pressed', 'true');
    this.inboxButton?.setAttribute('aria-pressed', 'false');
    this.quickInboxButton?.setAttribute('aria-pressed', 'false');
    this.selectedId = null;
    this.plugin.setSelectedNode(null);
    this.canvas?.setSelected(null);
    this.syncDiscoveryVisibility();
    this.refresh();
  }

  private select(nodeId: string | null): void {
    if (nodeId) {
      const node = this.plugin.store.getNode(nodeId);
      if (!node || !matchesNode(node, this.filter)) {
        new Notice('该节点被当前搜索或筛选隐藏，请先清除筛选再选择。');
        return;
      }
      this.inboxOpen = false;
      this.inboxButton?.removeClass('is-active');
      this.quickInboxButton?.removeClass('is-active');
      this.inboxButton?.setAttribute('aria-pressed', 'false');
      this.quickInboxButton?.setAttribute('aria-pressed', 'false');
    }

    this.selectedId = nodeId;
    this.plugin.setSelectedNode(nodeId);

    this.canvas?.setSelected(nodeId);
    if (nodeId) {
      this.canvas?.focusNode(nodeId);
      this.detail?.renderSelection(nodeId);
    } else if (this.inboxOpen) {
      this.detail?.renderSuggestionInbox();
    } else {
      this.detail?.renderInsights(this.plugin.getInsights(), this.insightsScopeNote());
    }

    this.updateUndoButtons();
  }

  private scheduleRefresh(): void {
    if (this.refreshHandle !== null) return;
    this.refreshHandle = window.requestAnimationFrame(() => {
      this.refreshHandle = null;
      this.refresh();
    });
  }

  private syncDiscoveryVisibility(): void {
    const showDiscovery = this.discoveryOpen;
    if (this.discoveryOpen) this.detailHost?.removeClass('is-hidden');
    if (this.detailContentHost) {
      this.detailContentHost.toggleClass('is-hidden', showDiscovery);
      this.detailContentHost.style.display = showDiscovery ? 'none' : '';
    }
    if (this.discoveryHost) {
      this.discoveryHost.toggleClass('is-hidden', !showDiscovery);
      this.discoveryHost.style.display = showDiscovery ? '' : 'none';
    }
  }

  private renderNextStep(): void {
    const host = this.nextStepEl;
    if (!host) return;
    const graph = this.plugin.store.getGraph();
    const pendingInbox = this.plugin.getPendingInboxItems().length;
    if (this.shareInboxBadgeEl) {
      this.shareInboxBadgeEl.setText(String(pendingInbox));
      this.shareInboxBadgeEl.toggleClass('is-hidden', pendingInbox === 0);
    }
    if (graph.nodes.length === 0 && pendingInbox === 0) {
      host.addClass('is-hidden');
      return;
    }

    const selected = this.selectedId ? this.plugin.store.getNode(this.selectedId) : undefined;
    const selectedIsLoose = selected ? this.plugin.store.degree(selected.id) === 0 : false;
    const sparks = graph.nodes.filter((node) => node.metadata?.spark === true);
    const looseSparks = sparks.filter((node) => this.plugin.store.degree(node.id) === 0);
    const isolated = graph.nodes.filter(
      (node) => this.plugin.store.degree(node.id) === 0 && !node.metadata?.nextStep,
    );
    const experiment = this.plugin.getActiveExperiment();

    let label = 'NEXT · 把今天的内容变成线索';
    let title = '再留下一个真实好奇';
    let detail = '刷到一条抖音或小红书，不需要整理全部，只留下让你停下来的那一条。';
    let button = '记录火花';
    let action = () => this.plugin.openSparkCapture();

    if (pendingInbox > 0) {
      label = `NEXT · ${pendingInbox} 条分享待判断`;
      title = '打开分享收件箱，一次处理一条';
      detail = '刷到的东西先放进来；每次只做一个决定：留下并连接，或者只是路过。';
      button = '打开收件箱';
      action = () => this.plugin.openInbox();
    } else if (selectedIsLoose && selected) {
      label = 'NEXT · 这个火花还没有连接';
      title = `给「${selected.title}」选一个已有兴趣`;
      detail = '不需要先决定它属于哪里；先选一个最接近的方向，之后还可以改。';
      button = '补一条连接';
      action = () => this.plugin.promptCreateRelation(selected.id);
    } else if (looseSparks.length > 0) {
      const spark = looseSparks[0];
      label = `NEXT · 还有 ${looseSparks.length} 个火花待判断`;
      title = `先处理「${spark?.title ?? '这个火花'}」`;
      detail = '先判断它和哪个已有兴趣有关；不确定就选“只是路过”，不要让收件箱变成新的收藏夹。';
      button = '处理这个火花';
      action = () => {
        if (spark) this.select(spark.id);
      };
    } else if (experiment?.gate.ok) {
      // The experiment strip directly above already owns this action.
      // Do not show two competing "record today" CTAs.
      host.addClass('is-hidden');
      return;
    } else if (isolated.length > 0) {
      const node = isolated[0];
      label = `NEXT · ${isolated.length} 个孤立节点`;
      title = `给「${node?.title ?? '这个节点'}」补一条连接`;
      detail = '孤立节点不是错误，它只是还没有进入你的兴趣结构。';
      button = '补一条连接';
      action = () => {
        if (node) this.plugin.promptCreateRelation(node.id);
      };
    }

    this.nextStepLabelEl?.setText(label);
    this.nextStepTitleEl?.setText(title);
    this.nextStepDetailEl?.setText(detail);
    this.nextStepButton?.setText(button);
    if (this.nextStepButton) this.nextStepButton.onclick = action;
    host.removeClass('is-hidden');
  }

  private renderClusterRail(total: number): void {
    const host = this.clusterRailEl;
    if (!host || !this.canvas) return;
    const summaries = this.canvas.getClusterSummaries();
    if (total === 0) {
      this.clusterFocus = null;
      this.clusterInitialized = false;
      host.addClass('is-hidden');
      return;
    }
    if (summaries.length < 2) {
      host.addClass('is-hidden');
      return;
    }

    if (!this.clusterInitialized && total >= 8) {
      const largest = [...summaries].sort((left, right) => right.count - left.count)[0];
      if (largest) {
        this.clusterFocus = largest.key;
        this.clusterInitialized = true;
        this.canvas.setClusterFocus(largest.key);
      }
    }
    if (this.clusterFocus && !summaries.some((cluster) => cluster.key === this.clusterFocus)) {
      this.clusterFocus = null;
      this.canvas.setClusterFocus(null);
    }

    host.empty();
    host.removeClass('is-hidden');
    const actualFocus = this.canvas.getClusterFocus();
    if (actualFocus !== this.clusterFocus) this.clusterFocus = actualFocus;
    host.createSpan({ cls: 'interestseed-cluster-rail-label', text: '主题优先' });
    const all = host.createEl('button', {
      cls: `interestseed-cluster-chip${this.clusterFocus === null ? ' is-active' : ''}`,
      text: `全部 ${total}`,
      attr: { type: 'button' },
    });
    all.addEventListener('click', () => {
      this.clusterFocus = null;
      this.canvas?.setClusterFocus(null);
      this.renderClusterRail(total);
    });
    for (const cluster of summaries) {
      const chip = host.createEl('button', {
        cls: `interestseed-cluster-chip${this.clusterFocus === cluster.key ? ' is-active' : ''}`,
        text: `${cluster.label} ${cluster.count}`,
        attr: { type: 'button' },
      });
      chip.style.setProperty('--cluster-color', cluster.color);
      chip.style.setProperty('color', '#d8deea', 'important');
      if (this.clusterFocus === cluster.key) {
        chip.style.setProperty('color', '#f7f2e4', 'important');
      }
      chip.addEventListener('click', () => {
        this.clusterFocus = cluster.key;
        this.canvas?.setClusterFocus(cluster.key);
        this.renderClusterRail(total);
      });
    }
  }

  private refresh(): void {
    if (!this.canvas || !this.emptyState) return;
    this.syncDiscoveryVisibility();

    const graph = this.plugin.store.getGraph();
    const filtered = filterGraph(graph, this.filter);
    const total = graph.nodes.length;
    this.totalNodes = total;
    this.totalEdges = graph.edges.length;
    this.visibleNodes = filtered.nodeCount;
    this.visibleEdges = filtered.edgeCount;
    this.contentEl.toggleClass('has-graph', total > 0);
    this.contentEl.toggleClass('has-experiment', Boolean(this.plugin.getActiveExperiment()));
    this.renderNextStep();
    if (total === 0) this.renderClusterRail(0);

    if (
      this.selectedId &&
      !filtered.graph.nodes.some((node) => node.id === this.selectedId)
    ) {
      this.selectedId = null;
      this.plugin.setSelectedNode(null);
    }

    this.countEl?.setText(
      total > 0
        ? `${filtered.nodeCount}/${total} 节点 · ${filtered.edgeCount} 可见关系`
        : '',
    );
    this.filterBar?.setSummary(total > 0 ? `${filtered.nodeCount}/${total} 节点` : '');

    if (filtered.nodeCount === 0) {
      this.canvasHost?.addClass('is-empty');
      if (this.discoveryOpen) {
        this.detailHost?.removeClass('is-hidden');
        this.renderDiscoveries();
      } else if (this.inboxOpen) {
        this.detailHost?.removeClass('is-hidden');
        this.detail?.renderSuggestionInbox();
      } else {
        this.detailHost?.addClass('is-hidden');
      }

      if (total === 0) {
        this.emptyState.show({
          title: '还没有建立地图。',
          detail:
            '选择一个项目目录，开始构建你的第一张知识地图。地图只会读取你授权的资料，不会自动上传文件。可在设置里的“包含文件夹”限定范围。',
          actions: [
            {
              label: '选择范围并扫描',
              primary: true,
              onClick: () => this.plugin.promptRebuild(),
            },
            { label: '新建节点', onClick: () => this.plugin.promptCreateNode() },
            { label: '打开 Agent', onClick: () => void this.plugin.activateAgentView() },
          ],
        });
      } else {
        this.emptyState.show({
          title: '没有匹配的节点',
          detail: '当前筛选条件下没有节点。放宽条件，或者清除筛选重新看整张图谱。',
          actions: [
            { label: '清除筛选', primary: true, onClick: () => this.filterBar?.reset() },
            { label: '问 Agent', onClick: () => void this.plugin.activateAgentView() },
          ],
        });
      }

      this.updateUndoButtons();
      return;
    }

    this.emptyState.hide();
    this.canvasHost?.removeClass('is-empty');
    this.detailHost?.removeClass('is-hidden');

    this.canvas.setGraph(filtered.graph, this.selectedId);
    this.renderClusterRail(total);

    if (!this.viewportApplied) {
      this.viewportApplied = true;
      const viewport = this.plugin.store.currentViewport;
      if (viewport) this.canvas.setViewport(viewport);
    }

    if (this.discoveryOpen) this.renderDiscoveries();
    else if (this.inboxOpen) this.detail?.renderSuggestionInbox();
    else if (this.selectedId) this.detail?.renderSelection(this.selectedId);
    else this.detail?.renderInsights(this.plugin.getInsights(), this.insightsScopeNote());

    this.renderFooter(this.plugin.getStatus());
    this.updateUndoButtons();
  }

  private insightsScopeNote(): string | undefined {
    if (isEmptyFilter(this.filter)) return undefined;
    const graph = this.plugin.store.getGraph();
    const filtered = filterGraph(graph, this.filter);
    return `当前筛选显示 ${filtered.nodeCount}/${graph.nodes.length} 节点、${filtered.edgeCount}/${graph.edges.length} 关系；以下为全图洞察。`;
  }

  private renderFooter(status: InterestSeedStatus): void {
    if (this.footerScanEl) {
      const counts = isEmptyFilter(this.filter)
        ? `${this.totalNodes} 节点 / ${status.confirmed} 已确认 · ${status.suggested} 建议`
        : `显示 ${this.visibleNodes}/${this.totalNodes} 节点 · ${this.visibleEdges}/${this.totalEdges} 可见关系；全图 ${status.confirmed} 已确认 · ${status.suggested} 建议`;
      this.footerScanEl.setText(
        status.scanning ? '正在扫描…' : `就绪 · ${counts}`,
      );
    }

    if (this.footerSaveEl) {
      this.footerSaveEl.setText(
        status.blocked ? '存储已暂停' : status.saveFailed ? '未保存' : '已保存',
      );
      this.footerSaveEl.toggleClass('is-warning', status.blocked || status.saveFailed);
    }

    if (this.footerErrorEl) {
      const message = status.lastError ?? status.blockedReason ?? '';
      this.footerErrorEl.setText(message ? `⚠ ${message}` : '');
      this.footerErrorEl.toggleClass('is-visible', Boolean(message));
      if (message) this.footerErrorEl.setAttribute('title', message);
      else this.footerErrorEl.removeAttribute('title');
    }
  }

  private updateUndoButtons(): void {
    const state = this.plugin.undo.getState();

    if (this.undoButton) {
      this.undoButton.disabled = !state.canUndo;
      this.undoButton.setAttribute(
        'title',
        state.undoLabel ? `撤销：${state.undoLabel}` : '撤销',
      );
    }
    if (this.redoButton) {
      this.redoButton.disabled = !state.canRedo;
      this.redoButton.setAttribute(
        'title',
        state.redoLabel ? `重做：${state.redoLabel}` : '重做',
      );
    }
    if (this.quickUndoButton) {
      this.quickUndoButton.disabled = !state.canUndo;
      this.quickUndoButton.setAttribute(
        'title',
        state.undoLabel ? `撤销：${state.undoLabel}` : '撤销',
      );
    }
    if (this.quickRedoButton) {
      this.quickRedoButton.disabled = !state.canRedo;
      this.quickRedoButton.setAttribute(
        'title',
        state.redoLabel ? `重做：${state.redoLabel}` : '重做',
      );
    }
  }

  private createAction(
    parent: HTMLElement,
    icon: string,
    label: string,
    onClick: () => void,
  ): HTMLButtonElement {
    const button = parent.createEl('button', {
      cls: 'interestseed-action',
      attr: { 'aria-label': label, title: label },
    });
    setIcon(button, icon);
    button.addEventListener('click', onClick);
    return button;
  }

  private createLaunchCard(
    parent: HTMLElement,
    icon: string,
    title: string,
    description: string,
    modifier: string,
    onClick: () => void,
  ): HTMLButtonElement {
    const button = parent.createEl('button', {
      cls: `interestseed-launch-card${modifier ? ` ${modifier}` : ''}`,
      attr: { type: 'button', 'aria-label': title },
    });
    const iconEl = button.createDiv({ cls: 'interestseed-launch-icon' });
    setIcon(iconEl, icon);
    const copy = button.createDiv({ cls: 'interestseed-launch-copy' });
    copy.createDiv({ cls: 'interestseed-launch-title', text: title });
    copy.createDiv({ cls: 'interestseed-launch-desc', text: description });
    const arrow = button.createSpan({ cls: 'interestseed-launch-arrow', text: '→' });
    arrow.setAttribute('aria-hidden', 'true');
    button.addEventListener('click', onClick);
    return button;
  }

  private createQuickAction(
    parent: HTMLElement,
    icon: string,
    label: string,
    onClick: () => void,
  ): HTMLButtonElement {
    const button = parent.createEl('button', {
      cls: 'interestseed-quick-action',
      attr: { 'aria-label': label, title: label },
    });
    setIcon(button, icon);
    button.createSpan({ text: label });
    button.addEventListener('click', onClick);
    return button;
  }
}
