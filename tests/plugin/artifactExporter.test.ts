import { describe, expect, it, vi } from 'vitest';

const createMock = vi.fn();
const createFolderMock = vi.fn();
const openLinkTextMock = vi.fn();
const getAbstractFileByPathMock = vi.fn();
const notices: string[] = [];

vi.mock('obsidian', () => ({
  Notice: class {
    constructor(public message: string) {
      notices.push(message);
    }
  },
}));

import { buildRoutePlan, exportInterestRoute, exportJsonCanvas } from '../../src/plugin/artifactExporter';

function makeApp(existing: string[] = []) {
  createMock.mockResolvedValue({ path: existing[0] ?? 'InterestSeed/route.md' });
  createFolderMock.mockReset();
  openLinkTextMock.mockReset();
  getAbstractFileByPathMock.mockImplementation((path: string) =>
    existing.includes(path) ? { path } : null,
  );
  return {
    app: {
      vault: {
        create: createMock,
        createFolder: createFolderMock,
        getAbstractFileByPath: getAbstractFileByPathMock,
      },
      workspace: { openLinkText: openLinkTextMock },
    } as never,
  };
}

describe('artifactExporter', () => {
  it('creates the folder and writes an interest route', async () => {
    const { app } = makeApp([]);
    await exportInterestRoute(app, {
      theme: '测试兴趣',
      nodes: [
        { id: 'a', title: 'A 节点', tags: ['测试兴趣'], metadata: undefined },
      ] as never,
      connectedIds: new Set(['a']),
      experiment: null,
    });
    expect(createFolderMock).toHaveBeenCalledWith('InterestSeed');
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(openLinkTextMock).toHaveBeenCalledTimes(1);
  });

  it('writes a JSON Canvas from a non-empty graph', async () => {
    const { app } = makeApp([]);
    await exportJsonCanvas(app, {
      nodes: [{ id: 'a', title: 'A', tags: [], metadata: {} }],
      edges: [],
    } as never);
    expect(createFolderMock).toHaveBeenCalledWith('InterestSeed');
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(String(createMock.mock.calls[0]?.[0])).toContain('.canvas');
  });

  it('does not write a canvas for an empty graph', async () => {
    const { app } = makeApp([]);
    await exportJsonCanvas(app, { nodes: [], edges: [] } as never);
    expect(createFolderMock).not.toHaveBeenCalled();
    expect(notices.at(-1)).toBe('图谱里还没有节点，先留下一个火花。');
  });

  it('returns null from buildRoutePlan for an empty graph', () => {
    expect(
      buildRoutePlan({
        allNodes: [],
        neighbors: () => [],
        active: null,
      }),
    ).toBeNull();
  });

  it('falls back to all nodes when no theme tag exists', () => {
    const plan = buildRoutePlan({
      selected: { id: 'a', title: 'A', tags: ['火花'], metadata: {} } as never,
      allNodes: [{ id: 'a', title: 'A', tags: ['火花'], metadata: {} }] as never,
      neighbors: () => [],
      active: null,
    });
    expect(plan?.theme).toBe('全部兴趣');
    expect(plan?.nodes).toHaveLength(1);
  });

  it('filters nodes by the first meaningful theme tag', () => {
    const plan = buildRoutePlan({
      selected: { id: 'a', title: 'A', tags: ['火花', '文本', '测试兴趣'], metadata: {} } as never,
      allNodes: [
        { id: 'a', title: 'A', tags: ['测试兴趣'], metadata: {} },
        { id: 'b', title: 'B', tags: ['其他'], metadata: {} },
      ] as never,
      neighbors: () => [],
      active: null,
    });
    expect(plan?.theme).toBe('测试兴趣');
    expect(plan?.nodes.map((node) => node.id)).toEqual(['a']);
  });

  it('adds a numeric suffix when a route already exists', async () => {
    const date = new Date().toISOString().slice(0, 10);
    const { app } = makeApp(['InterestSeed', `InterestSeed/兴趣路线 - 测试兴趣 - ${date}.md`]);
    await exportInterestRoute(app, {
      theme: '测试兴趣',
      nodes: [],
      connectedIds: new Set(),
      experiment: null,
    });
    expect(createFolderMock).not.toHaveBeenCalled();
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(String(createMock.mock.calls[0]?.[0])).toContain(' 2.md');
  });
});
