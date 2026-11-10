import { describe, expect, it, vi } from 'vitest';

const notices: string[] = [];
vi.mock('obsidian', () => ({
  Notice: class {
    constructor(public message: string) {
      notices.push(message);
    }
  },
}));

import { suggestForActiveNote, suggestForFile, suggestForSelectedNode } from '../../src/plugin/aiSuggestions';

describe('aiSuggestions', () => {
  it('expands the selected node', async () => {
    const expandWithAI = vi.fn(async () => undefined);
    await suggestForSelectedNode({ nodeId: 'node-a', expandWithAI });
    expect(expandWithAI).toHaveBeenCalledWith('node-a');
  });

  it('notices when no node is selected', async () => {
    await suggestForSelectedNode({ nodeId: null, expandWithAI: vi.fn(async () => undefined) });
    expect(notices.at(-1)).toBe('先在图谱里选中一个节点。');
  });

  it('notices when there is no active note', async () => {
    await suggestForActiveNote({
      app: { workspace: { getActiveFile: () => null } } as never,
      suggestForFile: vi.fn(async () => undefined),
    });
    expect(notices.at(-1)).toBe('先打开一篇 Markdown 笔记。');
  });

  it('expands the node matched for a file', async () => {
    const expandWithAI = vi.fn(async () => undefined);
    await suggestForFile({
      file: { path: 'note.md' } as never,
      findNodeByUri: vi.fn(() => ({ id: 'node-a' })),
      listNodes: vi.fn(() => []),
      expandWithAI,
    });
    expect(expandWithAI).toHaveBeenCalledWith('node-a');
  });

  it('notices when a file has no matched node', async () => {
    await suggestForFile({
      file: { path: 'note.md' } as never,
      findNodeByUri: vi.fn(() => undefined),
      listNodes: vi.fn(() => []),
      expandWithAI: vi.fn(async () => undefined),
    });
    expect(notices.at(-1)).toBe('这篇笔记还没进入图谱；先运行一次“重新扫描”。');
  });
});
