import { describe, expect, it } from 'vitest';
import {
  createDefaultFilter,
  filterGraph,
  isEmptyFilter,
  matchesNode,
} from '../src/ui/FilterBar';
import type { InterestSeedEdge, InterestSeedGraph, InterestSeedNode } from '../src/types/graph';
import { GRAPH_SCHEMA_VERSION } from '../src/types/graph';

const NOW = '2026-01-01T00:00:00.000Z';

function makeNode(index: number): InterestSeedNode {
  return {
    id: `node-${index}`,
    type: index % 10 === 0 ? 'project' : 'document',
    title: `Node ${index}`,
    sourceUri: `vault:Projects/Note-${index}.md`,
    tags: index % 2 === 0 ? ['focus'] : ['misc'],
    createdAt: NOW,
    updatedAt: NOW,
    metadata: { path: `Projects/Note-${index}.md` },
  };
}

function makeGraph(count = 100): InterestSeedGraph {
  const nodes = Array.from({ length: count }, (_, index) => makeNode(index));
  const edges: InterestSeedEdge[] = [];

  for (let index = 0; index < count - 1; index += 1) {
    edges.push({
      id: `edge-${index}`,
      source: `node-${index}`,
      target: `node-${index + 1}`,
      relation: 'references',
      origin: 'user',
      status: 'confirmed',
      confidence: 1,
      evidence: ['测试关系'],
      createdAt: NOW,
      updatedAt: NOW,
    });
  }

  return {
    schemaVersion: GRAPH_SCHEMA_VERSION,
    updatedAt: NOW,
    nodes,
    edges,
  };
}

describe('FilterBar / 搜索与过滤', () => {
  it('按标题搜索，且不修改底层图谱', () => {
    const graph = makeGraph();
    const originalNodes = [...graph.nodes];
    const originalEdges = [...graph.edges];

    const filtered = filterGraph(graph, {
      ...createDefaultFilter(),
      query: 'Node 42',
    });

    expect(filtered.nodeCount).toBe(1);
    expect(filtered.graph.nodes[0]?.title).toBe('Node 42');
    expect(graph.nodes).toHaveLength(100);
    expect(graph.edges).toHaveLength(99);
    expect(graph.nodes[0]).toBe(originalNodes[0]);
    expect(graph.edges[0]).toBe(originalEdges[0]);
  });

  it('按标签与目录筛选', () => {
    const graph = makeGraph();
    const base = createDefaultFilter();

    expect(filterGraph(graph, { ...base, tag: 'focus' }).nodeCount).toBe(50);
    expect(filterGraph(graph, { ...base, tag: '#focus' }).nodeCount).toBe(50);
    expect(filterGraph(graph, { ...base, query: '#focus' }).nodeCount).toBe(50);
    expect(filterGraph(graph, { ...base, folder: 'Projects' }).nodeCount).toBe(100);
    expect(filterGraph(graph, { ...base, folder: 'Projects/Sub' }).nodeCount).toBe(0);
    expect(filterGraph(graph, { ...base, folder: 'Projects/Note-42.md' }).nodeCount).toBe(1);
  });

  it('清空搜索后恢复全部节点，连续查询只取最后一次', () => {
    const graph = makeGraph();
    const base = createDefaultFilter();

    expect(filterGraph(graph, { ...base, query: 'Node 99' }).nodeCount).toBe(1);
    expect(filterGraph(graph, { ...base, query: '' }).nodeCount).toBe(100);
    expect(filterGraph(graph, { ...base, query: '不存在的节点' }).nodeCount).toBe(0);
  });

  it('组合搜索、类型、目录与标签过滤', () => {
    const graph = makeGraph();

    const filtered = filterGraph(graph, {
      ...createDefaultFilter(),
      query: 'Node',
      folder: 'Projects',
      tag: 'focus',
      types: ['project'],
    });

    expect(filtered.nodeCount).toBe(10);
    for (const node of filtered.graph.nodes) {
      expect(node.type).toBe('project');
      expect(node.tags).toContain('focus');
    }
  });

  it('过滤边时不会显示悬空关系', () => {
    const graph = makeGraph(2);
    graph.edges.push({
      id: 'dangling',
      source: 'node-0',
      target: 'missing',
      relation: 'references',
      origin: 'user',
      status: 'confirmed',
      createdAt: NOW,
      updatedAt: NOW,
    });

    const filtered = filterGraph(graph, createDefaultFilter());
    expect(filtered.graph.edges.some((edge) => edge.id === 'dangling')).toBe(false);
  });

  it('100 节点过滤保持在可接受的时间范围内', () => {
    const graph = makeGraph(100);
    const filter = { ...createDefaultFilter(), tag: 'focus', query: 'Node' };

    const started = performance.now();
    for (let index = 0; index < 20; index += 1) filterGraph(graph, filter);
    const elapsed = performance.now() - started;

    expect(elapsed).toBeLessThan(1000);
  });

  it('默认筛选被视为未筛选，显式条件才算筛选', () => {
    const base = createDefaultFilter();
    expect(isEmptyFilter(base)).toBe(true);
    expect(isEmptyFilter({ ...base, query: 'w' })).toBe(false);
    expect(isEmptyFilter({ ...base, tag: 'focus' })).toBe(false);
    expect(isEmptyFilter({ ...base, statuses: ['confirmed'] })).toBe(false);
    expect(isEmptyFilter({ ...base, statuses: ['confirmed', 'suggested', 'rejected'] })).toBe(
      true,
    );
  });

  it('matchesNode 对缺失路径和 metadata 的节点保持稳定', () => {
    const node: InterestSeedNode = {
      id: 'manual',
      type: 'topic',
      title: '手动主题',
      tags: [],
      createdAt: NOW,
      updatedAt: NOW,
      metadata: {},
    };

    expect(matchesNode(node, createDefaultFilter())).toBe(true);
    expect(matchesNode(node, { ...createDefaultFilter(), folder: 'Projects' })).toBe(false);
  });

  it('搜索来源、为什么和观察时间线', () => {
    const node: InterestSeedNode = {
      id: 'context',
      type: 'topic',
      title: '用户观察',
      tags: ['设计'],
      createdAt: NOW,
      updatedAt: NOW,
      metadata: {
        why: '想让我做的东西被看见',
        sourceRef: '研究/访谈.md',
        observations: [
          {
            id: 'o1',
            at: NOW,
            source: 'note',
            evidence: '今天真的观察了一次',
            belief: 'stronger',
          },
        ],
      },
    };

    expect(matchesNode(node, { ...createDefaultFilter(), query: '访谈' })).toBe(true);
    expect(matchesNode(node, { ...createDefaultFilter(), query: '被看见' })).toBe(true);
    expect(matchesNode(node, { ...createDefaultFilter(), query: '观察 今天' })).toBe(true);
    expect(matchesNode(node, { ...createDefaultFilter(), query: '不存在' })).toBe(false);
  });
});
