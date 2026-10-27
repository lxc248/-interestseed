import { describe, expect, it } from 'vitest';

import { buildExploration } from '../src/discovery/exploration';
import { emptyDiscoveryFile } from '../src/discovery/types';
import type { Discovery } from '../src/discovery/types';

const NOW = '2026-01-01T00:00:00.000Z';

function make(id: string, projects: string[], themes: string[]): Discovery {
  return {
    id,
    kind: 'cross-project-topic',
    title: id,
    description: 'synthetic',
    nodeIds: ['a', 'b'],
    projectKeys: projects,
    subjectKeys: themes,
    evidence: [],
    ruleVersion: 'v1',
    strength: 'strong',
    dedupeKey: id,
    status: 'active',
    feedbackStatus: 'none',
    application: { state: 'none' },
    createdAt: NOW,
    updatedAt: NOW,
  };
}

describe('Exploration matrix invariants', () => {
  it('randomized matrices never produce negative or inconsistent counts', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const file = emptyDiscoveryFile(NOW);
      const count = 1 + (seed % 30);
      file.discoveries = Array.from({ length: count }, (_, index) =>
        make(
          `d${seed}-${index}`,
          seed % 4 === 0 ? [] : [`P${seed % 5}`, `P${(seed + index) % 5}`],
          seed % 3 === 0 ? [] : [`theme${seed % 6}`],
        ),
      );

      const data = buildExploration(file, NOW);
      expect(data.matrix.themes.length).toBeGreaterThan(0);
      for (const theme of data.matrix.themes) {
        expect(theme.total).toBeGreaterThanOrEqual(theme.active);
        expect(theme.projects.length).toBeGreaterThan(0);
        for (const project of theme.projects) {
          expect(data.matrix.cells[theme.key]?.[project]).toBeGreaterThan(0);
        }
      }
      for (const project of data.matrix.projects) {
        expect(project.length).toBeGreaterThan(0);
      }
    }
  });
});
