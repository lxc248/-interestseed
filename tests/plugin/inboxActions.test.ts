import { describe, expect, it, vi } from 'vitest';

const notices: string[] = [];
vi.mock('obsidian', () => ({
  Notice: class {
    constructor(public message: string) {
      notices.push(message);
    }
  },
}));

import { enqueueActiveNote, openSparkFromClipboard } from '../../src/plugin/inboxActions';

describe('inboxActions', () => {
  it('enqueues the active note body', async () => {
    const enqueueShare = vi.fn(() => ({ item: { id: 'x' }, duplicate: false }));
    const openInbox = vi.fn();
    const app = {
      workspace: {
        getActiveFile: () => ({ extension: 'md', basename: '笔记', path: '笔记.md' }),
      },
      vault: { cachedRead: vi.fn(async () => '# 标题\n\n正文内容。') },
    } as never;
    await enqueueActiveNote({ app, enqueueShare, openInbox });
    expect(enqueueShare).toHaveBeenCalledTimes(1);
    expect(openInbox).toHaveBeenCalledTimes(1);
    expect(notices.at(-1)).toBe('已把当前笔记放进收件箱。');
  });

  it('opens spark capture from clipboard text', async () => {
    vi.stubGlobal('navigator', { clipboard: { readText: vi.fn(async () => '分享内容') } });
    const openSparkCapture = vi.fn();
    const enqueueShare = vi.fn(() => ({ item: { id: 'x' } }));
    await openSparkFromClipboard({ enqueueShare, openSparkCapture });
    expect(enqueueShare).toHaveBeenCalledWith('分享内容', 'clipboard');
    expect(openSparkCapture).toHaveBeenCalledWith('分享内容', 'x', 'clipboard');
  });

  it('notices when the clipboard cannot be read', async () => {
    vi.stubGlobal('navigator', {
      clipboard: {
        readText: vi.fn(async () => {
          throw new Error('denied');
        }),
      },
    });
    await openSparkFromClipboard({ enqueueShare: vi.fn(), openSparkCapture: vi.fn() });
    expect(notices.at(-1)).toBe(
      '无法读取剪贴板。请在手机快捷指令中使用 interestseed-share 链接，或手动粘贴。',
    );
  });
});
