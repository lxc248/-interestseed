import { describe, expect, it, vi } from 'vitest';

import { captureGapSeed } from '../../src/plugin/gapCapture';

describe('gapCapture', () => {
  it('returns null for empty text', () => {
    const result = captureGapSeed({
      insight: { id: 'i', title: 'T', detail: 'D', nodeIds: [] } as never,
      text: '   ',
      getNode: vi.fn(() => null),
      addNode: vi.fn(),
      addEdge: vi.fn(),
      invalidateInsights: vi.fn(),
      notifyStatus: vi.fn(),
      persist: vi.fn(),
      setSelectedNode: vi.fn(),
    });
    expect(result).toBeNull();
  });

  it('captures a gap seed and links to an existing node', () => {
    const addNode = vi.fn();
    const addEdge = vi.fn();
    const setSelectedNode = vi.fn();
    const result = captureGapSeed({
      insight: { id: 'gap', title: '缺一个', detail: '细节', nodeIds: ['a'] } as never,
      text: '一个新的观察',
      getNode: vi.fn((id) => (id === 'a' ? { id: 'a' } : null)),
      addNode,
      addEdge,
      invalidateInsights: vi.fn(),
      notifyStatus: vi.fn(),
      persist: vi.fn(),
      setSelectedNode,
    });
    expect(result).toMatch(/^node_/);
    expect(addNode).toHaveBeenCalledTimes(1);
    expect(addEdge).toHaveBeenCalledTimes(1);
    expect(setSelectedNode).toHaveBeenCalledWith(result);
  });
});
