import { setIcon } from 'obsidian';
import type { App } from 'obsidian';
import type { GraphInsights, Insight } from '../core/InsightEngine';
import type { NeighborEntry, InterestSeedGraphStore } from '../core/GraphStore';
import type { InterestSeedNode, RelationOrigin, RelationStatus } from '../types/graph';
import { pathFromUri } from '../utils/paths';
import { TYPE_LABELS } from './FilterBar';
import { confirmAction } from './ConfirmModal';
import { collectSuggestedEdges, type SuggestionRow } from './suggestionList';

export interface DetailPanelActions {
  openSource(uri: string): void;
  deleteNode(id: string): void;
  selectNode(id: string | null): void;
  confirmEdge(id: string): boolean;
  rejectEdge(id: string): boolean;
  restoreEdge(id: string): boolean;
  editRelation(id: string): void;
  deleteEdge(id: string): void;
  createRelation(sourceId: string): void;
  expandWithAI(id: string): void;
  openGapCoach(insight: Insight): void;
}

const STATUS_LABELS: Record<RelationStatus, string> = {
  confirmed: '已确认',
  suggested: '建议',
  rejected: '已拒绝',
};

const ORIGIN_LABELS: Record<RelationOrigin, string> = {
  user: '手动',
  rule: '规则',
  ai: 'AI',
};

function formatValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value === null || value === undefined) return '—';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** 右侧详情面板：节点详情、关系与图谱洞察。 */
export class DetailPanel {
  private readonly root: HTMLElement;

  constructor(
    private readonly app: App,
    container: HTMLElement,
    private readonly store: InterestSeedGraphStore,
    private readonly actions: DetailPanelActions,
  ) {
    this.root = container.createDiv({ cls: 'interestseed-detail-inner' });
  }

  renderSelection(nodeId: string | null): void {
    this.root.empty();
    const node = nodeId ? this.store.getNode(nodeId) : undefined;
    if (!node) {
      this.renderPlaceholder();
      return;
    }

    this.renderHeader(node);

    const meta = this.root.createDiv({ cls: 'interestseed-detail-meta' });
    meta.createSpan({ text: TYPE_LABELS[node.type] });
    meta.createSpan({
      text: `${this.store.neighbors(node.id, { statuses: ['confirmed'] }).length} 条已确认关系`,
    });
    meta.createSpan({ text: `${node.tags.length} 个标签` });

    if (node.sourceUri) {
      const source = this.root.createDiv({ cls: 'interestseed-source' });
      source.createSpan({ cls: 'interestseed-source-label', text: '来源' });
      source.createSpan({
        cls: 'interestseed-source-path',
        text: pathFromUri(node.sourceUri),
      });
    } else {
      const source = this.root.createDiv({ cls: 'interestseed-source' });
      source.createSpan({ cls: 'interestseed-source-label', text: '来源' });
      source.createSpan({
        cls: 'interestseed-source-path',
        text: '手动节点，没有关联笔记',
      });
    }

    if (node.tags.length > 0) {
      const tags = this.root.createDiv({ cls: 'interestseed-tags' });
      for (const tag of node.tags) {
        tags.createSpan({ cls: 'interestseed-tag', text: `#${tag}` });
      }
    }

    if (node.metadata.spark === true) this.renderSparkDecision(node);

    const summary =
      typeof node.metadata.summary === 'string' ? node.metadata.summary : '';
    if (summary) {
      this.root.createEl('p', { cls: 'interestseed-summary-text', text: summary });
    }

    this.renderMetadata(node);
    this.renderRelations(node);
    this.renderActions(node);
  }

  /** 全局建议收件箱：列出全部 suggested 关系，不依赖当前选中节点。 */
  renderSuggestionInbox(): void {
    this.root.empty();

    const header = this.root.createDiv({ cls: 'interestseed-detail-header' });
    header.createEl('h3', { cls: 'interestseed-detail-title', text: '建议收件箱' });

    const rows = collectSuggestedEdges(this.store);
    if (rows.length === 0) {
      this.root.createEl('p', {
        cls: 'interestseed-empty-hint',
        text: '没有待确认的关系。新的建议会出现在这里。',
      });
      return;
    }

    this.root.createEl('p', {
      cls: 'interestseed-empty-hint',
      text: `${rows.length} 条待确认关系，按置信度排序。`,
    });

    const section = this.root.createDiv({
      cls: 'interestseed-suggestions interestseed-inbox-list',
    });

    for (const row of rows) {
      this.renderInboxCard(section, row);
    }
  }

  renderInsights(insights: GraphInsights, scopeNote?: string): void {    this.root.empty();

    const header = this.root.createDiv({ cls: 'interestseed-detail-header' });
    header.createEl('h3', { cls: 'interestseed-detail-title', text: '图谱洞察' });
    if (scopeNote) {
      this.root.createEl('p', {
        cls: 'interestseed-empty-hint',
        text: scopeNote,
      });
    }

    const stats = this.root.createDiv({ cls: 'interestseed-stats' });
    for (const [label, value] of [
      ['节点', insights.stats.nodes],
      ['已确认', insights.stats.confirmed],
      ['建议', insights.stats.suggested],
      ['孤立', insights.stats.orphans],
    ] as const) {
      const cell = stats.createDiv({ cls: 'interestseed-stat' });
      cell.createSpan({ cls: 'interestseed-stat-value', text: String(value) });
      const labelEl = cell.createSpan({ cls: 'interestseed-stat-label', text: label });
      if (label === '孤立') {
        labelEl.setAttribute('title', '没有任何已确认关系的节点');
      }
    }

    if (insights.insights.length === 0) {
      this.root.createEl('p', {
        cls: 'interestseed-empty-hint',
        text: '图谱还很小。从仓库生成图谱，或先手动创建一个节点。',
      });
      return;
    }

    const list = this.root.createDiv({ cls: 'interestseed-insights' });
    for (const insight of insights.insights) {
      const card = list.createDiv({ cls: `interestseed-insight is-${insight.kind}` });
      card.createEl('h4', { cls: 'interestseed-detail-insight-title', text: insight.title });
      card.createEl('p', { cls: 'interestseed-insight-detail', text: insight.detail });

      if (insight.nodeIds.length > 0) {
        const button = card.createEl('button', {
          cls: 'interestseed-insight-link',
          text: '定位节点',
        });
        button.addEventListener('click', () =>
          this.actions.selectNode(insight.nodeIds[0] ?? null),
        );
        const coach = card.createEl('button', {
          cls: 'interestseed-insight-coach',
          text: '补一条连接',
        });
        coach.addEventListener('click', () => this.actions.openGapCoach(insight));
      }
    }
  }

  destroy(): void {
    this.root.remove();
  }

  private renderPlaceholder(): void {
    const icon = this.root.createDiv({ cls: 'interestseed-detail-placeholder-icon' });
    setIcon(icon, 'mouse-pointer-click');
    this.root.createEl('p', {
      cls: 'interestseed-empty-hint',
      text: '点击画布中的节点查看详情；点击空白处返回图谱洞察。',
    });
  }

  private renderHeader(node: InterestSeedNode): void {
    const header = this.root.createDiv({ cls: 'interestseed-detail-header' });
    header.createEl('h3', { cls: 'interestseed-detail-title', text: node.title });

    const type = header.createEl('span', {
      cls: `interestseed-type-pill is-${node.type}`,
      text: TYPE_LABELS[node.type],
    });
    type.setAttribute('title', '节点类型来自 frontmatter 的 type 字段或文件扩展名');
  }

  private renderMetadata(node: InterestSeedNode): void {
    const entries = Object.entries(node.metadata).filter(
      ([key, value]) =>
        key !== 'summary' &&
        key !== 'path' &&
        value !== undefined &&
        value !== null &&
        String(value).trim() !== '',
    );

    if (entries.length === 0) return;

    const section = this.root.createDiv({ cls: 'interestseed-metadata' });
    section.createEl('h4', { text: '元数据' });
    for (const [key, value] of entries.slice(0, 8)) {
      const row = section.createDiv({ cls: 'interestseed-metadata-row' });
      row.createSpan({ cls: 'interestseed-metadata-key', text: key });
      row.createSpan({
        cls: 'interestseed-metadata-value',
        text: formatValue(value).slice(0, 120),
      });
    }
  }

  private renderRelations(node: InterestSeedNode): void {
    const relations = this.store.neighbors(node.id);
    const suggestions = relations.filter((entry) => entry.edge.status === 'suggested');
    const others = relations.filter((entry) => entry.edge.status !== 'suggested');

    if (suggestions.length > 0) this.renderSuggestions(suggestions);

    const section = this.root.createDiv({ cls: 'interestseed-relations' });
    section.createEl('h4', { text: `关系（${others.length}）` });

    if (others.length === 0) {
      if (suggestions.length === 0) {
        section.createEl('p', {
          cls: 'interestseed-empty-hint',
          text: '还没有关系。可以在下方创建关系，或刷新规则建议。',
        });
      }
      return;
    }

    const groups = new Map<string, NeighborEntry[]>();
    for (const entry of others) {
      const list = groups.get(entry.edge.relation);
      if (list) list.push(entry);
      else groups.set(entry.edge.relation, [entry]);
    }

    for (const [relation, entries] of groups) {
      const group = section.createDiv({ cls: 'interestseed-relation-group' });
      group.createSpan({
        cls: 'interestseed-relation-kind',
        text: `${relation} · ${entries.length}`,
      });

      for (const entry of entries) {
        const outgoing = entry.edge.source === node.id;
        const arrow = outgoing ? '→' : '←';

        const item = group.createDiv({ cls: 'interestseed-relation-item' });
        item.createSpan({ cls: 'interestseed-relation-arrow', text: arrow });

        const link = item.createEl('button', {
          cls: 'interestseed-relation-title',
          text: entry.node.title,
        });
        link.addEventListener('click', () => this.actions.selectNode(entry.node.id));

        item.createSpan({
          cls: `interestseed-status ${entry.edge.status}`,
          text: STATUS_LABELS[entry.edge.status],
        });

        if (entry.edge.confidence !== undefined) {
          item.createSpan({
            cls: 'interestseed-relation-origin',
            text: `${Math.round(entry.edge.confidence * 100)}%`,
          });
        }

        if (entry.edge.status === 'rejected') {
          const restore = item.createEl('button', {
            cls: 'interestseed-edge-action',
            text: '恢复',
            attr: { 'aria-label': '恢复为建议', title: '恢复为待确认建议' },
          });
          restore.addEventListener('click', () =>
            this.runEdgeAction(restore, () =>
              this.actions.restoreEdge(entry.edge.id),
            ),
          );
        }

        const edit = item.createEl('button', {
          cls: 'interestseed-edge-action',
          text: '✎',
          attr: {
            'aria-label': `编辑关系 ${entry.edge.relation}`,
            title: '编辑关系名称（ID 保持不变）',
          },
        });
        edit.addEventListener('click', () => this.actions.editRelation(entry.edge.id));

        const remove = item.createEl('button', {
          cls: 'interestseed-edge-action is-danger',
          text: '🗑',
          attr: { 'aria-label': '删除关系', title: '删除关系' },
        });
        remove.addEventListener('click', () => {
          void confirmAction(this.app, `删除关系「${entry.edge.relation}」？`).then((ok) => {
            if (ok) this.actions.deleteEdge(entry.edge.id);
          });
        });

        const evidence = (entry.edge.evidence ?? []).join('；');
        if (evidence) {
          group.createEl('p', {
            cls: 'interestseed-evidence',
            text: `依据：${evidence}`,
          });
        }
      }
    }
  }

  private renderInboxCard(parent: HTMLElement, row: SuggestionRow): void {
    const { edge } = row;
    const card = parent.createDiv({ cls: 'interestseed-suggestion interestseed-inbox-card' });

    const route = card.createDiv({ cls: 'interestseed-inbox-route' });
    this.renderInboxNode(route, row.source, `节点缺失（${edge.source}）`);
    route.createSpan({ cls: 'interestseed-inbox-arrow', text: '→' });
    this.renderInboxNode(route, row.target, `节点缺失（${edge.target}）`);

    const meta = card.createDiv({ cls: 'interestseed-inbox-meta' });
    meta.createSpan({ text: `关系：${edge.relation}` });
    meta.createSpan({ text: `来源：${ORIGIN_LABELS[edge.origin]}` });
    if (edge.confidence !== undefined) {
      meta.createSpan({ text: `置信度：${Math.round(edge.confidence * 100)}%` });
    }
    meta.createSpan({
      cls: `interestseed-status ${edge.status}`,
      text: STATUS_LABELS[edge.status],
    });

    const evidence = (edge.evidence ?? []).join('；');
    card.createEl('p', {
      cls: 'interestseed-suggestion-reason',
      text: evidence ? `依据：${evidence}` : '没有说明原因的候选关系',
    });

    const actions = card.createDiv({ cls: 'interestseed-suggestion-actions' });
    const confirm = actions.createEl('button', {
      cls: 'mod-cta',
      text: '确认',
      attr: { 'aria-label': `确认关系 ${edge.id}` },
    });
    confirm.addEventListener('click', () =>
      this.runEdgeAction(
        confirm,
        () => this.actions.confirmEdge(edge.id),
        () => this.renderSuggestionInbox(),
      ),
    );

    const reject = actions.createEl('button', {
      text: '拒绝',
      attr: { 'aria-label': `拒绝关系 ${edge.id}` },
    });
    reject.addEventListener('click', () =>
      this.runEdgeAction(
        reject,
        () => this.actions.rejectEdge(edge.id),
        () => this.renderSuggestionInbox(),
      ),
    );
  }

  private renderInboxNode(
    parent: HTMLElement,
    node: InterestSeedNode | undefined,
    fallback: string,
  ): void {
    if (!node) {
      parent.createSpan({ cls: 'interestseed-inbox-node is-missing', text: fallback });
      return;
    }

    const button = parent.createEl('button', {
      cls: 'interestseed-inbox-node',
      text: node.title,
      attr: { title: `定位到「${node.title}」` },
    });
    button.addEventListener('click', () => this.actions.selectNode(node.id));
  }

  private runEdgeAction(
    button: HTMLButtonElement,
    action: () => boolean,
    onSuccess?: () => void,
  ): void {
    if (button.disabled) return;
    button.disabled = true;
    if (action()) {
      onSuccess?.();
    } else {
      button.disabled = false;
    }
  }

  private renderSuggestions(entries: NeighborEntry[]): void {
    const section = this.root.createDiv({ cls: 'interestseed-suggestions' });
    section.createEl('h4', { text: `关系建议（${entries.length}）` });

    for (const entry of entries) {
      const card = section.createDiv({ cls: 'interestseed-suggestion' });
      const head = card.createDiv({ cls: 'interestseed-suggestion-head' });

      const link = head.createEl('button', {
        cls: 'interestseed-relation-title',
        text: entry.node.title,
      });
      link.addEventListener('click', () => this.actions.selectNode(entry.node.id));

      head.createSpan({
        cls: 'interestseed-status suggested',
        text: STATUS_LABELS.suggested,
      });

      const reasons = (entry.edge.evidence ?? []).join('；') || '没有说明原因的候选关系';
      card.createEl('p', { cls: 'interestseed-suggestion-reason', text: reasons });

      const actions = card.createDiv({ cls: 'interestseed-suggestion-actions' });
      const confirm = actions.createEl('button', {
        cls: 'mod-cta',
        text: '确认',
        attr: { 'aria-label': `确认与 ${entry.node.title} 的关系` },
      });
      confirm.addEventListener('click', () =>
        this.runEdgeAction(confirm, () => this.actions.confirmEdge(entry.edge.id)),
      );

      const reject = actions.createEl('button', {
        text: '拒绝',
        attr: { 'aria-label': `拒绝与 ${entry.node.title} 的关系` },
      });
      reject.addEventListener('click', () =>
        this.runEdgeAction(reject, () => this.actions.rejectEdge(entry.edge.id)),
      );
    }
  }

  private renderSparkDecision(node: InterestSeedNode): void {
    const section = this.root.createDiv({ cls: 'interestseed-spark-decision' });
    section.createDiv({ cls: 'interestseed-spark-decision-kicker', text: 'ONE DECISION' });
    section.createEl('p', {
      cls: 'interestseed-spark-decision-title',
      text: '这个火花还只是一个候选。它和你的哪个兴趣有关？',
    });
    const raw = typeof node.metadata.raw === 'string' ? node.metadata.raw : '';
    if (raw) {
      section.createEl('p', { cls: 'interestseed-spark-decision-raw', text: raw });
    }
    const why = typeof node.metadata.why === 'string' ? node.metadata.why : '';
    if (why) {
      section.createDiv({ cls: 'interestseed-spark-decision-why', text: `你留下它的原因：${why}` });
    }
    const actions = section.createDiv({ cls: 'interestseed-spark-decision-actions' });
    const connect = actions.createEl('button', {
      cls: 'mod-cta',
      text: '留下并连接',
      attr: { type: 'button' },
    });
    connect.addEventListener('click', () => this.actions.createRelation(node.id));
    const pass = actions.createEl('button', {
      text: '只是路过',
      attr: { type: 'button' },
    });
    pass.addEventListener('click', () => {
      void confirmAction(
        this.app,
        `把「${node.title}」移出图谱？它只是路过，不需要变成兴趣。`,
        '只是路过',
      ).then((confirmed) => {
        if (confirmed) this.actions.deleteNode(node.id);
      });
    });
  }

  private renderActions(node: InterestSeedNode): void {
    const actions = this.root.createDiv({ cls: 'interestseed-detail-actions' });

    if (node.sourceUri) {
      const open = actions.createEl('button', { text: '打开来源' });
      open.addEventListener('click', () => {
        if (node.sourceUri) this.actions.openSource(node.sourceUri);
      });
    }

    const create = actions.createEl('button', { text: '创建关系' });
    create.addEventListener('click', () => this.actions.createRelation(node.id));

    const expand = actions.createEl('button', { text: 'AI 建议（未启用）' });
    expand.addEventListener('click', () => this.actions.expandWithAI(node.id));

    const remove = actions.createEl('button', { cls: 'mod-warning', text: '删除节点' });
    remove.addEventListener('click', () => this.actions.deleteNode(node.id));
  }
}
