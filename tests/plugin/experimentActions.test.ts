import { describe, expect, it, vi } from 'vitest';

vi.mock('obsidian', () => ({
  Notice: class {},
}));

import { getActiveExperiment } from '../../src/plugin/experimentActions';

describe('experimentActions.getActiveExperiment', () => {
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
});
