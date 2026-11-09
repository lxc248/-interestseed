import { describe, expect, it, vi } from 'vitest';

vi.mock('obsidian', () => ({
  Notice: class {
    constructor(public message: string) {}
  },
}));

import {
  extendExperimentToSeven,
  getActiveExperiment,
  recordExperimentCheckIn,
  recordQuickExperiment,
  startStarterExperiment,
} from '../../src/plugin/experimentActions';
import { createExperiment, type ExperimentState } from '../../src/experiment/experiment';

describe('experimentActions', () => {
  it('returns null when no node is marked as next step', () => {
    const result = getActiveExperiment({
      listNodes: () => [{ id: 'a', metadata: { nextStep: false } } as never],
    });
    expect(result).toBeNull();
  });

  it('builds a snapshot from the next-step node', () => {
    const result = getActiveExperiment({
      listNodes: () => [
        { id: 'a', title: '学琴', metadata: { nextStep: true } } as never,
      ],
    });
    expect(result?.node.id).toBe('a');
    expect(result?.state.title).toBe('学琴');
    expect(result?.day).toBe(1);
  });

  it('starts a 3-day starter experiment', () => {
    const state = createExperiment({
      title: '兴趣',
      hypothesis: '验证一周',
      metric: '记录',
      startedAt: new Date().toISOString(),
      targetDays: 7,
    });
    const updateNode = vi.fn();
    const result = startStarterExperiment(
      {
        updateNode,
        invalidateInsights: vi.fn(),
        notifyStatus: vi.fn(),
        persist: vi.fn(),
      },
      { node: { id: 'a', metadata: {} } as never, state, day: 1, gate: {} as never, summary: {} as never },
    );
    expect(result).toBe(true);
    expect(updateNode).toHaveBeenCalledTimes(1);
  });

  it('extends a completed 3-day starter to 7 days', () => {
    const state = createExperiment({
      title: '兴趣',
      hypothesis: '验证',
      metric: '记录',
      startedAt: new Date().toISOString(),
      targetDays: 3,
    }) as ExperimentState;
    const extended = {
      ...state,
      targetDays: 3,
      status: 'complete',
      logs: [{ day: 1 }, { day: 2 }, { day: 3 }],
    } as never;
    const updateNode = vi.fn();
    const result = extendExperimentToSeven(
      {
        updateNode,
        invalidateInsights: vi.fn(),
        notifyStatus: vi.fn(),
        persist: vi.fn(),
      },
      { node: { id: 'a', metadata: {} } as never, state: extended, day: 3, gate: {} as never, summary: {} as never },
    );
    expect(result).toBe(true);
    expect(updateNode).toHaveBeenCalledTimes(1);
  });

  it('records a quick check-in', () => {
    const state = createExperiment({
      title: '兴趣',
      hypothesis: '验证',
      metric: '记录',
      startedAt: new Date().toISOString(),
      targetDays: 7,
    }) as ExperimentState;
    const updateNode = vi.fn();
    const result = recordQuickExperiment(
      {
        updateNode,
        invalidateInsights: vi.fn(),
        notifyStatus: vi.fn(),
        persist: vi.fn(),
      },
      { node: { id: 'a', metadata: {} } as never, state, day: 1, gate: {} as never, summary: {} as never },
      'did',
    );
    expect(result).toBe(true);
    expect(updateNode).toHaveBeenCalledTimes(1);
  });

  it('returns false when checking in without an active experiment', () => {
    const result = recordExperimentCheckIn(
      {
        updateNode: vi.fn(),
        invalidateInsights: vi.fn(),
        notifyStatus: vi.fn(),
        persist: vi.fn(),
      },
      null,
      { interest: 4, energy: 4, evidence: '做了' },
    );
    expect(result).toBe(false);
  });

  it('records a full check-in for an active experiment', () => {
    const state = createExperiment({
      title: '兴趣',
      hypothesis: '验证',
      metric: '记录',
      startedAt: new Date().toISOString(),
      targetDays: 7,
    }) as ExperimentState;
    const updateNode = vi.fn();
    const result = recordExperimentCheckIn(
      {
        updateNode,
        invalidateInsights: vi.fn(),
        notifyStatus: vi.fn(),
        persist: vi.fn(),
      },
      { node: { id: 'a', metadata: {} } as never, state, day: 1, gate: {} as never, summary: {} as never },
      { interest: 4, energy: 4, evidence: '今天做了' },
    );
    expect(result).toBe(true);
    expect(updateNode).toHaveBeenCalledTimes(1);
  });

  it('refuses to extend before the starter is complete', () => {
    const state = createExperiment({
      title: '兴趣',
      hypothesis: '验证',
      metric: '记录',
      startedAt: new Date().toISOString(),
      targetDays: 3,
    }) as ExperimentState;
    const incomplete = { ...state, targetDays: 3, logs: [{ day: 1 }] } as never;
    const updateNode = vi.fn();
    const result = extendExperimentToSeven(
      {
        updateNode,
        invalidateInsights: vi.fn(),
        notifyStatus: vi.fn(),
        persist: vi.fn(),
      },
      { node: { id: 'a', metadata: {} } as never, state: incomplete, day: 2, gate: {} as never, summary: {} as never },
    );
    expect(result).toBe(false);
    expect(updateNode).not.toHaveBeenCalled();
  });
});
