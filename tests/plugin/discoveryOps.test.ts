/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Copyright (C) 2026 aicoder
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const notices: string[] = [];
vi.mock('obsidian', () => ({
  Notice: class {
    constructor(public message: string) {
      notices.push(message);
    }
  },
}));

const generate = vi.fn(() => ({ discoveries: [{ id: 'next' }] }));
vi.mock('../../src/discovery/DiscoveryEngine', () => ({
  DiscoveryEngine: class {
    generate = generate;
  },
}));

const applyDiscoveryFeedback = vi.fn((state: unknown) => state);
const undoDiscoveryFeedback = vi.fn((state: unknown) => state);
vi.mock('../../src/discovery/feedback', () => ({
  applyDiscoveryFeedback: (...args: unknown[]) =>
    applyDiscoveryFeedback(...(args as [unknown])),
  undoDiscoveryFeedback: (...args: unknown[]) => undoDiscoveryFeedback(...(args as [unknown])),
}));

const hasDiscoveryContentChanged = vi.fn(() => true);
vi.mock('../../src/discovery/refresh', () => ({
  hasDiscoveryContentChanged: (...args: unknown[]) =>
    hasDiscoveryContentChanged(...(args as [])),
}));

import {
  reconcileDiscoveries,
  refreshDiscoveries,
  setDiscoveryFeedback,
  undoDiscoveryFeedbackById,
} from '../../src/plugin/discoveryOps';

const graph = {} as never;

describe('discoveryOps', () => {
  beforeEach(() => {
    notices.length = 0;
    generate.mockClear();
    applyDiscoveryFeedback.mockClear();
    undoDiscoveryFeedback.mockClear();
    hasDiscoveryContentChanged.mockClear();
    hasDiscoveryContentChanged.mockReturnValue(true);
  });

  it('reconciles then refreshes and notifies', async () => {
    const order: string[] = [];
    await reconcileDiscoveries({
      reconcile: async () => {
        order.push('reconcile');
      },
      refresh: async () => {
        order.push('refresh');
      },
    });
    expect(order).toEqual(['reconcile', 'refresh']);
    expect(notices.at(-1)).toBe('InterestSeed：发现应用状态已按当前图谱核对。');
  });

  it('skips refresh when discoveries are blocked', async () => {
    const enqueue = vi.fn();
    await refreshDiscoveries({ blockedReason: '只读', getGraph: () => graph, enqueue });
    expect(enqueue).not.toHaveBeenCalled();
    expect(notices.at(-1)).toBe('InterestSeed：只读');
  });

  it('enqueues the recomputed state when content changed', async () => {
    const enqueue = vi.fn(async (mutator: (state: never) => unknown) =>
      mutator({ discoveries: [{ id: 'old' }] } as never),
    );
    await refreshDiscoveries({ blockedReason: null, getGraph: () => graph, enqueue });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it('keeps the previous state when nothing changed', async () => {
    hasDiscoveryContentChanged.mockReturnValue(false);
    const previous = { discoveries: [{ id: 'old' }] };
    const enqueue = vi.fn(async (mutator: (state: never) => unknown) => mutator(previous as never));
    await refreshDiscoveries({ blockedReason: null, getGraph: () => graph, enqueue });
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it('notices when refreshing fails', async () => {
    const enqueue = vi.fn(async () => {
      throw new Error('disk');
    });
    await refreshDiscoveries({ blockedReason: null, getGraph: () => graph, enqueue });
    expect(notices.at(-1)).toBe('InterestSeed：发现数据保存失败——disk');
  });

  it('skips feedback when blocked', async () => {
    const enqueue = vi.fn();
    await setDiscoveryFeedback({
      blockedReason: '只读',
      getState: () => ({ discoveries: [] }) as never,
      enqueue,
      id: 'a',
      action: 'keep' as never,
    });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('notices when the discovery is gone', async () => {
    const enqueue = vi.fn();
    await setDiscoveryFeedback({
      blockedReason: null,
      getState: () => ({ discoveries: [] }) as never,
      enqueue,
      id: 'a',
      action: 'keep' as never,
    });
    expect(notices.at(-1)).toBe('这条发现已不存在，无法操作。');
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('applies feedback for an existing discovery', async () => {
    const enqueue = vi.fn(async (mutator: (state: never) => unknown) => mutator({} as never));
    await setDiscoveryFeedback({
      blockedReason: null,
      getState: () => ({ discoveries: [{ id: 'a' }] }) as never,
      enqueue,
      id: 'a',
      action: 'keep' as never,
      correction: { note: 'why' } as never,
    });
    expect(applyDiscoveryFeedback).toHaveBeenCalledTimes(1);
  });

  it('notices when applying feedback fails', async () => {
    const enqueue = vi.fn(async () => {
      throw new Error('locked');
    });
    await setDiscoveryFeedback({
      blockedReason: null,
      getState: () => ({ discoveries: [{ id: 'a' }] }) as never,
      enqueue,
      id: 'a',
      action: 'keep' as never,
    });
    expect(notices.at(-1)).toBe('InterestSeed：反馈保存失败——locked');
  });

  it('skips undo when blocked', async () => {
    const enqueue = vi.fn();
    await undoDiscoveryFeedbackById({ blockedReason: '只读', enqueue, id: 'a' });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('undoes feedback', async () => {
    const enqueue = vi.fn(async (mutator: (state: never) => unknown) => mutator({} as never));
    await undoDiscoveryFeedbackById({ blockedReason: null, enqueue, id: 'a' });
    expect(undoDiscoveryFeedback).toHaveBeenCalledTimes(1);
  });

  it('notices when undo fails', async () => {
    const enqueue = vi.fn(async () => {
      throw new Error('gone');
    });
    await undoDiscoveryFeedbackById({ blockedReason: null, enqueue, id: 'a' });
    expect(notices.at(-1)).toBe('InterestSeed：撤销反馈失败——gone');
  });
});
