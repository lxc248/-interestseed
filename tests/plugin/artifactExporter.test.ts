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

import { exportInterestRoute, exportJsonCanvas } from '../../src/plugin/artifactExporter';

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

  it('adds a numeric suffix when a route already exists', async () => {
    const { app } = makeApp(['InterestSeed', 'InterestSeed/兴趣路线 - 测试兴趣 - 2026-11-09.md']);
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
