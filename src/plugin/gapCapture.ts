import type { GraphSession } from '../core/GraphSession';
import type { Insight } from '../core/InsightEngine';
import { edgeIdFor, hashString, nodeIdForUri } from '../utils/ids';

export function captureGapSeed(input: {
  insight: Insight;
  text: string;
  getNode: (id: string) => unknown;
  addNode: (node: Parameters<GraphSession['addNode']>[0], message: string) => void;
  addEdge: (edge: Parameters<GraphSession['addEdge']>[0], message: string) => void;
  invalidateInsights: () => void;
  notifyStatus: () => void;
  persist: () => void;
  setSelectedNode: (id: string) => void;
}): string | null {
  const value = input.text.trim();
  if (!value) return null;
  const now = new Date().toISOString();
  const id = nodeIdForUri(`interestseed://gap/${hashString(`${input.insight.id}:${value}`)}`);
  if (input.getNode(id)) return id;
  input.addNode(
    {
      id,
      type: 'topic',
      title: value.slice(0, 96),
      tags: ['缺口', '观察'],
      createdAt: now,
      updatedAt: now,
      metadata: {
        gapCoach: true,
        insightId: input.insight.id,
        insightTitle: input.insight.title,
        evidence: input.insight.detail,
      },
    },
    '兴趣缺口：种下一个观察',
  );
  const target = input.insight.nodeIds.find((nodeId) => input.getNode(nodeId));
  if (target) {
    input.addEdge(
      {
        id: edgeIdFor(target, id, '补充观察'),
        source: target,
        target: id,
        relation: '补充观察',
        origin: 'user',
        status: 'suggested',
        evidence: [`来自图谱缺口：${input.insight.title}`],
        createdAt: now,
        updatedAt: now,
      },
      '把观察接到缺口上',
    );
  }
  input.invalidateInsights();
  input.notifyStatus();
  input.persist();
  input.setSelectedNode(id);
  return id;
}
