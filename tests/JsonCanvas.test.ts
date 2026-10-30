import { describe, expect, it } from 'vitest';
import { buildJsonCanvas } from '../src/services/jsonCanvas';
import type { InterestSeedGraph } from '../src/types/graph';

const now = '2026-01-01T00:00:00.000Z';

const graph: InterestSeedGraph = {
  schemaVersion: 2,
  updatedAt: now,
  nodes: [
    {
      id: 'a',
      type: 'topic',
      title: '美妆与风格',
      tags: ['风格'],
      createdAt: now,
      updatedAt: now,
      metadata: { taskState: 'experimenting' },
    },
    {
      id: 'b',
      type: 'video',
      title: '跑步',
      tags: ['身体'],
      createdAt: now,
      updatedAt: now,
      metadata: {},
    },
  ],
  edges: [
    {
      id: 'e1',
      source: 'a',
      target: 'b',
      relation: '引出',
      origin: 'user',
      status: 'confirmed',
      createdAt: now,
      updatedAt: now,
    },
  ],
};

describe('json canvas export', () => {
  it('builds a deterministic canvas with resolvable edges', () => {
    const first = buildJsonCanvas(graph);
    const second = buildJsonCanvas(graph);

    expect(first).toEqual(second);
    expect(first.nodes).toHaveLength(2);
    expect(first.edges).toHaveLength(1);

    const ids = new Set(first.nodes.map((node) => node.id));
    expect(ids.size).toBe(2);
    for (const edge of first.edges) {
      expect(ids.has(edge.fromNode)).toBe(true);
      expect(ids.has(edge.toNode)).toBe(true);
    }
  });
});
