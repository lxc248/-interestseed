import { describe, expect, it } from 'vitest';
import {
  buildSeedSprintDraft,
  SEED_SPRINT_ROUNDS,
  selectionIsComplete,
} from '../src/onboarding/seedSprint';

const COMPLETE = {
  mode: 'making',
  flow: 'build',
  magnet: 'ai',
  shape: 'project-map',
} as const;

describe('Seed Sprint', () => {
  it('offers four independent rounds with concrete choices', () => {
    expect(SEED_SPRINT_ROUNDS).toHaveLength(4);
    for (const round of SEED_SPRINT_ROUNDS) {
      expect(round.options.length).toBeGreaterThanOrEqual(4);
      expect(new Set(round.options.map((option) => option.id)).size).toBe(
        round.options.length,
      );
    }
  });

  it('builds a deterministic draft from a complete selection', () => {
    const first = buildSeedSprintDraft(COMPLETE);
    const second = buildSeedSprintDraft(COMPLETE);
    expect(first).toEqual(second);
    expect(first.nodes.length).toBeGreaterThanOrEqual(5);
    expect(first.edges.length).toBeGreaterThanOrEqual(4);
    expect(selectionIsComplete(COMPLETE)).toBe(true);
  });

  it('never emits an edge without both endpoints', () => {
    const draft = buildSeedSprintDraft(COMPLETE);
    const ids = new Set(draft.nodes.map((node) => node.id));
    for (const edge of draft.edges) {
      expect(ids.has(edge.source)).toBe(true);
      expect(ids.has(edge.target)).toBe(true);
      expect(edge.source).not.toBe(edge.target);
    }
    expect(new Set(draft.edges.map((edge) => edge.id)).size).toBe(draft.edges.length);
  });

  it('always includes one next-step experiment node and a mystery hook', () => {
    const draft = buildSeedSprintDraft(COMPLETE);
    expect(draft.nodes.filter((node) => node.nextStep)).toHaveLength(1);
    expect(draft.experiment.days).toBe(3);
    expect(draft.experiment.steps).toHaveLength(3);
    expect(draft.mystery.title.length).toBeGreaterThan(0);
  });

  it('does not claim a complete selection when a round is missing', () => {
    expect(selectionIsComplete({ mode: 'making', flow: 'build' })).toBe(false);
    const draft = buildSeedSprintDraft({ mode: 'making' });
    expect(draft.nodes.length).toBeGreaterThan(0);
    expect(draft.edges.length).toBeLessThanOrEqual(1);
  });
});
