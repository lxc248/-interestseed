import { describe, expect, it } from 'vitest';

import { buildExploration } from '../src/discovery/exploration';
import { buildLocalExplorationInsights } from '../src/discovery/insights';
import { buildDiscoveryOverview } from '../src/discovery/overview';
import { emptyDiscoveryFile } from '../src/discovery/types';
import type { Discovery } from '../src/discovery/types';
import { emptyGraph } from '../src/types/graph';

const NOW = '2026-10-28T12:00:00.000Z';

function discovery(overrides: Partial<Discovery>): Discovery {
  return {
    id: 'qa-1',
    kind: 'cross-project-topic',
    title: 'QA 发现',
    description: 'QA 描述',
    nodeIds: ['n1', 'n2'],
    projectKeys: ['P1', 'P2'],
    subjectKeys: ['theme'],
    evidence: [{ kind: 'shared-tag', nodeId: 'n1', text: '证据' }],
    ruleVersion: 'qa',
    strength: 'moderate',
    dedupeKey: 'qa-1',
    status: 'active',
    feedbackStatus: 'none',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe('Independent adversarial inputs', () => {
  it('does not pollute prototypes or crash on invalid/duplicate keys', () => {
    const file = emptyDiscoveryFile(NOW);
    file.discoveries = [
      discovery({
        id: 'qa-proto',
        subjectKeys: ['__proto__', 'constructor', '', 'theme', 'theme'],
        projectKeys: ['__proto__', '', 'P1', 'P1'],
      }),
      discovery({
        id: 'qa-bad-date',
        subjectKeys: [],
        projectKeys: [],
        feedbackHistory: [
          {
            id: 'bad-date',
            action: 'accepted',
            at: 'not-a-date',
            previousStatus: 'none',
          },
        ],
      }),
      discovery({ id: 'qa-dup', subjectKeys: ['theme'], projectKeys: ['P1'] }),
    ];

    const graph = emptyGraph(NOW);
    const overview = buildDiscoveryOverview(file, graph, NOW);
    const exploration = buildExploration(file, NOW);
    const insights = buildLocalExplorationInsights(exploration, overview);

    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(overview.total).toBe(3);
    expect(overview.activity).toHaveLength(7);
    expect(overview.activity.reduce((sum, day) => sum + day.count, 0)).toBe(0);
    expect(exploration.totals.discoveries).toBe(3);
    expect(exploration.matrix.themes.some((theme) => theme.key === 'theme')).toBe(true);
    expect(exploration.matrix.themes.some((theme) => theme.key === 'constructor')).toBe(true);
    expect(exploration.matrix.themes.some((theme) => theme.key === '__proto__')).toBe(true);
    expect(insights.length).toBeLessThanOrEqual(4);
    expect(JSON.stringify(exploration)).toContain('__proto__');
  });

  it('returns stable empty results for an empty discovery file', () => {
    const file = emptyDiscoveryFile(NOW);
    const overview = buildDiscoveryOverview(file, emptyGraph(NOW), NOW);
    const exploration = buildExploration(file, NOW);
    expect(overview.total).toBe(0);
    expect(overview.feedback.none).toBe(0);
    expect(overview.activity).toHaveLength(7);
    expect(exploration.totals.themes).toBe(0);
    expect(exploration.matrix.projects).toEqual([]);
    expect(buildLocalExplorationInsights(exploration, overview)).toEqual([]);
  });
});
