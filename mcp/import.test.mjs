/* global */
import test from 'node:test';
import assert from 'node:assert/strict';
import { detectFormat, parseImport } from './importers.mjs';

const BOOKMARKS = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><A HREF="https://www.bilibili.com/video/BV1xx411c7mD" ADD_DATE="1">剪辑课：三秒抓人</A>
  <DT><A HREF="https://www.douyin.com/video/7300000000000000000" ADD_DATE="2">AI 会议纪要 &amp; 行动项</A>
  <DT><A HREF="javascript:void(0)">无效项</A>
</DL>`;

const BILIBILI_JSON = JSON.stringify({
  code: 0,
  data: {
    medias: [
      { title: '手冲咖啡入门', bvid: 'BV1aa411c7mD' },
      { title: '构图基础', link: 'https://www.bilibili.com/video/BV1bb411c7mD' },
    ],
  },
});

const CSV = `title,url,tags
陶艺入门,https://www.xiaohongshu.com/explore/65abc,手作
剪辑节奏,https://www.douyin.com/video/123,video
没有链接的条目,,空`;

test('detectFormat tells the four supported shapes apart', () => {
  assert.equal(detectFormat(BOOKMARKS), 'bookmarks-html');
  assert.equal(detectFormat(BILIBILI_JSON), 'json');
  assert.equal(detectFormat(CSV), 'csv');
  assert.equal(detectFormat('https://example.com/a\nhttps://example.com/b'), 'urls');
  assert.equal(detectFormat('   '), 'empty');
  assert.equal(detectFormat('随便一段没有链接的话'), 'unknown');
});

test('bookmarks html keeps titles and drops javascript: links', () => {
  const result = parseImport(BOOKMARKS);
  assert.equal(result.format, 'bookmarks-html');
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].title, '剪辑课：三秒抓人');
  assert.equal(result.items[0].url, 'https://www.bilibili.com/video/BV1xx411c7mD');
  assert.equal(result.items[1].title, 'AI 会议纪要 & 行动项');
});

test('bilibili favourites json maps bvid to a watch url', () => {
  const result = parseImport(BILIBILI_JSON);
  assert.equal(result.format, 'json');
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].title, '手冲咖啡入门');
  assert.equal(result.items[0].url, 'https://www.bilibili.com/video/BV1aa411c7mD');
  assert.equal(result.items[1].url, 'https://www.bilibili.com/video/BV1bb411c7mD');
});

test('csv import reads title and url columns', () => {
  const result = parseImport(CSV);
  assert.equal(result.format, 'csv');
  assert.equal(result.items.length, 2);
  assert.deepEqual(result.items[0], {
    title: '陶艺入门',
    url: 'https://www.xiaohongshu.com/explore/65abc',
  });
});

test('csv without a url column is not treated as csv', () => {
  const result = parseImport('title,tags\n陶艺,手作\n');
  assert.notEqual(result.format, 'csv');
  assert.equal(result.items.length, 0);
});

test('plain url lines are accepted', () => {
  const result = parseImport(
    'https://www.douyin.com/video/111 会议纪要\nhttps://xhslink.com/a/abc 封面设计',
  );
  assert.equal(result.format, 'urls');
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].title, '会议纪要');
  assert.equal(result.items[1].url, 'https://xhslink.com/a/abc');
});

test('duplicate urls are counted once', () => {
  const result = parseImport(
    'https://example.com/a\nhttps://example.com/a\nhttps://example.com/b\n',
  );
  assert.equal(result.items.length, 2);
  assert.equal(result.duplicates, 1);
});

test('the item cap is honoured and reported', () => {
  const text = Array.from({ length: 12 }, (_value, index) => `https://example.com/${index}`).join('\n');
  const result = parseImport(text, { maxItems: 5 });
  assert.equal(result.items.length, 5);
  assert.equal(result.truncated, true);
});

test('broken json yields zero items instead of throwing', () => {
  const result = parseImport('{ not json');
  assert.equal(result.format, 'json');
  assert.equal(result.items.length, 0);
});

test('json entries without title or url are skipped', () => {
  const result = parseImport(JSON.stringify([{ foo: 'bar' }, { title: '只有标题' }, { url: 'https://a.example' }]));
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].title, '只有标题');
  assert.equal(result.items[1].url, 'https://a.example');
});
