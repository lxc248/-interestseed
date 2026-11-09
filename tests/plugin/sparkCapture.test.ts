import { describe, expect, it, vi } from 'vitest';

const notices: string[] = [];
vi.mock('obsidian', () => ({
  Notice: class {
    constructor(public message: string) {
      notices.push(message);
    }
  },
}));

import { captureInterestSpark } from '../../src/plugin/sparkCapture';

describe('sparkCapture', () => {
  it('returns null for empty text', () => {
    const result = captureInterestSpark({
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
    expect(notices.at(-1)).toBe('先写下一句话，或粘贴一个链接。');
  });

  it('captures a spark and links to an existing target', () => {
    const addNode = vi.fn();
    const addEdge = vi.fn();
    const result = captureInterestSpark({
      text: '想学一门乐器',
      targetId: 'target',
      getNode: vi.fn((id) => (id === 'target' ? { id: 'target' } : null)),
      addNode,
      addEdge,
      invalidateInsights: vi.fn(),
      notifyStatus: vi.fn(),
      persist: vi.fn(),
      setSelectedNode: vi.fn(),
    });
    expect(result).toMatch(/^node_/);
    expect(addNode).toHaveBeenCalledTimes(1);
    expect(addEdge).toHaveBeenCalledTimes(1);
  });
});
