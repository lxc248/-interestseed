import { describe, expect, it } from 'vitest';

import { buildDiscoveryOverview } from '../src/discovery/overview';
import { emptyDiscoveryFile } from '../src/discovery/types';
import type { Discovery } from '../src/discovery/types';
import { emptyGraph } from '../src/types/graph';

const NOW = '2026-01-01T00:00:00.000Z';

function item(overrides: Partial<Discovery>): Discovery {
  return {
    id: 'd1',
    kind: 'cross-project-topic',
    title: '主题',
    description: '说明',
    nodeIds: ['a', 'b'],
    projectKeys: ['P1', 'P2'],
    subjectKeys: ['theme8'],
    evidence: [{ kind: 'source', nodeId: 'a', sourceUri: 'vault:a.md', text: '来源' }],
    ruleVersion: 'v1',
    strength: 'strong',
    dedupeKey: 'd1',
    status: 'active',
    feedbackStatus: 'none',
    application: { state: 'none' },
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe('Discovery overview', () => {
  it('汇总反馈、主题、应用和最近变化', () => {
    const file = emptyDiscoveryFile(NOW);
    file.discoveries = [
      item({
        id: 'd1',
        feedbackStatus: 'accepted',
        feedbackHistory: [
          {
            id: 'd1:accepted:2026-01-01T17:00:00.000Z:0',
            action: 'accepted',
            at: '2026-01-01T17:00:00.000Z',
            previousStatus: 'none',
          },
        ],
      }),
      item({ id: 'd2', feedbackStatus: 'corrected' }),
      item({ id: 'd3', feedbackStatus: 'low-value', status: 'dismissed' }),
      item({ id: 'd4', feedbackStatus: 'rejected', status: 'dismissed' }),
      item({
        id: 'd5',
        application: { state: 'applied', edgeId: 'e1' },
        feedbackStatus: 'accepted',
      }),
    ];
    const graph = emptyGraph(NOW);
    graph.nodes = [
      { id: 'a', type: 'document', title: 'A', tags: [], createdAt: NOW, updatedAt: NOW, metadata: {} },
      { id: 'b', type: 'document', title: 'B', tags: [], createdAt: NOW, updatedAt: NOW, metadata: {} },
    ];
    graph.edges = [
      {
        id: 'e1',
        source: 'a',
        target: 'b',
        relation: 'related-to',
        origin: 'user',
        status: 'confirmed',
        createdAt: NOW,
        updatedAt: NOW,
      },
    ];

    const overview = buildDiscoveryOverview(file, graph, '2026-01-01T12:00:00.000Z');

    expect(overview.total).toBe(5);
    expect(overview.feedback.accepted).toBe(2);
    expect(overview.feedback.corrected).toBe(1);
    expect(overview.feedback['low-value']).toBe(1);
    expect(overview.application.applied).toBe(1);
    expect(overview.appliedEdges).toHaveLength(1);
    expect(overview.themes[0]?.key).toBe('theme8');
    expect(overview.activity).toHaveLength(7);
    expect(overview.activity.at(-1)?.count).toBe(1);
    expect(overview.recent).toHaveLength(5);
  });
});
