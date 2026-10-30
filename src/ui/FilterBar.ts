import type {
  InterestSeedGraph,
  InterestSeedNode,
  NodeType,
  RelationOrigin,
  RelationStatus,
} from '../types/graph';
import { RELATION_STATUSES } from '../types/graph';
import { normalizePath, pathFromUri } from '../utils/paths';
import { tagKey } from '../utils/validation';

export interface GraphFilter {
  query: string;
  /** 目录筛选，匹配 sourceUri / metadata.path 前缀。 */
  folder: string;
  /** 标签筛选，匹配节点标签（包含匹配，不区分大小写）。 */
  tag: string;
  types: NodeType[];
  origins: RelationOrigin[];
  statuses: RelationStatus[];
  minConfidence: number;
}

export const DEFAULT_FILTER: GraphFilter = {
  query: '',
  folder: '',
  tag: '',
  types: [],
  origins: [],
  statuses: ['confirmed', 'suggested'],
  minConfidence: 0,
};

export function createDefaultFilter(): GraphFilter {
  return {
    ...DEFAULT_FILTER,
    types: [],
    origins: [],
    statuses: [...DEFAULT_FILTER.statuses],
  };
}

export const TYPE_LABELS: Record<NodeType, string> = {
  project: '项目',
  document: '文档',
  topic: '主题',
  image: '图片',
  audio: '音频',
  video: '视频',
  activity: '活动',
};

const ORIGIN_LABELS: Record<RelationOrigin, string> = {
  user: '手动',
  rule: '规则',
  ai: 'AI',
};

const STATUS_LABELS: Record<RelationStatus, string> = {
  confirmed: '已确认',
  suggested: '建议',
  rejected: '已拒绝',
};

export function isEmptyFilter(filter: GraphFilter): boolean {
  // 默认只显示“已确认 + 建议”是视图默认值，不应被当成用户筛选；
  // 全选（或全不选）同样等价于不过滤关系状态。
  const defaultStatuses =
    filter.statuses.length === 2 &&
    filter.statuses.includes('confirmed') &&
    filter.statuses.includes('suggested');
  const statusesUnfiltered =
    filter.statuses.length === 0 ||
    filter.statuses.length === RELATION_STATUSES.length ||
    defaultStatuses;

  return (
    filter.query.trim() === '' &&
    filter.folder.trim() === '' &&
    filter.tag.trim() === '' &&
    filter.types.length === 0 &&
    filter.origins.length === 0 &&
    filter.minConfidence === 0 &&
    statusesUnfiltered
  );
}

function nodePath(node: InterestSeedNode): string {
  if (typeof node.metadata.path === 'string') return normalizePath(node.metadata.path);
  return node.sourceUri ? pathFromUri(node.sourceUri) : '';
}

interface NodeSearchIndex {
  path: string;
  searchable: string;
}

const nodeSearchIndexCache = new Map<string, NodeSearchIndex>();
const NODE_SEARCH_INDEX_LIMIT = 2048;

function buildNodeSearchIndex(node: InterestSeedNode): NodeSearchIndex {
  const observations = Array.isArray(node.metadata.observations)
    ? node.metadata.observations
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
        .map((item) => String(item.evidence ?? ''))
        .join(' ')
    : '';
  return {
    path: nodePath(node).toLowerCase(),
    searchable: [
      node.title,
      typeof node.metadata.summary === 'string' ? node.metadata.summary : '',
      typeof node.metadata.why === 'string' ? node.metadata.why : '',
      typeof node.metadata.raw === 'string' ? node.metadata.raw : '',
      typeof node.metadata.sourceRef === 'string' ? node.metadata.sourceRef : '',
      typeof node.metadata.contextSourceRef === 'string' ? node.metadata.contextSourceRef : '',
      nodePath(node),
      node.tags.join(' '),
      observations,
    ]
      .join(' ')
      .toLowerCase(),
  };
}

function cachedNodeSearchIndex(graphUpdatedAt: string, node: InterestSeedNode): NodeSearchIndex {
  const key = `${graphUpdatedAt}\u0000${node.id}`;
  const cached = nodeSearchIndexCache.get(key);
  if (cached) return cached;
  const built = buildNodeSearchIndex(node);
  if (nodeSearchIndexCache.size >= NODE_SEARCH_INDEX_LIMIT) nodeSearchIndexCache.clear();
  nodeSearchIndexCache.set(key, built);
  return built;
}

export function matchesNode(node: InterestSeedNode, filter: GraphFilter, index?: NodeSearchIndex): boolean {
  if (filter.types.length > 0 && !filter.types.includes(node.type)) return false;

  const folder = normalizePath(filter.folder.trim()).toLowerCase();
  if (folder) {
    const path = index?.path ?? nodePath(node).toLowerCase();
    if (path !== folder && !path.startsWith(`${folder}/`)) return false;
  }

  const tag = tagKey(filter.tag);
  if (tag && !node.tags.some((item) => tagKey(item).includes(tag))) return false;

  const query = filter.query.trim().toLowerCase();
  if (!query) return true;

  const queryTag = query.replace(/^#+/, '');
  const searchable = index?.searchable ?? buildNodeSearchIndex(node).searchable;
  const terms = query.split(/\s+/).filter(Boolean);

  return (
    terms.every((term) => searchable.includes(term)) ||
    (queryTag !== '' && node.tags.some((item) => tagKey(item).includes(queryTag)))
  );
}

export interface FilteredGraph {
  graph: InterestSeedGraph;
  nodeCount: number;
  edgeCount: number;
  totalNodes: number;
}

export function filterGraph(graph: InterestSeedGraph, filter: GraphFilter): FilteredGraph {
  const nodes = graph.nodes.filter((node) =>
    matchesNode(node, filter, cachedNodeSearchIndex(graph.updatedAt, node)),
  );
  const visible = new Set(nodes.map((node) => node.id));

  const edges = graph.edges.filter((edge) => {
    if (filter.origins.length > 0 && !filter.origins.includes(edge.origin)) return false;
    if (filter.statuses.length > 0 && !filter.statuses.includes(edge.status)) return false;
    if ((edge.confidence ?? 0) + 1e-9 < filter.minConfidence) return false;
    return visible.has(edge.source) && visible.has(edge.target);
  });

  return {
    graph: { ...graph, nodes, edges },
    nodeCount: nodes.length,
    edgeCount: edges.length,
    totalNodes: graph.nodes.length,
  };
}

/** 搜索 + 类型 / 来源 / 状态 / 置信度筛选条。 */
export class FilterBar {
  private filter: GraphFilter = createDefaultFilter();
  private readonly chips = new Map<string, HTMLElement>();
  private searchInput: HTMLInputElement | null = null;
  private folderInput: HTMLInputElement | null = null;
  private tagInput: HTMLInputElement | null = null;
  private confidenceInput: HTMLInputElement | null = null;
  private confidenceValueEl: HTMLElement | null = null;
  private summaryEl: HTMLElement | null = null;
  private searchTimer: number | null = null;

  constructor(
    private readonly container: HTMLElement,
    private readonly onChange: (filter: GraphFilter) => void,
  ) {
    this.render();
  }

  getFilter(): GraphFilter {
    return {
      query: this.filter.query,
      folder: this.filter.folder,
      tag: this.filter.tag,
      types: [...this.filter.types],
      origins: [...this.filter.origins],
      statuses: [...this.filter.statuses],
      minConfidence: this.filter.minConfidence,
    };
  }

  setSummary(text: string): void {
    this.summaryEl?.setText(text);
  }

  reset(): void {
    this.filter = createDefaultFilter();
    if (this.searchInput) this.searchInput.value = '';
    if (this.folderInput) this.folderInput.value = '';
    if (this.tagInput) this.tagInput.value = '';
    if (this.confidenceInput) this.confidenceInput.value = '0';
    this.confidenceValueEl?.setText('0%');
    this.syncChips();
    this.onChange(this.getFilter());
  }

  destroy(): void {
    if (this.searchTimer !== null) window.clearTimeout(this.searchTimer);
    this.searchTimer = null;
    this.container.empty();
  }

  private render(): void {
    this.container.empty();
    this.container.addClass('interestseed-filterbar');

    const firstRow = this.container.createDiv({ cls: 'interestseed-filter-row' });
    this.searchInput = firstRow.createEl('input', {
      cls: 'interestseed-search',
      attr: {
        type: 'search',
        placeholder: '搜索标题、标签、来源、观察…',
        'aria-label': '搜索节点',
      },
    });

    this.searchInput.addEventListener('input', () => this.scheduleUpdate());

    const refineRow = this.container.createDiv({
      cls: 'interestseed-filter-row interestseed-refine-row',
    });
    this.folderInput = refineRow.createEl('input', {
      cls: 'interestseed-filter-input',
      attr: {
        type: 'search',
        placeholder: '目录筛选，如 Projects/Alpha',
        'aria-label': '按目录筛选',
      },
    });
    this.folderInput.addEventListener('input', () => this.scheduleUpdate());

    this.tagInput = refineRow.createEl('input', {
      cls: 'interestseed-filter-input',
      attr: {
        type: 'search',
        placeholder: '标签筛选，如 focus',
        'aria-label': '按标签筛选',
      },
    });
    this.tagInput.addEventListener('input', () => this.scheduleUpdate());

    this.summaryEl = firstRow.createSpan({ cls: 'interestseed-summary', text: '' });

    const typeRow = this.container.createDiv({ cls: 'interestseed-filter-group' });
    typeRow.createSpan({ cls: 'interestseed-filter-label', text: '类型' });
    for (const type of [
      'project',
      'document',
      'topic',
      'image',
      'audio',
      'video',
      'activity',
    ] as const) {
      const chip = typeRow.createEl('button', {
        cls: 'interestseed-chip',
        text: TYPE_LABELS[type],
      });
      chip.addEventListener('click', () => {
        this.filter.types = toggle(this.filter.types, type);
        this.syncChips();
        this.onChange(this.getFilter());
      });
      this.chips.set(`type:${type}`, chip);
    }

    const originRow = this.container.createDiv({ cls: 'interestseed-filter-group' });
    originRow.createSpan({ cls: 'interestseed-filter-label', text: '来源' });
    for (const origin of ['user', 'rule', 'ai'] as const) {
      const chip = originRow.createEl('button', {
        cls: 'interestseed-chip',
        text: ORIGIN_LABELS[origin],
      });
      chip.addEventListener('click', () => {
        this.filter.origins = toggle(this.filter.origins, origin);
        this.syncChips();
        this.onChange(this.getFilter());
      });
      this.chips.set(`origin:${origin}`, chip);
    }

    const statusRow = this.container.createDiv({ cls: 'interestseed-filter-group' });
    statusRow.createSpan({ cls: 'interestseed-filter-label', text: '关系' });
    for (const status of ['confirmed', 'suggested', 'rejected'] as const) {
      const chip = statusRow.createEl('button', {
        cls: 'interestseed-chip',
        text: STATUS_LABELS[status],
      });
      chip.addEventListener('click', () => {
        this.filter.statuses = toggle(this.filter.statuses, status);
        this.syncChips();
        this.onChange(this.getFilter());
      });
      this.chips.set(`status:${status}`, chip);
    }

    const confidenceRow = this.container.createDiv({
      cls: 'interestseed-filter-group interestseed-weight',
    });
    confidenceRow.createSpan({ cls: 'interestseed-filter-label', text: '最低置信度' });
    this.confidenceInput = confidenceRow.createEl('input', {
      cls: 'interestseed-weight-range',
      attr: { type: 'range', min: '0', max: '1', step: '0.05', 'aria-label': '最低置信度' },
    });
    this.confidenceInput.value = '0';
    this.confidenceValueEl = confidenceRow.createSpan({
      cls: 'interestseed-weight-value',
      text: '0%',
    });

    this.confidenceInput.addEventListener('input', () => {
      this.filter.minConfidence = Number(this.confidenceInput?.value ?? '0');
      this.confidenceValueEl?.setText(`${Math.round(this.filter.minConfidence * 100)}%`);
      this.onChange(this.getFilter());
    });

    this.syncChips();
  }

  private scheduleUpdate(): void {
    if (this.searchTimer !== null) window.clearTimeout(this.searchTimer);
    this.searchTimer = window.setTimeout(() => {
      this.searchTimer = null;
      this.filter.query = this.searchInput?.value ?? '';
      this.filter.folder = this.folderInput?.value ?? '';
      this.filter.tag = this.tagInput?.value ?? '';
      this.onChange(this.getFilter());
    }, 140);
  }

  private syncChips(): void {
    for (const [key, element] of this.chips) {
      const [group, value] = key.split(':');
      if (!group || !value) continue;

      const active =
        group === 'type'
          ? this.filter.types.includes(value as NodeType)
          : group === 'origin'
            ? this.filter.origins.includes(value as RelationOrigin)
            : this.filter.statuses.includes(value as RelationStatus);

      element.toggleClass('is-active', active);
      element.setAttribute('aria-pressed', String(active));
    }
  }
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}
