import type { InterestSeedEdge, InterestSeedGraph, InterestSeedNode } from '../types/graph';
import { pathFromUri } from '../utils/paths';
import { tagKey } from '../utils/validation';import { compareText } from '../utils/text';
import {
  DISCOVERY_IDENTITY_VERSION,
  DISCOVERY_SCHEMA_VERSION,
  emptyDiscoveryApplication,
  emptyDiscoveryFile,
  type Discovery,
  type DiscoveryEvidence,
  type DiscoveryFile,
} from './types';
import {
  dedupeKeyFor,
  discoveryIdFor,
  evidenceProfile,
  identitySlotKey,
  suppressionKeyFor,
} from './identity';

export const DISCOVERY_RULE_VERSION = 'cross-project-topic-v1';

const MAX_DISCOVERIES = 20;

function uniqueEvidence(items: DiscoveryEvidence[]): DiscoveryEvidence[] {
  const seen = new Set<string>();
  const result: DiscoveryEvidence[] = [];
  for (const item of items) {
    const key = `${item.kind}\u0000${item.nodeId}\u0000${item.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

/**
 * 最小发现规则：跨目录共同主题。
 *
 * 只使用现有图谱数据，不读取正文、不调用网络、不修改图谱。
 * 每个候选都要求至少两个不同顶层目录分组、共享标签，并且每个节点
 * 都有至少一条 confirmed 关系作为额外证据。
 */
export class DiscoveryEngine {
  constructor(
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly ruleVersion: string = DISCOVERY_RULE_VERSION,
  ) {}

  generate(graph: InterestSeedGraph, previous: DiscoveryFile): DiscoveryFile {
    const nodesById = new Map<string, InterestSeedNode>();
    for (const node of graph.nodes) nodesById.set(node.id, node);

    const candidates: Discovery[] = [];

    const groups = new Map<string, InterestSeedNode[]>();
    for (const node of graph.nodes) {
      if (!node.sourceUri) continue;
      if (node.type === 'topic') continue;
      const projectKey = this.projectKeyOf(node);
      if (!projectKey) continue;
      const list = groups.get(projectKey);
      if (list) list.push(node);
      else groups.set(projectKey, [node]);
    }

    const projectKeys = [...groups.keys()].sort(compareText);
    if (projectKeys.length < 2) return this.reconcile(previous, candidates);

    const confirmedByNode = new Map<string, InterestSeedEdge[]>();
    for (const edge of graph.edges) {
      if (edge.status !== 'confirmed') continue;
      if (!nodesById.has(edge.source) || !nodesById.has(edge.target)) continue;
      this.pushEdge(confirmedByNode, edge.source, edge);
      this.pushEdge(confirmedByNode, edge.target, edge);
    }

    const directConfirmed = new Set<string>();
    for (const edge of graph.edges) {
      if (edge.status !== 'confirmed') continue;
      directConfirmed.add(this.pairKey(edge.source, edge.target));
    }

    for (let left = 0; left < projectKeys.length; left += 1) {
      for (let right = left + 1; right < projectKeys.length; right += 1) {
        const projectLeft = projectKeys[left] ?? '';
        const projectRight = projectKeys[right] ?? '';
        const leftGroup = groups.get(projectLeft) ?? [];
        const rightGroup = groups.get(projectRight) ?? [];

        for (const a of leftGroup) {
          for (const b of rightGroup) {
            const discovery = this.consider(
              a,
              b,
              projectLeft,
              projectRight,
              confirmedByNode,
              directConfirmed,
              nodesById,
            );
            if (discovery) candidates.push(discovery);
          }
        }
      }
    }

    // 先按稳定发现 ID 排序，再执行候选上限；避免结果依赖 graph.nodes 输入顺序。
    candidates.sort((left, right) => compareText(left.id, right.id));
    return this.reconcile(previous, candidates.slice(0, MAX_DISCOVERIES));
  }

  private consider(
    a: InterestSeedNode,
    b: InterestSeedNode,
    projectA: string,
    projectB: string,
    confirmedByNode: Map<string, InterestSeedEdge[]>,
    directConfirmed: Set<string>,
    nodesById: Map<string, InterestSeedNode>,
  ): Discovery | null {
    if (directConfirmed.has(this.pairKey(a.id, b.id))) return null;

    const shared = this.sharedTags(a, b);
    if (shared.length === 0) return null;

    const evidenceA = this.confirmedEvidence(a, confirmedByNode, nodesById);
    const evidenceB = this.confirmedEvidence(b, confirmedByNode, nodesById);
    if (evidenceA.length === 0 || evidenceB.length === 0) return null;

    const evidence: DiscoveryEvidence[] = [
      {
        kind: 'source',
        nodeId: a.id,
        sourceUri: a.sourceUri,
        text: `来源：${a.sourceUri ?? ''}`,
      },
      {
        kind: 'source',
        nodeId: b.id,
        sourceUri: b.sourceUri,
        text: `来源：${b.sourceUri ?? ''}`,
      },
      {
        kind: 'shared-tag',
        nodeId: a.id,
        text: `两个节点共享标签：${shared.map((tag) => `#${tag}`).join('、')}`,
      },
      ...evidenceA,
      ...evidenceB,
    ];

    const unique = uniqueEvidence(evidence);
    const nodeIds = [a.id, b.id].sort(compareText);
    const subjectKeys = shared;
    const projectKeys = [projectA, projectB].sort(compareText);
    const dedupeKey = dedupeKeyFor(projectKeys, subjectKeys);
    const suppressionKey = suppressionKeyFor(projectKeys, subjectKeys, unique);
    const id = discoveryIdFor(
      dedupeKey,
      evidenceProfile(unique),
      this.ruleVersion,
    );
    const strength =
      evidenceA.length >= 2 && evidenceB.length >= 2 ? 'strong' : 'moderate';
    const now = this.now();

    return {
      id,
      kind: 'cross-project-topic',
      title: `共同主题：${shared.map((tag) => `#${tag}`).join('、')}`,
      description: `这两份材料来自不同的推定目录，并共享同一主题；它们各自还有已确认关系作为额外证据。`,
      nodeIds,
      projectKeys,
      subjectKeys,
      evidence: unique,
      ruleVersion: this.ruleVersion,
      strength,
      dedupeKey,
      suppressionKey,
      identityVersion: DISCOVERY_IDENTITY_VERSION,
      status: 'active',
      feedbackStatus: 'none',
      application: emptyDiscoveryApplication(),
      createdAt: now,
      updatedAt: now,
    };
  }

  private reconcile(previous: DiscoveryFile, candidates: Discovery[]): DiscoveryFile {
    const slotOf = (item: Discovery): string =>
      identitySlotKey(
        item.identityVersion === 2 ? item.dedupeKey : dedupeKeyFor(item.projectKeys, item.subjectKeys),
        item.nodeIds,
      );
    const activeBySlot = new Map<string, Discovery[]>();
    for (const item of previous.discoveries) {
      if (item.status !== 'active' || item.supersededBy) continue;
      const slot = slotOf(item);
      const list = activeBySlot.get(slot);
      if (list) list.push(item);
      else activeBySlot.set(slot, [item]);
    }
    const statusRank = (item: Discovery): number => {
      const app = item.application?.state;
      const appScore =
        app === 'applied' || app === 'existing'
          ? 4
          : app === 'applying' || app === 'recovery-required'
            ? 3
            : app === 'failed' || app === 'stale'
              ? 2
              : 1;
      const feedbackScore =
        item.feedbackStatus === 'accepted'
          ? 3
          : item.feedbackStatus === 'needs-verification'
            ? 2
            : 1;
      return appScore * 10 + feedbackScore;
    };
    const canonicalBySlot = new Map<string, Discovery>();
    for (const [slot, items] of activeBySlot) {
      const sorted = [...items].sort((left, right) => {
        const byStatus = statusRank(right) - statusRank(left);
        if (byStatus !== 0) return byStatus;
        const byCreated = compareText(left.createdAt, right.createdAt);
        return byCreated !== 0 ? byCreated : compareText(left.id, right.id);
      });
      canonicalBySlot.set(slot, sorted[0]!);
    }
    const normalized: DiscoveryFile = {
      ...previous,
      discoveries: previous.discoveries.map((item) => {
        if (item.status !== 'active') return item;
        const canonical = canonicalBySlot.get(slotOf(item));
        if (!canonical || canonical.id === item.id) return item;
        // 历史重复记录保留原数据，但退出 active 展示；不删除反馈或应用状态。
        return {
          ...item,
          status: 'dismissed',
          supersededBy: canonical.id,
          supersededAt: this.now(),
          updatedAt: this.now(),
        };
      }),
    };

    const byId = new Map<string, Discovery>();
    const bySlot = new Map<string, Discovery>();
    for (const item of normalized.discoveries) {
      byId.set(item.id, item);
      if (item.status !== 'active' || item.supersededBy) continue;
      const slot = slotOf(item);
      if (!bySlot.has(slot)) bySlot.set(slot, item);
    }

    const suppressedKeys = new Set(
      normalized.discoveries
        .filter((item) => item.status === 'dismissed' && item.feedbackStatus === 'rejected')
        .map(
          (item) =>
            item.suppressionKey ??
            suppressionKeyFor(item.projectKeys, item.subjectKeys, item.evidence, item.id),
        ),
    );

    const visibleCandidates = candidates.filter(
      (candidate) =>
        byId.has(candidate.id) || !suppressedKeys.has(candidate.suppressionKey ?? ''),
    );

    const merged: Discovery[] = visibleCandidates.map((candidate) => {
      const existing = bySlot.get(slotOf(candidate)) ?? byId.get(candidate.id);
      if (!existing) return candidate;
      return {
        ...existing,
        kind: candidate.kind,
        title: candidate.title,
        description: candidate.description,
        nodeIds: candidate.nodeIds,
        projectKeys: candidate.projectKeys,
        subjectKeys: candidate.subjectKeys,
        // 发现证据是可重新生成的展示材料；刷新时用当前规则输出替换旧的节点 ID 文本，
        // 不修改 edge.evidence，也不影响用户反馈与稳定 ID。
        evidence: candidate.evidence,
        ruleVersion: candidate.ruleVersion,
        strength: candidate.strength,
        dedupeKey: candidate.dedupeKey,
        suppressionKey: candidate.suppressionKey,
        identityVersion: candidate.identityVersion,
        application: existing.application ?? emptyDiscoveryApplication(),
        updatedAt: candidate.updatedAt,
      };
    });

    const mergedIds = new Set(merged.map((item) => item.id));
    for (const item of normalized.discoveries) {
      if (!mergedIds.has(item.id)) merged.push(item);
    }

    // 持久化顺序保持稳定；反馈排序只在展示层应用，避免启动刷新因排序产生写盘。
    const ordered: Discovery[] = [];
    const mergedById = new Map<string, Discovery>();
    for (const item of merged) {
      if (!mergedById.has(item.id)) mergedById.set(item.id, item);
    }
    for (const item of normalized.discoveries) {
      const current = mergedById.get(item.id);
      if (!current) continue;
      ordered.push(current);
      mergedById.delete(item.id);
    }
    for (const item of merged) {
      const current = mergedById.get(item.id);
      if (!current) continue;
      ordered.push(current);
      mergedById.delete(item.id);
    }

    return {
      discoverySchemaVersion: DISCOVERY_SCHEMA_VERSION,
      identityVersion: ordered.some((item) => item.identityVersion !== 2)
        ? 1
        : DISCOVERY_IDENTITY_VERSION,
      updatedAt: this.now(),
      discoveries: ordered,
    };
  }

  private projectKeyOf(node: InterestSeedNode): string | null {
    const path = node.sourceUri ? pathFromUri(node.sourceUri) : '';
    if (!path) return null;
    const segments = path.split('/').filter(Boolean);
    return segments[0] ?? null;
  }

  private sharedTags(a: InterestSeedNode, b: InterestSeedNode): string[] {
    const left = new Set(a.tags.map((tag) => tagKey(tag)).filter(Boolean));
    const right = new Set(b.tags.map((tag) => tagKey(tag)).filter(Boolean));
    return [...left].filter((tag) => right.has(tag)).sort(compareText);
  }

  private confirmedEvidence(
    node: InterestSeedNode,
    confirmedByNode: Map<string, InterestSeedEdge[]>,
    nodesById: Map<string, InterestSeedNode>,
  ): DiscoveryEvidence[] {
    const edges = (confirmedByNode.get(node.id) ?? []).slice(0, 3);
    return edges.map((edge) => ({
      kind: 'confirmed-edge' as const,
      nodeId: node.id,
      sourceUri: node.sourceUri,
      text: `已确认关系：${this.edgeLabel(edge, node.id, nodesById)}`,
    }));
  }

  private edgeLabel(
    edge: InterestSeedEdge,
    nodeId: string,
    nodesById: Map<string, InterestSeedNode>,
  ): string {
    const other = edge.source === nodeId ? edge.target : edge.source;
    const title = nodesById.get(other)?.title ?? other;
    return `${title}（${edge.relation}）`;
  }

  private pushEdge(
    map: Map<string, InterestSeedEdge[]>,
    nodeId: string,
    edge: InterestSeedEdge,
  ): void {
    const list = map.get(nodeId);
    if (list) list.push(edge);
    else map.set(nodeId, [edge]);
  }

  private pairKey(left: string, right: string): string {
    return [left, right].sort(compareText).join('\u0000');
  }
}

/** 便捷入口，供测试使用。 */
export function generateDiscoveries(
  graph: InterestSeedGraph,
  previous: DiscoveryFile,
  now: () => string = () => new Date().toISOString(),
): DiscoveryFile {
  return new DiscoveryEngine(now).generate(graph, previous);
}

export function emptyDiscoveryStore(now: string): DiscoveryFile {
  return emptyDiscoveryFile(now);
}
