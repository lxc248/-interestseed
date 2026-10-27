import { describe, expect, it } from 'vitest';
import { InsightEngine } from '../src/core/InsightEngine';
import type {
  InterestSeedEdge,
  InterestSeedGraph,
  InterestSeedNode,
  NodeType,
  RelationStatus,
} from '../src/types/graph';
import { GRAPH_SCHEMA_VERSION } from '../src/types/graph';

const NOW = '2026-01-01T00:00:00.000Z';
const engine = new InsightEngine();

function node(
  id: string,
  title: string,
  type: NodeType = 'document',
  tags: string[] = [],
): InterestSeedNode {
  return {
    id,
    type,
    title,
    tags,
    createdAt: NOW,
    updatedAt: NOW,
    metadata: {},
  };
}

function edge(
  id: string,
  source: string,
  target: string,
  status: RelationStatus,
  relation = 'references',
): InterestSeedEdge {
  return {
    id,
    source,
    target,
    relation,
    origin: 'user',
    status,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function graph(
  nodes: InterestSeedNode[],
  edges: InterestSeedEdge[] = [],
): InterestSeedGraph {
  return {
    schemaVersion: GRAPH_SCHEMA_VERSION,
    updatedAt: NOW,
    nodes,
    edges,
  };
}

function insight(result: ReturnType<InsightEngine['analyze']>, kind: string) {
  return result.insights.find((item) => item.kind === kind);
}

describe('InsightEngine（仅 confirmed 构建核心结构）', () => {
  it('空图谱没有簇、桥、孤立或建议洞察', () => {
    const result = engine.analyze(graph([]));

    expect(result.stats.nodes).toBe(0);
    expect(result.stats.orphans).toBe(0);
    expect(result.clusters).toEqual([]);
    expect(result.bridges).toEqual([]);
    expect(result.insights).toEqual([]);
  });

  it('单节点图谱正确识别孤立节点', () => {
    const result = engine.analyze(graph([node('a', 'A')]));

    expect(result.stats.orphans).toBe(1);
    expect(result.clusters).toEqual([]);
    expect(insight(result, 'orphan')?.nodeIds).toEqual(['a']);
  });

  it('两个节点但无边时不形成簇', () => {
    const result = engine.analyze(graph([node('a', 'A'), node('b', 'B')]));

    expect(result.stats.orphans).toBe(2);
    expect(result.clusters).toEqual([]);
    expect(insight(result, 'cluster')).toBeUndefined();
  });

  it('只有 rejected 关系的两个节点不形成有效主题簇', () => {
    const result = engine.analyze(
      graph(
        [node('a', 'A'), node('b', 'B')],
        [edge('e1', 'a', 'b', 'rejected')],
      ),
    );

    expect(result.clusters).toEqual([]);
    expect(result.stats.orphans).toBe(2);
    expect(result.bridges).toEqual([]);
    expect(insight(result, 'cluster')).toBeUndefined();
    expect(insight(result, 'orphan')?.nodeIds.sort()).toEqual(['a', 'b']);
  });

  it('suggested 关系不会单独让节点脱离孤立状态', () => {
    const result = engine.analyze(
      graph(
        [node('a', 'A'), node('b', 'B')],
        [edge('e1', 'a', 'b', 'suggested')],
      ),
    );

    expect(result.stats.orphans).toBe(2);
    expect(result.clusters).toEqual([]);
    expect(insight(result, 'orphan')?.nodeIds.sort()).toEqual(['a', 'b']);
    expect(insight(result, 'orphan')?.detail).toContain('已确认关系');
  });

  it('confirmed 关系能改变孤立判断并形成主题簇', () => {
    const result = engine.analyze(
      graph(
        [node('a', 'A'), node('b', 'B'), node('c', 'C')],
        [
          edge('e1', 'a', 'b', 'confirmed'),
          edge('e2', 'b', 'c', 'confirmed'),
        ],
      ),
    );

    expect(result.stats.orphans).toBe(0);
    expect(result.clusters).toHaveLength(1);
    expect(result.clusters[0]?.nodeIds).toEqual(['a', 'b', 'c']);
    expect(insight(result, 'cluster')?.nodeIds.sort()).toEqual(['a', 'b', 'c']);
    expect(insight(result, 'orphan')).toBeUndefined();
  });

  it('suggested 关系不会把两个 confirmed 簇合并', () => {
    const result = engine.analyze(
      graph(
        [node('a', 'A'), node('b', 'B'), node('c', 'C'), node('d', 'D')],
        [
          edge('ab', 'a', 'b', 'confirmed'),
          edge('cd', 'c', 'd', 'confirmed'),
          edge('bc', 'b', 'c', 'suggested'),
        ],
      ),
    );

    expect(result.stats.orphans).toBe(0);
    expect(result.clusters).toHaveLength(2);
    expect(result.clusters.map((cluster) => cluster.nodeIds)).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('rejected 关系不会形成桥接节点', () => {
    const result = engine.analyze(
      graph(
        [node('x', 'X'), node('a', 'A'), node('b', 'B'), node('c', 'C')],
        [
          edge('xa', 'x', 'a', 'rejected'),
          edge('xb', 'x', 'b', 'rejected'),
          edge('xc', 'x', 'c', 'rejected'),
        ],
      ),
    );

    expect(result.bridges).toEqual([]);
    expect(result.stats.orphans).toBe(4);
  });

  it('confirmed 关系可以形成桥接节点', () => {
    const result = engine.analyze(
      graph(
        [node('x', 'X'), node('a', 'A'), node('b', 'B'), node('c', 'C')],
        [
          edge('xa', 'x', 'a', 'confirmed'),
          edge('xb', 'x', 'b', 'confirmed'),
          edge('xc', 'x', 'c', 'confirmed'),
        ],
      ),
    );

    expect(result.bridges[0]?.nodeId).toBe('x');
    expect(result.bridges[0]?.componentsAfterRemoval).toBe(3);
    expect(result.stats.orphans).toBe(0);
  });

  it('suggested 关系仍出现在待确认建议中', () => {
    const result = engine.analyze(
      graph(
        [node('a', 'A'), node('b', 'B')],
        [edge('e1', 'a', 'b', 'suggested', 'related-to')],
      ),
    );

    const suggestion = insight(result, 'suggestion');
    expect(suggestion).toBeDefined();
    expect(suggestion?.title).toContain('1');
    expect(suggestion?.detail).toContain('related-to');
    expect(result.clusters).toEqual([]);
  });

  it('confirmed / suggested / rejected 混合时互不污染', () => {
    const result = engine.analyze(
      graph(
        [node('a', 'A'), node('b', 'B'), node('c', 'C'), node('d', 'D')],
        [
          edge('ab', 'a', 'b', 'confirmed'),
          edge('bc', 'b', 'c', 'suggested'),
          edge('cd', 'c', 'd', 'rejected'),
        ],
      ),
    );

    expect(result.stats.confirmed).toBe(1);
    expect(result.stats.suggested).toBe(1);
    expect(result.stats.rejected).toBe(1);
    expect(result.stats.orphans).toBe(2);
    expect(result.clusters).toEqual([{ nodeIds: ['a', 'b'], tags: [], label: '2 个节点' }]);
    expect(insight(result, 'suggestion')?.title).toContain('1');
    expect(insight(result, 'orphan')?.nodeIds.sort()).toEqual(['c', 'd']);
  });

  it('多条边和多个连通分量不会重复统计', () => {
    const result = engine.analyze(
      graph(
        [node('a', 'A'), node('b', 'B'), node('c', 'C'), node('d', 'D'), node('e', 'E')],
        [
          edge('ab1', 'a', 'b', 'confirmed', 'references'),
          edge('ab2', 'a', 'b', 'confirmed', 'related-to'),
          edge('cd', 'c', 'd', 'confirmed'),
        ],
      ),
    );

    expect(result.stats.orphans).toBe(1);
    expect(result.clusters).toHaveLength(2);
    expect(result.clusters.map((cluster) => cluster.nodeIds)).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
    expect(insight(result, 'orphan')?.nodeIds).toEqual(['e']);
  });
});
