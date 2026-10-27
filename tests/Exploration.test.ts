import { describe, expect, it } from 'vitest';

import { buildExploration } from '../src/discovery/exploration';
import { emptyDiscoveryFile } from '../src/discovery/types';
import type { Discovery } from '../src/discovery/types';

const NOW = '2026-01-01T00:00:00.000Z';

function item(id: string, projectKeys: string[], subjectKeys: string[], status: Discovery['status'] = 'active'): Discovery {
  return {
    id,
    kind: 'cross-project-topic',
    title: '主题',
    description: '说明',
    nodeIds: ['a', 'b'],
    projectKeys,
    subjectKeys,
    evidence: [],
    ruleVersion: 'v1',
    strength: 'strong',
    dedupeKey: id,
    status,
    feedbackStatus: 'none',
    application: { state: 'none' },
    createdAt: NOW,
    updatedAt: NOW,
  };
}

describe('Discovery exploration matrix', () => {
  it('按主题与项目聚合，并排序活动主题', () => {
    const file = emptyDiscoveryFile(NOW);
    file.discoveries = [
      item('d1', ['P1', 'P2'], ['theme8']),
      item('d2', ['P1'], ['theme8']),
      item('d3', ['P2'], ['theme9'], 'dismissed'),
      item('d4', [], []),
    ];

    const data = buildExploration(file, NOW);
    expect(data.matrix.projects).toEqual(['P1', 'P2', '未归类项目']);
    expect(data.matrix.themes[0]?.key).toBe('theme8');
    expect(data.matrix.themes[0]?.total).toBe(2);
    expect(data.matrix.themes[0]?.projects).toEqual(['P1', 'P2']);
    expect(data.matrix.cells.theme8?.P1).toBe(2);
    expect(data.matrix.cells.theme8?.P2).toBe(1);
    expect(data.matrix.cells.theme9?.P2).toBe(1);
    expect(data.matrix.cells['未分类主题']?.['未归类项目']).toBe(1);
  });
});
