import { describe, expect, it } from 'vitest';

import {
  MAX_IMPORT_ITEMS,
  detectImportFormat,
  inboxTextFor,
  parseImport,
} from '../src/services/importers';

const BOOKMARKS = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><A HREF="https://www.bilibili.com/video/BV1xx411c7mD" ADD_DATE="1">剪辑课：三秒抓人</A>
  <DT><A HREF="https://www.douyin.com/video/7300000000000000000" ADD_DATE="2">AI 会议纪要 &amp; 行动项</A>
  <DT><A HREF="javascript:void(0)">无效项</A>
</DL>`;

const BILIBILI_JSON = JSON.stringify({
  code: 0,
  data: { medias: [{ title: '手冲咖啡入门', bvid: 'BV1aa411c7mD' }] },
});

const CSV = 'title,url\n陶艺入门,https://www.xiaohongshu.com/explore/65abc\n没有链接,,空';

describe('importers', () => {
  it('tells the supported shapes apart', () => {
    expect(detectImportFormat(BOOKMARKS)).toBe('bookmarks-html');
    expect(detectImportFormat(BILIBILI_JSON)).toBe('json');
    expect(detectImportFormat(CSV)).toBe('csv');
    expect(detectImportFormat('https://a.example\nhttps://b.example')).toBe('urls');
    expect(detectImportFormat('  ')).toBe('empty');
    expect(detectImportFormat('一段没有链接的话')).toBe('unknown');
  });

  it('reads bookmark exports and drops non-http links', () => {
    const result = parseImport(BOOKMARKS);
    expect(result.format).toBe('bookmarks-html');
    expect(result.items).toEqual([
      { title: '剪辑课：三秒抓人', url: 'https://www.bilibili.com/video/BV1xx411c7mD' },
      { title: 'AI 会议纪要 & 行动项', url: 'https://www.douyin.com/video/7300000000000000000' },
    ]);
  });

  it('maps a Bilibili bvid into a watch url', () => {
    const result = parseImport(BILIBILI_JSON);
    expect(result.items[0]).toEqual({
      title: '手冲咖啡入门',
      url: 'https://www.bilibili.com/video/BV1aa411c7mD',
    });
  });

  it('reads csv exports and skips rows without a url', () => {
    const result = parseImport(CSV);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.title).toBe('陶艺入门');
  });

  it('deduplicates and honours the cap', () => {
    const dupes = parseImport('https://a.example\nhttps://a.example\nhttps://b.example');
    expect(dupes.items).toHaveLength(2);
    expect(dupes.duplicates).toBe(1);

    const many = Array.from({ length: 8 }, (_v, index) => `https://e.example/${index}`).join('\n');
    const capped = parseImport(many, { maxItems: 3 });
    expect(capped.items).toHaveLength(3);
    expect(capped.truncated).toBe(true);
  });

  it('exposes a stable default cap', () => {
    expect(MAX_IMPORT_ITEMS).toBe(500);
  });

  it('builds inbox text from an entry', () => {
    expect(inboxTextFor({ title: '陶艺', url: 'https://x.example/1' })).toBe('陶艺 https://x.example/1');
    expect(inboxTextFor({ title: '只有标题', url: null })).toBe('只有标题');
    expect(inboxTextFor({ title: '', url: 'https://x.example/2' })).toBe('https://x.example/2');
  });
});
