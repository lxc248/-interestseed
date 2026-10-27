import type {
  InterestSeedEdge,
  InterestSeedGraph,
  InterestSeedNode,
} from '../src/types/graph';
import { emptyGraph } from '../src/types/graph';
import type { Discovery, DiscoveryFile } from '../src/discovery/types';
import { hash64 } from '../src/utils/ids';

export const QUALITY_NOW = '2026-01-01T00:00:00.000Z';

export function qualityNode(
  id: string,
  path: string,
  tags: string[],
  sourceUri: string | undefined = `vault:${path}`,
  title = id,
): InterestSeedNode {
  return {
    id,
    type: 'document',
    title,
    sourceUri,
    tags,
    createdAt: QUALITY_NOW,
    updatedAt: QUALITY_NOW,
    metadata: { path },
  };
}

export function qualityEdge(
  id: string,
  source: string,
  target: string,
  status: 'confirmed' | 'suggested' | 'rejected' = 'confirmed',
  relation = 'related-to',
): InterestSeedEdge {
  return {
    id,
    source,
    target,
    relation,
    origin: 'rule',
    status,
    confidence: 0.6,
    evidence: [`${source} 与 ${target} 的测试证据`],
    createdAt: QUALITY_NOW,
    updatedAt: QUALITY_NOW,
  };
}

export function qualityGraph(
  nodes: InterestSeedNode[],
  edges: InterestSeedEdge[],
): InterestSeedGraph {
  return { ...emptyGraph(QUALITY_NOW), nodes, edges };
}

export function pairKey(left: string, right: string): string {
  return [left, right].sort().join('\u0000');
}

export function discoveryPairKey(discovery: Discovery): string {
  const [left, right] = discovery.nodeIds;
  return left && right ? pairKey(left, right) : '';
}

/**
 * 固定质量夹具：
 * - P1/a1,a2 与 P2/b1,b2 是 4 个应发现节点对；
 * - 其余节点分别覆盖无标签、无确认关系、无 sourceUri、直接确认、仅 suggested、同目录。
 */
export function qualityFixture(): {
  graph: InterestSeedGraph;
  expectedPairs: string[];
  positiveNodeIds: string[];
} {
  const positive = [
    qualityNode('a1', 'P1/a1.md', ['shared', 'topic2'], undefined, 'A1'),
    qualityNode('a2', 'P1/a2.md', ['shared', 'topic2'], undefined, 'A2'),
    qualityNode('b1', 'P2/b1.md', ['shared', 'topic2'], undefined, 'B1'),
    qualityNode('b2', 'P2/b2.md', ['shared', 'topic2'], undefined, 'B2'),
  ];
  const boundary = [
    qualityNode('no-tag1', 'P1/no-tag1.md', [], undefined, 'NoTag1'),
    qualityNode('no-tag2', 'P2/no-tag2.md', [], undefined, 'NoTag2'),
    qualityNode(
      'no-confirmed1',
      'P1/no-confirmed1.md',
      ['needs-evidence'],
      undefined,
      'NoConfirmed1',
    ),
    qualityNode(
      'no-confirmed2',
      'P2/no-confirmed2.md',
      ['needs-evidence'],
      undefined,
      'NoConfirmed2',
    ),
    qualityNode('no-source', 'P1/no-source.md', ['shared'], '', 'NoSource'),
    qualityNode('direct1', 'P1/direct1.md', ['direct'], undefined, 'Direct1'),
    qualityNode('direct2', 'P2/direct2.md', ['direct'], undefined, 'Direct2'),
    qualityNode('sugg1', 'P1/sugg1.md', ['suggested'], undefined, 'Sugg1'),
    qualityNode('sugg2', 'P2/sugg2.md', ['suggested'], undefined, 'Sugg2'),
    qualityNode('same1', 'P1/same1.md', ['same-topic'], undefined, 'Same1'),
    qualityNode('same2', 'P1/same2.md', ['same-topic'], undefined, 'Same2'),
  ];
  const edges = [
    qualityEdge('e-a1-a2', 'a1', 'a2'),
    qualityEdge('e-b1-b2', 'b1', 'b2'),
    qualityEdge('e-direct', 'direct1', 'direct2'),
    qualityEdge('e-suggested', 'sugg1', 'sugg2', 'suggested'),
  ];
  return {
    graph: qualityGraph([...positive, ...boundary], edges),
    expectedPairs: [
      pairKey('a1', 'b1'),
      pairKey('a1', 'b2'),
      pairKey('a2', 'b1'),
      pairKey('a2', 'b2'),
    ],
    positiveNodeIds: positive.map((node) => node.id),
  };
}

/** 6 × 6 = 36 个应发现节点对，用于验证 MAX_DISCOVERIES=20 截断。 */
export function bulkQualityFixture(): {
  graph: InterestSeedGraph;
  expectedPairs: string[];
} {
  const p1 = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'].map((id) =>
    qualityNode(id, `P1/${id}.md`, ['bulk'], undefined, id.toUpperCase()),
  );
  const p2 = ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'].map((id) =>
    qualityNode(id, `P2/${id}.md`, ['bulk'], undefined, id.toUpperCase()),
  );
  const edges = [
    qualityEdge('e-a1-a2', 'a1', 'a2'),
    qualityEdge('e-a3-a4', 'a3', 'a4'),
    qualityEdge('e-a5-a6', 'a5', 'a6'),
    qualityEdge('e-b1-b2', 'b1', 'b2'),
    qualityEdge('e-b3-b4', 'b3', 'b4'),
    qualityEdge('e-b5-b6', 'b5', 'b6'),
  ];
  return {
    graph: qualityGraph([...p1, ...p2], edges),
    expectedPairs: p1.flatMap((left) => p2.map((right) => pairKey(left.id, right.id))),
  };
}

/** 4 × 5 = 20 个节点对，用于截断等值边界。 */
export function equalTwentyQualityFixture(): {
  graph: InterestSeedGraph;
  expectedPairs: string[];
} {
  const p1 = ['a1', 'a2', 'a3', 'a4'].map((id) =>
    qualityNode(id, `P1/${id}.md`, ['bulk'], undefined, id.toUpperCase()),
  );
  const p2 = ['b1', 'b2', 'b3', 'b4', 'b5'].map((id) =>
    qualityNode(id, `P2/${id}.md`, ['bulk'], undefined, id.toUpperCase()),
  );
  const edges = [
    qualityEdge('e-a1-a2', 'a1', 'a2'),
    qualityEdge('e-a3-a4', 'a3', 'a4'),
    qualityEdge('e-b1-b2', 'b1', 'b2'),
    qualityEdge('e-b3-b4', 'b3', 'b4'),
    qualityEdge('e-b5-b1', 'b5', 'b1'),
  ];
  return {
    graph: qualityGraph([...p1, ...p2], edges),
    expectedPairs: p1.flatMap((left) => p2.map((right) => pairKey(left.id, right.id))),
  };
}

/** 2 × 4 = 8 个同主题节点对，用于 4–8 张卡片体验验证。 */
export function eightThemeFixture(): {
  graph: InterestSeedGraph;
  expectedPairs: string[];
} {
  const p1 = ['a1', 'a2'].map((id) =>
    qualityNode(id, `P1/${id}.md`, ['theme8'], undefined, id.toUpperCase()),
  );
  const p2 = ['b1', 'b2', 'b3', 'b4'].map((id) =>
    qualityNode(id, `P2/${id}.md`, ['theme8'], undefined, id.toUpperCase()),
  );
  const edges = [
    qualityEdge('e-a1-a2', 'a1', 'a2'),
    qualityEdge('e-b1-b2', 'b1', 'b2'),
    qualityEdge('e-b3-b4', 'b3', 'b4'),
  ];
  return {
    graph: qualityGraph([...p1, ...p2], edges),
    expectedPairs: p1.flatMap((left) => p2.map((right) => pairKey(left.id, right.id))),
  };
}

/** 复现 fixture 候选 ID 计算，仅用于设计方案比较测试。 */
export function fixtureDiscoveryId(left: string, right: string): string {
  const nodeIds = [left, right].sort();
  const input = [
    'cross-project-topic',
    nodeIds.join('\u0000'),
    'P1\u0000P2',
    'bulk',
  ].join('|');
  return `discovery_${hash64(input)}`;
}

export interface QualityStats {
  expectedCount: number;
  actualCount: number;
  falsePositives: string[];
  falseNegatives: string[];
  duplicateThemeGroups: number;
  duplicateThemeNodePairs: number;
  missingEvidence: string[];
  untraceableEvidence: string[];
  samePairDifferentIds: string[];
}

/**
 * 仅统计测试夹具中明确标注的预期节点对。
 * 不把“多节点对共享标签”直接视为错误；只记录重复主题组。
 */
export function qualityStats(
  file: DiscoveryFile,
  graph: InterestSeedGraph,
  expectedPairs: string[],
): QualityStats {
  const expected = new Set(expectedPairs);
  const actual = new Set(file.discoveries.map(discoveryPairKey));
  const falsePositives = [...actual].filter((key) => !expected.has(key));
  const falseNegatives = [...expected].filter((key) => !actual.has(key));

  const byTheme = new Map<string, Discovery[]>();
  for (const discovery of file.discoveries) {
    const theme = [...discovery.subjectKeys].sort().join('\u0000');
    const list = byTheme.get(theme);
    if (list) list.push(discovery);
    else byTheme.set(theme, [discovery]);
  }
  const duplicateGroups = [...byTheme.values()].filter((items) => items.length > 1);

  const pairIds = new Map<string, string[]>();
  for (const discovery of file.discoveries) {
    const key = discoveryPairKey(discovery);
    const list = pairIds.get(key);
    if (list) list.push(discovery.id);
    else pairIds.set(key, [discovery.id]);
  }
  const samePairDifferentIds = [...pairIds.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([key]) => key);

  const missingEvidence: string[] = [];
  const untraceableEvidence: string[] = [];
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  for (const discovery of file.discoveries) {
    const sources = discovery.evidence.filter((item) => item.kind === 'source');
    const shared = discovery.evidence.filter((item) => item.kind === 'shared-tag');
    const confirmed = discovery.evidence.filter(
      (item) => item.kind === 'confirmed-edge',
    );
    const sourceNodes = new Set(sources.map((item) => item.nodeId));
    if (
      sourceNodes.size < 2 ||
      shared.length === 0 ||
      discovery.nodeIds.some(
        (nodeId) => !confirmed.some((item) => item.nodeId === nodeId),
      )
    ) {
      missingEvidence.push(discovery.id);
    }

    for (const evidence of discovery.evidence) {
      const node = nodeById.get(evidence.nodeId);
      if (!node) {
        untraceableEvidence.push(`${discovery.id}:${evidence.text}`);
        continue;
      }
      const traceable =
        evidence.text.trim().length > 0 &&
        (evidence.kind !== 'source' ||
          evidence.sourceUri === node.sourceUri) &&
        (evidence.kind !== 'shared-tag' || evidence.text.includes('#')) &&
        (evidence.kind !== 'confirmed-edge' ||
          evidence.text.startsWith('已确认关系：'));
      if (!traceable) untraceableEvidence.push(`${discovery.id}:${evidence.text}`);
    }
  }

  return {
    expectedCount: expected.size,
    actualCount: file.discoveries.length,
    falsePositives,
    falseNegatives,
    duplicateThemeGroups: duplicateGroups.length,
    duplicateThemeNodePairs: duplicateGroups.reduce(
      (sum, items) => sum + items.length,
      0,
    ),
    missingEvidence,
    untraceableEvidence,
    samePairDifferentIds,
  };
}
