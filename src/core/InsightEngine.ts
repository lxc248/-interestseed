import type { InterestSeedGraph, NodeType, RelationStatus } from '../types/graph';import { compareText } from '../utils/text';
import { InterestSeedGraphStore, type GraphStats } from './GraphStore';

export type InsightKind = 'cluster' | 'bridge' | 'suggestion' | 'orphan' | 'coverage';

export interface Insight {
  id: string;
  kind: InsightKind;
  title: string;
  detail: string;
  nodeIds: string[];
  score: number;
}

export interface ClusterSummary {
  nodeIds: string[];
  tags: string[];
  label: string;
}

export interface BridgeCandidate {
  nodeId: string;
  title: string;
  componentsAfterRemoval: number;
  degree: number;
}

export interface GraphInsights {
  stats: GraphStats;
  clusters: ClusterSummary[];
  bridges: BridgeCandidate[];
  insights: Insight[];
  generatedAt: string;
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

const MAX_INSIGHTS = 12;
const MAX_BRIDGE_CANDIDATES = 60;
const CONFIRMED_STATUSES: ReadonlySet<RelationStatus> = new Set(['confirmed']);

function buildAdjacency(
  graph: InterestSeedGraph,
  statuses: ReadonlySet<RelationStatus> = CONFIRMED_STATUSES,
): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>();
  for (const node of graph.nodes) adjacency.set(node.id, new Set());

  for (const edge of graph.edges) {
    if (!statuses.has(edge.status)) continue;
    if (!adjacency.has(edge.source) || !adjacency.has(edge.target)) continue;
    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  }

  return adjacency;
}

function connectedComponents(adjacency: Map<string, Set<string>>): string[][] {
  const visited = new Set<string>();
  const components: string[][] = [];

  for (const start of [...adjacency.keys()].sort(compareText)) {
    if (visited.has(start)) continue;

    const queue: string[] = [start];
    const component: string[] = [];
    visited.add(start);

    while (queue.length > 0) {
      const current = queue.pop();
      if (!current) continue;
      component.push(current);
      for (const next of adjacency.get(current) ?? []) {
        if (visited.has(next)) continue;
        visited.add(next);
        queue.push(next);
      }
    }

    component.sort(compareText);
    components.push(component);
  }

  return components;
}

function countComponents(
  ids: string[],
  adjacency: Map<string, Set<string>>,
  excluded: ReadonlySet<string>,
): number {
  const visited = new Set<string>(excluded);
  let count = 0;

  for (const id of ids) {
    if (visited.has(id)) continue;
    count += 1;
    const queue: string[] = [id];
    visited.add(id);

    while (queue.length > 0) {
      const current = queue.pop();
      if (!current) continue;
      for (const next of adjacency.get(current) ?? []) {
        if (visited.has(next)) continue;
        visited.add(next);
        queue.push(next);
      }
    }
  }

  return count;
}

function topTags(graph: InterestSeedGraph, nodeIds: string[], limit: number): string[] {
  const counts = new Map<string, number>();
  const byId = new Map(graph.nodes.map((node) => [node.id, node] as const));

  for (const id of nodeIds) {
    const node = byId.get(id);
    if (!node) continue;
    for (const tag of node.tags) {
      const key = tag.toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || compareText(left[0], right[0]))
    .slice(0, limit)
    .map(([tag]) => tag);
}

/**
 * 洞察引擎：把图谱翻译成可执行的下一步。
 *
 * 输出主题簇、桥接节点、待确认建议、孤立节点与类型覆盖情况。
 */
export class InsightEngine {
  analyze(graph: InterestSeedGraph, options: { now?: () => string } = {}): GraphInsights {
    const now = options.now ?? (() => new Date().toISOString());
    const adjacency = buildAdjacency(graph, CONFIRMED_STATUSES);
    const components = connectedComponents(adjacency);
    const bridges = this.bridges(graph, 5, adjacency);
    const stats = InterestSeedGraphStore.fromJSON(graph).stats();

    const clusters: ClusterSummary[] = components
      .filter((component) => component.length >= 2)
      .slice(0, 6)
      .map((nodeIds) => {
        const tags = topTags(graph, nodeIds, 3);
        return {
          nodeIds,
          tags,
          label: tags.length > 0 ? tags.map((tag) => `#${tag}`).join(' ') : `${nodeIds.length} 个节点`,
        };
      });

    const insights = this.buildInsights(graph, stats, components, bridges, adjacency);

    return { stats, clusters, bridges, insights, generatedAt: now() };
  }

  stats(graph: InterestSeedGraph): GraphStats {
    return InterestSeedGraphStore.fromJSON(graph).stats();
  }

  clusters(graph: InterestSeedGraph): ClusterSummary[] {
    const adjacency = buildAdjacency(graph, CONFIRMED_STATUSES);
    return connectedComponents(adjacency)
      .filter((component) => component.length >= 2)
      .map((nodeIds) => {
        const tags = topTags(graph, nodeIds, 3);
        return {
          nodeIds,
          tags,
          label: tags.length > 0 ? tags.map((tag) => `#${tag}`).join(' ') : `${nodeIds.length} 个节点`,
        };
      });
  }

  /** 近似桥接节点：移除后连通块数量增加的枢纽。 */
  bridges(
    graph: InterestSeedGraph,
    limit = 5,
    adjacency: Map<string, Set<string>> = buildAdjacency(graph, CONFIRMED_STATUSES),
  ): BridgeCandidate[] {
    const ids = graph.nodes.map((node) => node.id);
    const base = countComponents(ids, adjacency, new Set());

    const candidates = ids
      .map((id) => ({ id, degree: adjacency.get(id)?.size ?? 0 }))
      .filter((candidate) => candidate.degree >= 3)
      .sort((left, right) => right.degree - left.degree || compareText(left.id, right.id))
      .slice(0, MAX_BRIDGE_CANDIDATES);

    const result: BridgeCandidate[] = [];
    for (const candidate of candidates) {
      const after = countComponents(ids, adjacency, new Set([candidate.id]));
      if (after <= base) continue;
      result.push({
        nodeId: candidate.id,
        title: graph.nodes.find((node) => node.id === candidate.id)?.title ?? candidate.id,
        componentsAfterRemoval: after,
        degree: candidate.degree,
      });
    }

    result.sort(
      (left, right) =>
        right.componentsAfterRemoval - left.componentsAfterRemoval ||
        right.degree - left.degree ||
        compareText(left.nodeId, right.nodeId),
    );

    return result.slice(0, limit);
  }

  private buildInsights(
    graph: InterestSeedGraph,
    stats: GraphStats,
    components: string[][],
    bridges: BridgeCandidate[],
    adjacency: Map<string, Set<string>>,
  ): Insight[] {
    const insights: Insight[] = [];
    const nodes = graph.nodes;

    const largest = [...components].sort((left, right) => right.length - left.length);
    for (const component of largest.slice(0, 3)) {
      if (component.length < 3) continue;
      const tags = topTags(graph, component, 3);
      insights.push({
        id: `cluster:${component[0] ?? 'root'}`,
        kind: 'cluster',
        title: tags.length > 0 ? `主题簇：${tags.map((tag) => `#${tag}`).join(' ')}` : '主题簇',
        detail: `${component.length} 个节点彼此相连，可以顺着这条线继续整理。`,
        nodeIds: component.slice(0, 12),
        score: component.length * 2,
      });
    }

    for (const bridge of bridges.slice(0, 3)) {
      insights.push({
        id: `bridge:${bridge.nodeId}`,
        kind: 'bridge',
        title: `桥接节点：${bridge.title}`,
        detail: `移除后图谱会裂成 ${bridge.componentsAfterRemoval} 个部分，它是不同项目之间的枢纽。`,
        nodeIds: [bridge.nodeId],
        score: 10 + bridge.componentsAfterRemoval,
      });
    }

    const suggested = graph.edges
      .filter((edge) => edge.status === 'suggested')
      .sort((left, right) => (right.confidence ?? 0) - (left.confidence ?? 0))
      .slice(0, 3);

    if (suggested.length > 0) {
      const byId = new Map(nodes.map((node) => [node.id, node] as const));
      const lines = suggested.map((edge) => {
        const source = byId.get(edge.source)?.title ?? edge.source;
        const target = byId.get(edge.target)?.title ?? edge.target;
        const confidence = Math.round((edge.confidence ?? 0) * 100);
        return `「${source}」—「${target}」（${confidence}%，${edge.relation}）`;
      });
      insights.push({
        id: 'suggestion',
        kind: 'suggestion',
        title: `待确认的关系（${stats.suggested}）`,
        detail: lines.join('\n'),
        nodeIds: suggested.flatMap((edge) => [edge.source, edge.target]),
        score: 8 + stats.suggested / 10,
      });
    }

    const orphans = nodes
      .filter(
        (node) =>
          (adjacency.get(node.id)?.size ?? 0) === 0 && !node.metadata?.nextStep,
      )
      .sort((left, right) => compareText(left.title, right.title));

    if (orphans.length > 0) {
      insights.push({
        id: 'orphan',
        kind: 'orphan',
        title: '孤立节点',
        detail: `${orphans.length} 个节点还没有已确认关系：${orphans
          .slice(0, 4)
          .map((node) => node.title)
          .join('、')}`,
        nodeIds: orphans.slice(0, 6).map((node) => node.id),
        score: 4 + Math.min(orphans.length, 6),
      });
    }

    if (nodes.length > 0) {
      const missing = (Object.keys(TYPE_LABELS) as NodeType[]).filter(
        (type) => stats.byType[type] === 0,
      );
      const important = missing.filter((type) =>
        type === 'project' || type === 'topic' || type === 'activity',
      );
      if (important.length > 0) {
        insights.push({
          id: 'coverage',
          kind: 'coverage',
          title: '类型覆盖不完整',
          detail: `图谱里还没有${important
            .map((type) => TYPE_LABELS[type])
            .join(' / ')}节点。用 frontmatter 的 type 字段可以把笔记标记成项目或活动。`,
          nodeIds: [],
          score: 1.5,
        });
      }
    }

    return insights
      .sort((left, right) => right.score - left.score || compareText(left.id, right.id))
      .slice(0, MAX_INSIGHTS);
  }
}
