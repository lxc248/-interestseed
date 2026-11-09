import { describe, expect, it, vi } from 'vitest';

import { applySeedSprint } from '../../src/plugin/seedSprintApply';

describe('seedSprintApply', () => {
  it('applies accepted nodes and edges', () => {
    const replaceGraph = vi.fn();
    const markSeedSprintCompleted = vi.fn();
    const added = applySeedSprint({
      draft: {
        nodes: [
          {
            id: 'n1',
            title: '第一兴趣',
            type: 'topic',
            tags: ['火花'],
            evidence: '证据',
            confidence: 0.8,
            nextStep: true,
          },
        ],
        edges: [],
        mystery: { title: 'm', reason: 'r' },
        experiment: {
          title: '实验',
          hypothesis: '假设',
          metric: '指标',
          prompt: 'p',
          days: 3,
          steps: [],
        },
      },
      acceptedNodeIds: new Set(['n1']),
      acceptedEdgeIds: new Set(),
      getGraph: () => ({ nodes: [], edges: [], schemaVersion: 1, updatedAt: 'old' } as never),
      replaceGraph,
      markSeedSprintCompleted,
      invalidateInsights: vi.fn(),
      notifyStatus: vi.fn(),
      saveSettings: vi.fn(),
      persist: vi.fn(),
    });
    expect(added).toBe(1);
    expect(replaceGraph).toHaveBeenCalledTimes(1);
    expect(markSeedSprintCompleted).toHaveBeenCalledTimes(1);
  });

  it('returns 0 when no node is accepted', () => {
    const replaceGraph = vi.fn();
    const added = applySeedSprint({
      draft: {
        nodes: [{ id: 'n1', title: 'x', type: 'topic', tags: [], evidence: 'e', confidence: 1 }],
        edges: [],
        mystery: { title: 'm', reason: 'r' },
        experiment: { title: 'e', hypothesis: 'h', metric: 'm', prompt: 'p', days: 3, steps: [] },
      },
      acceptedNodeIds: new Set(),
      acceptedEdgeIds: new Set(),
      getGraph: () => ({ nodes: [], edges: [], schemaVersion: 1, updatedAt: 'old' } as never),
      replaceGraph,
      markSeedSprintCompleted: vi.fn(),
      invalidateInsights: vi.fn(),
      notifyStatus: vi.fn(),
      saveSettings: vi.fn(),
      persist: vi.fn(),
    });
    expect(added).toBe(0);
    expect(replaceGraph).not.toHaveBeenCalled();
  });
});
