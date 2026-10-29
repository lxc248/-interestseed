import { describe, expect, it } from 'vitest';
import {
  buildSeedSprintDraft,
  SEED_SPRINT_ROUNDS,
  selectionIsComplete,
} from '../src/onboarding/seedSprint';

describe('Seed Sprint simulation', () => {
  it('runs every legal onboarding path without dangling edges', () => {
    let combinations = 0;
    const rounds = SEED_SPRINT_ROUNDS;
    for (const mode of rounds[0]!.options) {
      for (const flow of rounds[1]!.options) {
        for (const magnet of rounds[2]!.options) {
          for (const shape of rounds[3]!.options) {
            const selection = {
              mode: mode.id,
              flow: flow.id,
              magnet: magnet.id,
              shape: shape.id,
            };
            expect(selectionIsComplete(selection)).toBe(true);
            const draft = buildSeedSprintDraft(selection);
            const ids = new Set(draft.nodes.map((node) => node.id));
            expect(ids.size).toBe(draft.nodes.length);
            expect(draft.nodes.length).toBeGreaterThanOrEqual(5);
            expect(draft.edges.length).toBeGreaterThanOrEqual(3);
            for (const edge of draft.edges) {
              expect(ids.has(edge.source)).toBe(true);
              expect(ids.has(edge.target)).toBe(true);
              expect(edge.source).not.toBe(edge.target);
            }
            expect(draft.experiment.steps).toHaveLength(3);
            combinations += 1;
          }
        }
      }
    }
    expect(combinations).toBe(512);
  });
});
