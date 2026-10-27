import { describe, expect, it } from 'vitest';

import { buildExploration } from '../src/discovery/exploration';
import { buildLocalExplorationInsights } from '../src/discovery/insights';
import { buildDiscoveryOverview } from '../src/discovery/overview';
import { emptyDiscoveryFile } from '../src/discovery/types';
import type { Discovery } from '../src/discovery/types';

const NOW = '2026-01-01T00:00:00.000Z';

function item(
  id: string,
  projects: string[],
  subjects: string[],
  feedback: Discovery['feedbackStatus'] = 'none',
): Discovery {
  return {
    id,
    kind: 'cross-project-topic',
    title: id,
    description: 'synthetic',
    nodeIds: ['a', 'b'],
    projectKeys: projects,
    subjectKeys: subjects,
    evidence: [],
    ruleVersion: 'v1',
    strength: 'strong',
    dedupeKey: id,
    status: 'active',
    feedbackStatus: feedback,
    application: { state: 'none' },
    createdAt: NOW,
    updatedAt: NOW,
  };
}

describe('theme recognition', () => {
  it('treats each subject as an independent normalized theme', () => {
    const file = emptyDiscoveryFile(NOW);
    file.discoveries = [
      item('d1', ['P1', 'P2'], ['#AI', 'design']),
      item('d2', ['P2'], ['design'], 'accepted'),
      item('d3', [], []),
    ];

    const data = buildExploration(file, NOW);
    expect(data.matrix.themes.map((theme) => theme.key)).toEqual([
      'design',
      '人工智能',
      '未分类主题',
    ]);
    expect(data.matrix.cells.design?.P1).toBe(1);
    expect(data.matrix.cells.design?.P2).toBe(2);
    expect(data.matrix.cells['人工智能']?.P2).toBe(1);
    expect(data.matrix.cells['未分类主题']?.['未归类项目']).toBe(1);
    expect(data.totals.crossProjectThemes).toBe(2);
    expect(data.matrix.themes.find((theme) => theme.key === 'design')?.acceptanceRate).toBe(1);
  });

  it('builds local insights before AI', () => {
    const file = emptyDiscoveryFile(NOW);
    file.discoveries = [
      item('d1', ['P1', 'P2'], ['design']),
      item('d2', ['P2'], ['design'], 'accepted'),
      item('d3', ['P1'], ['ai'], 'low-value'),
      item('d4', ['P1'], ['ai'], 'low-value'),
    ];
    const data = buildExploration(file, NOW);
    const overview = buildDiscoveryOverview(file, { schemaVersion: 2, nodes: [], edges: [], updatedAt: NOW });
    const insights = buildLocalExplorationInsights(data, overview);

    expect(insights.length).toBeGreaterThan(0);
    expect(insights.some((insight) => insight.kind === 'bridge')).toBe(true);
    expect(insights.some((insight) => insight.kind === 'quality')).toBe(true);
    expect(insights.every((insight) => insight.evidence.length > 0)).toBe(true);
    expect(new Set(insights.map((insight) => insight.themes[0])).size).toBe(insights.length);
  });

  it('does not let a tag named __proto__ pollute object prototypes', () => {
    const file = emptyDiscoveryFile(NOW);
    file.discoveries = [item('d1', ['P1'], ['__proto__'])];
    const data = buildExploration(file, NOW);
    expect(data.matrix.cells['__proto__']?.P1).toBe(1);
    expect(({} as Record<string, unknown>).P1).toBeUndefined();
  });
});
