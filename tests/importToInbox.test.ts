import { describe, expect, it } from 'vitest';

import { ShareInbox } from '../src/inbox/ShareInbox';
import { describeImportOutcome, importEntriesToInbox } from '../src/inbox/importToInbox';

describe('importEntriesToInbox', () => {
  it('adds every entry and reports counts', () => {
    const inbox = new ShareInbox();
    const outcome = importEntriesToInbox(inbox, [
      { title: '陶艺', url: 'https://x.example/1' },
      { title: '剪辑', url: 'https://x.example/2' },
    ]);
    expect(outcome).toEqual({ added: 2, duplicates: 0, skipped: 0 });
    expect(inbox.pending()).toHaveLength(2);
  });

  it('marks entries that are already pending as duplicates', () => {
    const inbox = new ShareInbox();
    inbox.enqueue('陶艺 https://x.example/1', 'share');
    const outcome = importEntriesToInbox(inbox, [{ title: '陶艺', url: 'https://x.example/1' }]);
    expect(outcome).toEqual({ added: 0, duplicates: 1, skipped: 0 });
    expect(inbox.pending()).toHaveLength(1);
  });

  it('skips entries with no usable text', () => {
    const inbox = new ShareInbox();
    const outcome = importEntriesToInbox(inbox, [{ title: '', url: null }]);
    expect(outcome).toEqual({ added: 0, duplicates: 0, skipped: 1 });
  });

  it('records the import source on the items', () => {
    const inbox = new ShareInbox();
    importEntriesToInbox(inbox, [{ title: '陶艺', url: 'https://x.example/1' }]);
    const item = inbox.pending()[0];
    expect(item?.source).toBe('clipboard');
    expect(item?.sourceRef).toBe('export-import');
    expect(item?.sourcePlatform).toBe('web');
  });

  it('respects the inbox cap while still counting', () => {
    const inbox = new ShareInbox(3);
    const entries = Array.from({ length: 6 }, (_v, index) => ({
      title: `兴趣 ${index}`,
      url: `https://x.example/${index}`,
    }));
    const outcome = importEntriesToInbox(inbox, entries);
    expect(outcome.added).toBe(6);
    expect(inbox.pending()).toHaveLength(3);
  });

  it('describes the outcome in one line', () => {
    expect(describeImportOutcome({ added: 3, duplicates: 0, skipped: 0 })).toBe('导入 3 条');
    expect(describeImportOutcome({ added: 3, duplicates: 2, skipped: 1 })).toBe(
      '导入 3 条，重复 2 条，跳过 1 条',
    );
  });
});
describe('inbox serialisation', () => {
  it('keeps platform metadata across a save and reload', () => {
    const inbox = new ShareInbox();
    inbox.enqueue('https://www.douyin.com/video/123?utm_source=share', 'clipboard', 'export-import');
    const saved = inbox.serialize();

    const reloaded = new ShareInbox();
    reloaded.load(JSON.parse(JSON.stringify(saved)));

    const item = reloaded.pending()[0];
    expect(item?.sourcePlatform).toBe('douyin');
    expect(item?.canonicalUrl).toBe('https://douyin.com/video/123');
  });

  it('drops junk fields instead of trusting the file', () => {
    const inbox = new ShareInbox();
    inbox.load([{ id: 'a', text: 'x', addedAt: 'now', sourcePlatform: 42, canonicalUrl: null }]);
    const item = inbox.pending()[0];
    expect(item?.sourcePlatform).toBeUndefined();
    expect(item?.canonicalUrl).toBeUndefined();
  });
});
