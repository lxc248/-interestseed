import { describe, expect, it } from 'vitest';
import { createDefaultFilter, filterGraph } from '../src/ui/FilterBar';
import type { InterestSeedGraph, InterestSeedNode, InterestSeedEdge } from '../src/types/graph';

function largeGraph(size: number): InterestSeedGraph {
  const nodes: InterestSeedNode[] = [];
  const edges: InterestSeedEdge[] = [];
  const now = '2026-01-01T00:00:00.000Z';
  for (let index = 0; index < size; index += 1) {
    const id = `node-${index}`;
    nodes.push({
      id,
      type: index % 2 === 0 ? 'topic' : 'document',
      title: index % 37 === 0 ? '兴趣实验 focus 笔记' : `节点 ${index}`,
      tags: index % 5 === 0 ? ['focus'] : [],
      createdAt: now,
      updatedAt: now,
      metadata: { summary: index % 11 === 0 ? '与行动有关的线索' : `摘要 ${index}` },
    });
    if (index > 0) {
      edges.push({
        id: `edge-${index}`,
        source: `node-${index - 1}`,
        target: id,
        relation: 'references',
        origin: 'rule',
        status: index % 3 === 0 ? 'suggested' : 'confirmed',
        confidence: 0.5 + (index % 5) * 0.1,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  return { schemaVersion: 2, updatedAt: now, nodes, edges };
}

describe('filter performance baseline', () => {
  it('filters 1000 nodes with a query in well under a second per pass', () => {
    const graph = largeGraph(1000);
    const filter = { ...createDefaultFilter(), query: 'focus 行动' };

    // Warm the search index cache.
    filterGraph(graph, filter);

    const started = performance.now();
    for (let index = 0; index < 50; index += 1) filterGraph(graph, filter);
    const elapsed = performance.now() - started;
    const perPass = elapsed / 50;

    expect(perPass).toBeLessThan(25);
  });
});
