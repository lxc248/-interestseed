import { describe, expect, it } from 'vitest';
import type { InterestSeedEdge, InterestSeedGraph, InterestSeedNode } from '../src/types/graph';
import { GRAPH_SCHEMA_VERSION } from '../src/types/graph';
import {
  validateGraph,
  validateGraphStructure,
} from '../src/utils/validation';

const NOW = '2026-01-01T00:00:00.000Z';

function node(overrides: Partial<InterestSeedNode> = {}): InterestSeedNode {
  return {
    id: 'node-a',
    type: 'document',
    title: 'A',
    tags: [],
    createdAt: NOW,
    updatedAt: NOW,
    metadata: {},
    ...overrides,
  };
}

function edge(overrides: Partial<InterestSeedEdge> = {}): InterestSeedEdge {
  return {
    id: 'edge-1',
    source: 'node-a',
    target: 'node-b',
    relation: 'references',
    origin: 'user',
    status: 'confirmed',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function graph(nodes: InterestSeedNode[], edges: InterestSeedEdge[] = []): InterestSeedGraph {
  return {
    schemaVersion: GRAPH_SCHEMA_VERSION,
    updatedAt: NOW,
    nodes,
    edges,
  };
}

describe('validateGraphStructure', () => {
  it('接受合法图谱', () => {
    expect(
      validateGraphStructure(graph([node(), node({ id: 'node-b', title: 'B' })], [edge()])),
    ).toEqual([]);
  });

  it('拒绝重复节点 / 关系 id、悬空端点和自环', () => {
    const duplicateNodes = validateGraphStructure(
      graph([node(), node()], []),
    );
    expect(duplicateNodes.join(' ')).toContain('节点 id 重复');

    const duplicateEdges = validateGraphStructure(
      graph(
        [node(), node({ id: 'node-b', title: 'B' })],
        [edge(), edge()],
      ),
    );
    expect(duplicateEdges.join(' ')).toContain('关系 id 重复');

    const dangling = validateGraphStructure(
      graph([node()], [edge({ target: 'missing' })]),
    );
    expect(dangling.join(' ')).toContain('target 不存在');

    const selfLoop = validateGraphStructure(
      graph([node()], [edge({ target: 'node-a' })]),
    );
    expect(selfLoop.join(' ')).toContain('自环');
  });

  it('拒绝无效类型、缺失 evidence 和非法 viewport', () => {
    const invalidType = validateGraphStructure(
      graph([node({ type: 'seed' as never })]),
    );
    expect(invalidType.join(' ')).toContain('type 无效');

    const missingEvidence = validateGraphStructure(
      graph(
        [node(), node({ id: 'node-b', title: 'B' })],
        [edge({ origin: 'rule', status: 'suggested' })],
      ),
    );
    expect(missingEvidence.join(' ')).toContain('缺少 evidence');

    const badViewport = validateGraphStructure({
      ...graph([node()]),
      viewport: { zoom: 0, panX: Number.NaN, panY: 0 },
    });
    expect(badViewport.join(' ')).toContain('viewport');
  });
});

describe('validateGraph（读取时清洗）', () => {
  it('保留用户改名保护标记 userRenamed', () => {
    const { graph: cleaned } = validateGraph(
      graph(
        [node(), node({ id: 'node-b', title: 'B' })],
        [
          edge({
            origin: 'rule',
            status: 'suggested',
            evidence: ['共享标签'],
            userRenamed: true,
          }),
        ],
      ),
      NOW,
    );

    expect(cleaned.edges[0]?.userRenamed).toBe(true);
  });

  it('丢弃重复 id、悬空关系和自环，并记录 issues', () => {
    const { graph: cleaned, issues } = validateGraph(
      {
        schemaVersion: GRAPH_SCHEMA_VERSION,
        updatedAt: NOW,
        nodes: [node(), node()],
        edges: [
          edge({ id: 'ok', source: 'node-a', target: 'node-a' }),
          edge({ id: 'dangling', target: 'missing' }),
        ],
      },
      NOW,
    );

    expect(cleaned.nodes).toHaveLength(1);
    expect(cleaned.edges).toHaveLength(0);
    expect(issues.length).toBeGreaterThanOrEqual(3);
  });

  it('为旧规则关系补 evidence，并保留可保存状态', () => {
    const { graph: cleaned, issues } = validateGraph(
      {
        schemaVersion: GRAPH_SCHEMA_VERSION,
        updatedAt: NOW,
        nodes: [node(), node({ id: 'node-b', title: 'B' })],
        edges: [edge({ origin: 'rule', status: 'suggested' })],
      },
      NOW,
    );

    expect(cleaned.edges[0]?.evidence?.length).toBeGreaterThan(0);
    expect(issues.join(' ')).toContain('evidence');
    expect(validateGraphStructure(cleaned)).toEqual([]);
  });

  it('拒绝重复的 sourceUri 与语义重复的关系', () => {
    const duplicateSource = validateGraphStructure(
      graph(
        [
          node({ id: 'a', sourceUri: 'vault:a.md' }),
          node({ id: 'b', title: 'B', sourceUri: 'vault:a.md' }),
        ],
        [],
      ),
    );
    expect(duplicateSource.join(' ')).toContain('sourceUri 重复');

    const duplicateRelation = validateGraphStructure(
      graph(
        [node(), node({ id: 'node-b', title: 'B' })],
        [edge({ id: 'e1' }), edge({ id: 'e2' })],
      ),
    );
    expect(duplicateRelation.join(' ')).toContain('关系重复');
  });

  it('读取时丢弃重复 sourceUri 与语义重复关系', () => {
    const duplicateSource = validateGraph(
      {
        schemaVersion: GRAPH_SCHEMA_VERSION,
        updatedAt: NOW,
        nodes: [
          node({ id: 'a', sourceUri: 'vault:a.md' }),
          node({ id: 'b', title: 'B', sourceUri: 'vault:a.md' }),
        ],
        edges: [],
      },
      NOW,
    );

    expect(duplicateSource.graph.nodes).toHaveLength(1);
    expect(duplicateSource.issues.join(' ')).toContain('sourceUri 重复');

    const duplicateRelation = validateGraph(
      {
        schemaVersion: GRAPH_SCHEMA_VERSION,
        updatedAt: NOW,
        nodes: [node(), node({ id: 'node-b', title: 'B' })],
        edges: [edge({ id: 'e1' }), edge({ id: 'e2' })],
      },
      NOW,
    );

    expect(duplicateRelation.graph.edges).toHaveLength(1);
    expect(duplicateRelation.issues.join(' ')).toContain('关系重复');
  });
});
