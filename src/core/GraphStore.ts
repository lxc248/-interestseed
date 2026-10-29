import {
  GRAPH_SCHEMA_VERSION,
  isNodeType,
  isRelationOrigin,
  isRelationStatus,
} from '../types/graph';
import type {
  GraphViewport,
  InterestSeedEdge,
  InterestSeedGraph,
  InterestSeedNode,
  NodeType,
  RelationOrigin,
  RelationStatus,
} from '../types/graph';
import { createId, edgeIdFor } from '../utils/ids';
import { normalizeSourceUri } from '../utils/paths';
import { clamp01, sanitizeTags, validateGraphStructure } from '../utils/validation';

/**
 * 明确的图谱读写接口。UI / 控制器只依赖这个接口，
 * 便于替换实现（内存、远端、测试桩）。
 */
export interface GraphStore {
  getGraph(): InterestSeedGraph;

  getNode(id: string): InterestSeedNode | undefined;

  addNode(node: InterestSeedNode): void;

  updateNode(id: string, patch: Partial<InterestSeedNode>): void;

  removeNode(id: string): void;

  addEdge(edge: InterestSeedEdge): void;

  updateEdge(id: string, patch: Partial<InterestSeedEdge>): void;

  removeEdge(id: string): void;

  validate(): string[];
}

export type GraphChangeEvent =
  | { type: 'node:added'; node: InterestSeedNode }
  | { type: 'node:updated'; node: InterestSeedNode; previous: InterestSeedNode }
  | { type: 'node:removed'; nodeId: string }
  | { type: 'edge:added'; edge: InterestSeedEdge }
  | { type: 'edge:updated'; edge: InterestSeedEdge; previous: InterestSeedEdge }
  | { type: 'edge:removed'; edgeId: string }
  | { type: 'viewport:changed'; viewport: GraphViewport | undefined }
  | { type: 'graph:replaced'; graph: InterestSeedGraph };

export type GraphStoreErrorCode =
  | 'duplicate-node'
  | 'duplicate-source'
  | 'missing-node'
  | 'invalid-node'
  | 'invalid-edge'
  | 'duplicate-edge';

export class GraphStoreError extends Error {
  constructor(
    readonly code: GraphStoreErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'GraphStoreError';
  }
}

export interface GraphStoreOptions {
  now?: () => string;
  schemaVersion?: number;
}

export interface NodeInput {
  id?: string;
  type?: NodeType;
  title: string;
  sourceUri?: string;
  tags?: readonly string[];
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

/** updateNode / updateEdge 的补丁类型；不可变字段在运行时校验。 */
export type NodeUpdate = Partial<InterestSeedNode>;

export interface EdgeInput {
  id?: string;
  source: string;
  target: string;
  relation: string;
  origin?: RelationOrigin;
  status?: RelationStatus;
  confidence?: number;
  evidence?: readonly string[];
  userRenamed?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type EdgeUpdate = Partial<
  Pick<InterestSeedEdge, 'relation' | 'status' | 'confidence' | 'evidence'>
>;

export interface NeighborQuery {
  relations?: readonly string[];
  origins?: readonly RelationOrigin[];
  statuses?: readonly RelationStatus[];
  direction?: 'both' | 'outgoing' | 'incoming';
}

export interface NeighborEntry {
  edge: InterestSeedEdge;
  node: InterestSeedNode;
}

export interface GraphStats {
  nodes: number;
  /** 全部关系数量（含建议与拒绝），用于库存统计。 */
  edges: number;
  confirmed: number;
  suggested: number;
  rejected: number;
  /** 没有任何 confirmed 关系的节点数。 */
  orphans: number;
  /** 基于 confirmed 关系的平均度。 */
  averageDegree: number;
  byType: Record<NodeType, number>;
}

const ORIGIN_PRIORITY: Record<RelationOrigin, number> = {
  user: 3,
  ai: 2,
  rule: 1,
};

function compareText(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

export function mergeStatus(
  left: RelationStatus,
  right: RelationStatus,
): RelationStatus {
  if (left === 'confirmed' || right === 'confirmed') return 'confirmed';
  if (left === 'rejected' || right === 'rejected') return 'rejected';
  return 'suggested';
}

function uniqueStrings(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

/**
 * 图谱的唯一可变载体。
 *
 * - 内部用 Map 维护索引，对外序列化为数组（`toJSON()` 按 id 排序，稳定可 diff）；
 * - 同一 (source, target, relation) 只会有一条边，重复写入时合并证据与置信度；
 * - 状态合并遵循 confirmed > rejected > suggested，来源合并遵循 user > ai > rule；
 * - 写入通过事件通知订阅者，UI 与持久化层据此刷新。
 */
export class InterestSeedGraphStore implements GraphStore {
  private readonly nodes = new Map<string, InterestSeedNode>();
  private readonly edges = new Map<string, InterestSeedEdge>();
  private readonly edgeIndex = new Map<string, string>();
  private readonly adjacency = new Map<string, Set<string>>();
  private readonly listeners = new Set<(event: GraphChangeEvent) => void>();
  private readonly now: () => string;
  private schemaVersion: number;
  private updatedAt: string;
  private viewport: GraphViewport | undefined;

  constructor(graph?: InterestSeedGraph, options: GraphStoreOptions = {}) {
    this.now = options.now ?? (() => new Date().toISOString());
    this.schemaVersion = options.schemaVersion ?? GRAPH_SCHEMA_VERSION;
    this.updatedAt = this.now();
    if (graph) this.replace(graph, { silent: true });
  }

  static fromJSON(graph: InterestSeedGraph, options: GraphStoreOptions = {}): InterestSeedGraphStore {
    return new InterestSeedGraphStore(graph, options);
  }

  get nodeCount(): number {
    return this.nodes.size;
  }

  get edgeCount(): number {
    return this.edges.size;
  }

  get currentViewport(): GraphViewport | undefined {
    return this.viewport ? { ...this.viewport } : undefined;
  }

  isEmpty(): boolean {
    return this.nodes.size === 0 && this.edges.size === 0;
  }

  // ---------------------------------------------------------------- 节点

  addNode(input: NodeInput): InterestSeedNode {
    const node = this.buildNode(input);
    if (this.nodes.has(node.id)) {
      throw new GraphStoreError('duplicate-node', `节点已存在：${node.id}`);
    }
    if (node.sourceUri) {
      const existing = this.findNodeByUri(node.sourceUri);
      if (existing) {
        throw new GraphStoreError(
          'duplicate-source',
          `同一来源已存在节点：${existing.id}（${node.sourceUri}）`,
        );
      }
    }
    this.nodes.set(node.id, node);
    this.adjacency.set(node.id, new Set());
    this.touch();
    this.emit({ type: 'node:added', node });
    return node;
  }

  /** 先按 id、再按 sourceUri 匹配，匹配到则更新，否则新建。 */
  upsertNode(input: NodeInput): { node: InterestSeedNode; created: boolean } {
    const patch: NodeUpdate = {
      type: input.type,
      title: input.title,
      sourceUri: input.sourceUri,
      tags: input.tags === undefined ? undefined : [...input.tags],
      metadata: input.metadata,
    };

    if (input.id) {
      const byId = this.nodes.get(input.id);
      if (byId) return { node: this.updateNode(byId.id, patch), created: false };
    }

    if (input.sourceUri) {
      const key = normalizeSourceUri(input.sourceUri).toLowerCase();
      for (const node of this.nodes.values()) {
        if (node.sourceUri && node.sourceUri.toLowerCase() === key) {
          return { node: this.updateNode(node.id, patch), created: false };
        }
      }
    }

    return { node: this.addNode(input), created: true };
  }

  getNode(id: string): InterestSeedNode | undefined {
    return this.nodes.get(id);
  }

  requireNode(id: string): InterestSeedNode {
    const node = this.nodes.get(id);
    if (!node) throw new GraphStoreError('missing-node', `节点不存在：${id}`);
    return node;
  }

  findNodeByUri(uri: string): InterestSeedNode | undefined {
    const key = normalizeSourceUri(uri).toLowerCase();
    for (const node of this.nodes.values()) {
      if (node.sourceUri && node.sourceUri.toLowerCase() === key) return node;
    }
    return undefined;
  }

  updateNode(id: string, patch: Partial<InterestSeedNode>): InterestSeedNode {
    const current = this.requireNode(id);

    if (patch.id !== undefined && patch.id !== id) {
      throw new GraphStoreError('invalid-node', '节点 id 不可修改');
    }
    if (patch.createdAt !== undefined && patch.createdAt !== current.createdAt) {
      throw new GraphStoreError('invalid-node', '节点 createdAt 不可修改');
    }
    if (patch.sourceUri !== undefined && patch.sourceUri !== '') {
      const existing = this.findNodeByUri(patch.sourceUri);
      if (existing && existing.id !== id) {
        throw new GraphStoreError(
          'duplicate-source',
          `同一来源已存在节点：${existing.id}（${patch.sourceUri}）`,
        );
      }
    }

    const title = patch.title === undefined ? current.title : patch.title.trim();
    if (!title) throw new GraphStoreError('invalid-node', '节点标题不能为空');

    const type = patch.type ?? current.type;
    if (!isNodeType(type)) {
      throw new GraphStoreError('invalid-node', `未知的节点类型：${String(type)}`);
    }

    const next: InterestSeedNode = {
      ...current,
      title,
      type,
      tags: patch.tags === undefined ? current.tags : sanitizeTags(patch.tags),
      metadata: patch.metadata === undefined ? current.metadata : { ...patch.metadata },
      updatedAt: this.now(),
    };

    if (patch.sourceUri !== undefined) {
      if (patch.sourceUri === '') delete next.sourceUri;
      else next.sourceUri = normalizeSourceUri(patch.sourceUri);
    }

    this.nodes.set(id, next);
    this.touch();
    this.emit({ type: 'node:updated', node: next, previous: current });
    return next;
  }

  /** 删除节点及其全部关联边，返回被删除的边数。 */
  removeNode(id: string): number {
    const node = this.nodes.get(id);
    if (!node) return 0;

    const incident = [...(this.adjacency.get(id) ?? [])];
    for (const edgeId of incident) this.removeEdge(edgeId);

    this.nodes.delete(id);
    this.adjacency.delete(id);
    this.touch();
    this.emit({ type: 'node:removed', nodeId: id });
    return incident.length;
  }

  listNodes(): InterestSeedNode[] {
    return [...this.nodes.values()].sort(
      (left, right) =>
        compareText(left.title, right.title) || compareText(left.id, right.id),
    );
  }

  nodesByType(type: NodeType): InterestSeedNode[] {
    return this.listNodes().filter((node) => node.type === type);
  }

  // ---------------------------------------------------------------- 关系

  addEdge(input: EdgeInput): InterestSeedEdge {
    const source = (input.source ?? '').trim();
    const target = (input.target ?? '').trim();
    const relation = (input.relation ?? '').trim();

    if (!source || !target) {
      throw new GraphStoreError('invalid-edge', '关系必须包含 source 与 target');
    }
    if (source === target) {
      throw new GraphStoreError('invalid-edge', '不支持自环关系');
    }
    if (!relation) {
      throw new GraphStoreError('invalid-edge', '关系必须包含 relation');
    }
    if (!this.nodes.has(source)) {
      throw new GraphStoreError('missing-node', `关系起点不存在：${source}`);
    }
    if (!this.nodes.has(target)) {
      throw new GraphStoreError('missing-node', `关系终点不存在：${target}`);
    }

    const origin = input.origin ?? 'user';
    if (!isRelationOrigin(origin)) {
      throw new GraphStoreError('invalid-edge', `未知的关系来源：${String(origin)}`);
    }
    const status = input.status ?? 'confirmed';
    if (!isRelationStatus(status)) {
      throw new GraphStoreError('invalid-edge', `未知的关系状态：${String(status)}`);
    }

    // 规则与 AI 关系必须解释“为什么”，避免只有置信度没有依据。
    const requiresEvidence = origin === 'rule' || origin === 'ai';
    const inputEvidence = uniqueStrings(input.evidence ?? []);

    const key = this.edgeKey(source, target, relation);
    const existingId = this.edgeIndex.get(key);

    if (existingId) {
      const existing = this.edges.get(existingId);
      if (existing) {
        const evidence = uniqueStrings([
          ...(existing.evidence ?? []),
          ...inputEvidence,
        ]);
        if (requiresEvidence && evidence.length === 0) {
          throw new GraphStoreError(
            'invalid-edge',
            `来源为 ${origin} 的关系必须提供 evidence`,
          );
        }
        const merged: InterestSeedEdge = {
          ...existing,
          origin:
            ORIGIN_PRIORITY[origin] > ORIGIN_PRIORITY[existing.origin]
              ? origin
              : existing.origin,
          status: mergeStatus(existing.status, status),
          updatedAt: input.updatedAt ?? this.now(),
        };
        if (input.confidence !== undefined) {
          merged.confidence = Math.max(existing.confidence ?? 0, clamp01(input.confidence));
        }
        if (evidence.length > 0) merged.evidence = evidence;

        this.edges.set(existing.id, merged);
        this.touch();
        this.emit({ type: 'edge:updated', edge: merged, previous: existing });
        return merged;
      }
    }

    if (requiresEvidence && inputEvidence.length === 0) {
      throw new GraphStoreError(
        'invalid-edge',
        `来源为 ${origin} 的关系必须提供 evidence`,
      );
    }

    let id = (input.id ?? '').trim() || edgeIdFor(source, target, relation);
    if (this.edges.has(id)) {
      const existing = this.edges.get(id);
      if (
        existing &&
        existing.source === source &&
        existing.target === target &&
        existing.relation === relation
      ) {
        throw new GraphStoreError('duplicate-edge', `关系已存在：${id}`);
      }
      // 端点/关系已改名但旧 id 仍占用时，生成新的稳定唯一 id。
      do {
        id = createId('edge');
      } while (this.edges.has(id));
    }

    const createdAt = input.createdAt ?? this.now();
    const edge: InterestSeedEdge = {
      id,
      source,
      target,
      relation,
      origin,
      status,
      createdAt,
      updatedAt: input.updatedAt ?? createdAt,
    };

    if (input.confidence !== undefined) edge.confidence = clamp01(input.confidence);
    if (inputEvidence.length > 0) edge.evidence = inputEvidence;
    if (input.userRenamed === true) edge.userRenamed = true;

    this.edges.set(id, edge);
    this.edgeIndex.set(key, id);
    this.adjacency.get(source)?.add(id);
    this.adjacency.get(target)?.add(id);
    this.touch();
    this.emit({ type: 'edge:added', edge });
    return edge;
  }

  getEdge(id: string): InterestSeedEdge | undefined {
    return this.edges.get(id);
  }

  updateEdge(id: string, patch: Partial<InterestSeedEdge>): InterestSeedEdge {
    const current = this.edges.get(id);
    if (!current) throw new GraphStoreError('invalid-edge', `关系不存在：${id}`);

    if (patch.id !== undefined && patch.id !== id) {
      throw new GraphStoreError('invalid-edge', '关系 id 不可修改');
    }
    if (patch.source !== undefined && patch.source !== current.source) {
      throw new GraphStoreError('invalid-edge', '关系 source 不可修改');
    }
    if (patch.target !== undefined && patch.target !== current.target) {
      throw new GraphStoreError('invalid-edge', '关系 target 不可修改');
    }
    if (patch.createdAt !== undefined && patch.createdAt !== current.createdAt) {
      throw new GraphStoreError('invalid-edge', '关系 createdAt 不可修改');
    }

    const relation =
      patch.relation === undefined ? current.relation : patch.relation.trim();
    if (!relation) throw new GraphStoreError('invalid-edge', '关系名不能为空');

    if (relation !== current.relation) {
      const existingId = this.edgeIndex.get(
        this.edgeKey(current.source, current.target, relation),
      );
      if (existingId && existingId !== id) {
        throw new GraphStoreError(
          'duplicate-edge',
          `已存在相同关系：${current.source} → ${current.target}（${relation}）`,
        );
      }
    }

    const status = patch.status ?? current.status;
    if (!isRelationStatus(status)) {
      throw new GraphStoreError('invalid-edge', `未知的关系状态：${String(status)}`);
    }

    const next: InterestSeedEdge = {
      ...current,
      relation,
      status,
      updatedAt: this.now(),
    };

    // 规则/AI 关系被用户改名时记录保护标记；改回与 ID 对应的原名则清除。
    if (relation !== current.relation && (current.origin === 'rule' || current.origin === 'ai')) {
      if (id === edgeIdFor(current.source, current.target, relation)) {
        delete next.userRenamed;
      } else {
        next.userRenamed = true;
      }
    }
    if (patch.userRenamed !== undefined) {
      if (patch.userRenamed) next.userRenamed = true;
      else delete next.userRenamed;
    }

    if (patch.confidence !== undefined) next.confidence = clamp01(patch.confidence);
    if (patch.evidence !== undefined) {
      const evidence = uniqueStrings(patch.evidence);
      if (evidence.length === 0 && (current.origin === 'rule' || current.origin === 'ai')) {
        throw new GraphStoreError(
          'invalid-edge',
          `来源为 ${current.origin} 的关系必须保留 evidence`,
        );
      }
      if (evidence.length > 0) next.evidence = evidence;
      else delete next.evidence;
    }

    if (relation !== current.relation) {
      this.edgeIndex.delete(this.edgeKey(current.source, current.target, current.relation));
      this.edgeIndex.set(this.edgeKey(next.source, next.target, relation), id);
    }

    this.edges.set(id, next);
    this.touch();
    this.emit({ type: 'edge:updated', edge: next, previous: current });
    return next;
  }

  removeEdge(id: string): boolean {
    const edge = this.edges.get(id);
    if (!edge) return false;

    this.edges.delete(id);
    this.edgeIndex.delete(this.edgeKey(edge.source, edge.target, edge.relation));
    this.adjacency.get(edge.source)?.delete(id);
    this.adjacency.get(edge.target)?.delete(id);
    this.touch();
    this.emit({ type: 'edge:removed', edgeId: id });
    return true;
  }

  listEdges(): InterestSeedEdge[] {
    return [...this.edges.values()].sort(
      (left, right) =>
        compareText(left.source, right.source) ||
        compareText(left.target, right.target) ||
        compareText(left.relation, right.relation) ||
        compareText(left.id, right.id),
    );
  }

  findEdge(
    source: string,
    target: string,
    relation?: string,
  ): InterestSeedEdge | undefined {
    const ids = this.adjacency.get(source);
    if (!ids) return undefined;
    for (const id of ids) {
      const edge = this.edges.get(id);
      if (!edge) continue;
      if (relation && edge.relation !== relation) continue;
      if (edge.source === source && edge.target === target) return edge;
    }
    return undefined;
  }

  areConnected(left: string, right: string): boolean {
    if (left === right) return true;
    const ids = this.adjacency.get(left);
    if (!ids) return false;
    for (const id of ids) {
      const edge = this.edges.get(id);
      if (!edge) continue;
      if (edge.source === right || edge.target === right) return true;
    }
    return false;
  }

  degree(id: string): number {
    return this.adjacency.get(id)?.size ?? 0;
  }

  neighbors(id: string, query: NeighborQuery = {}): NeighborEntry[] {
    const ids = this.adjacency.get(id);
    if (!ids) return [];

    const direction = query.direction ?? 'both';
    const entries: NeighborEntry[] = [];

    for (const edgeId of ids) {
      const edge = this.edges.get(edgeId);
      if (!edge) continue;
      if (query.relations && !query.relations.includes(edge.relation)) continue;
      if (query.origins && !query.origins.includes(edge.origin)) continue;
      if (query.statuses && !query.statuses.includes(edge.status)) continue;

      let otherId: string;
      if (edge.source === id) {
        if (direction === 'incoming') continue;
        otherId = edge.target;
      } else {
        if (direction === 'outgoing') continue;
        otherId = edge.source;
      }

      const node = this.nodes.get(otherId);
      if (!node) continue;
      entries.push({ edge, node });
    }

    entries.sort(
      (left, right) =>
        compareText(left.node.title, right.node.title) ||
        compareText(left.edge.id, right.edge.id),
    );
    return entries;
  }

  // ---------------------------------------------------------------- 整体

  toJSON(): InterestSeedGraph {
    const graph: InterestSeedGraph = {
      schemaVersion: this.schemaVersion,
      updatedAt: this.updatedAt,
      nodes: [...this.nodes.values()].sort((left, right) => compareText(left.id, right.id)),
      edges: [...this.edges.values()].sort((left, right) => compareText(left.id, right.id)),
    };
    if (this.viewport) graph.viewport = { ...this.viewport };
    return graph;
  }

  getGraph(): InterestSeedGraph {
    return this.toJSON();
  }

  /** 返回当前图谱的结构错误；空数组表示合法。 */
  validate(): string[] {
    return validateGraphStructure(this.toJSON());
  }

  replace(graph: InterestSeedGraph, options: { silent?: boolean } = {}): void {
    this.nodes.clear();
    this.edges.clear();
    this.edgeIndex.clear();
    this.adjacency.clear();

    for (const node of graph.nodes ?? []) {
      if (!node || typeof node.id !== 'string' || !node.id) continue;
      if (!isNodeType(node.type)) continue;
      this.nodes.set(node.id, {
        ...node,
        ...(node.sourceUri ? { sourceUri: normalizeSourceUri(node.sourceUri) } : {}),
        tags: sanitizeTags(node.tags),
        metadata: { ...(node.metadata ?? {}) },
      });
      this.adjacency.set(node.id, new Set());
    }

    for (const edge of graph.edges ?? []) {
      if (!edge || typeof edge.id !== 'string') continue;
      if (!this.nodes.has(edge.source) || !this.nodes.has(edge.target)) continue;
      if (edge.source === edge.target) continue;
      if (!isRelationOrigin(edge.origin) || !isRelationStatus(edge.status)) continue;

      this.edges.set(edge.id, { ...edge });
      this.edgeIndex.set(
        this.edgeKey(edge.source, edge.target, edge.relation),
        edge.id,
      );
      this.adjacency.get(edge.source)?.add(edge.id);
      this.adjacency.get(edge.target)?.add(edge.id);
    }

    this.schemaVersion = graph.schemaVersion ?? this.schemaVersion;
    this.updatedAt = graph.updatedAt ?? this.now();
    this.viewport = graph.viewport ? { ...graph.viewport } : undefined;

    if (!options.silent) {
      this.emit({ type: 'graph:replaced', graph: this.toJSON() });
    }
  }

  /** 视口变化不参与撤销与刷新，默认静默，只负责持久化。 */
  setViewport(viewport: GraphViewport | undefined, options: { silent?: boolean } = {}): void {
    this.viewport = viewport ? { ...viewport } : undefined;
    if (options.silent) return;
    this.emit({ type: 'viewport:changed', viewport: this.currentViewport });
  }

  clear(): void {
    if (this.isEmpty() && !this.viewport) return;
    this.nodes.clear();
    this.edges.clear();
    this.edgeIndex.clear();
    this.adjacency.clear();
    this.viewport = undefined;
    this.touch();
    this.emit({ type: 'graph:replaced', graph: this.toJSON() });
  }

  stats(): GraphStats {
    const nodes = this.nodes.size;
    const edges = this.edges.size;
    let confirmed = 0;
    let suggested = 0;
    let rejected = 0;
    let orphans = 0;

    const confirmedNodes = new Set<string>();

    for (const edge of this.edges.values()) {
      if (edge.status === 'confirmed') {
        confirmed += 1;
        confirmedNodes.add(edge.source);
        confirmedNodes.add(edge.target);
      } else if (edge.status === 'suggested') suggested += 1;
      else rejected += 1;
    }

    const byType: Record<NodeType, number> = {
      project: 0,
      document: 0,
      topic: 0,
      image: 0,
      audio: 0,
      video: 0,
      activity: 0,
    };
    for (const node of this.nodes.values()) byType[node.type] += 1;

    for (const node of this.nodes.values()) {
      if (!confirmedNodes.has(node.id) && !node.metadata?.nextStep) orphans += 1;
    }

    return {
      nodes,
      edges,
      confirmed,
      suggested,
      rejected,
      orphans,
      averageDegree: nodes === 0 ? 0 : (confirmed * 2) / nodes,
      byType,
    };
  }

  // ---------------------------------------------------------------- 订阅

  subscribe(listener: (event: GraphChangeEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // ---------------------------------------------------------------- 内部

  private buildNode(input: NodeInput): InterestSeedNode {
    const title = (input.title ?? '').trim();
    if (!title) throw new GraphStoreError('invalid-node', '节点标题不能为空');

    const type = input.type ?? 'document';
    if (!isNodeType(type)) {
      throw new GraphStoreError('invalid-node', `未知的节点类型：${String(type)}`);
    }

    const id = (input.id ?? '').trim() || createId('node');
    const createdAt = input.createdAt ?? this.now();

    const node: InterestSeedNode = {
      id,
      type,
      title,
      tags: sanitizeTags(input.tags ?? []),
      createdAt,
      updatedAt: input.updatedAt ?? createdAt,
      metadata: { ...(input.metadata ?? {}) },
    };

    if (input.sourceUri) node.sourceUri = normalizeSourceUri(input.sourceUri);
    return node;
  }

  private edgeKey(source: string, target: string, relation: string): string {
    return `${source}\u0000${target}\u0000${relation}`;
  }

  private touch(): void {
    this.updatedAt = this.now();
  }

  private emit(event: GraphChangeEvent): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(event);
      } catch (error) {
        console.error('[InterestSeed] 图谱监听器执行失败', error);
      }
    }
  }
}
