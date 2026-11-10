import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { ImportInputError, importFavorites } from '../standalone/src/import';
import { listInbox } from '../standalone/src/inbox';

const dirs: string[] = [];

function makeVault(): string {
  const dir = mkdtempSync(join(tmpdir(), 'interestseed-import-'));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  while (dirs.length > 0) {
    const dir = dirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

const CSV = 'title,url\n陶艺入门,https://www.xiaohongshu.com/explore/65abc\n剪辑节奏,https://www.douyin.com/video/123';
const BOOKMARKS = '<DL><DT><A HREF="https://b23.tv/abc">三秒抓人的开场</A></DL>';

describe('standalone favourites import', () => {
  it('imports a csv export into the inbox', async () => {
    const vault = makeVault();
    const report = await importFavorites(vault, CSV);
    expect(report.format).toBe('csv');
    expect(report.added).toBe(2);
    expect(report.duplicates).toBe(0);
    expect(await listInbox(vault)).toHaveLength(2);
  });

  it('records the import source on every item', async () => {
    const vault = makeVault();
    await importFavorites(vault, CSV);
    const items = await listInbox(vault);
    expect(items.every((item) => item.source === 'clipboard')).toBe(true);
    expect(items.every((item) => item.sourceRef === 'export-import')).toBe(true);
    const platforms = items.map((item) => item.sourcePlatform).sort();
    expect(platforms).toEqual(['douyin', 'xiaohongshu']);
  });

  it('accepts bookmark html', async () => {
    const vault = makeVault();
    const report = await importFavorites(vault, BOOKMARKS);
    expect(report.format).toBe('bookmarks-html');
    expect(report.added).toBe(1);
  });

  it('is idempotent across repeated imports', async () => {
    const vault = makeVault();
    await importFavorites(vault, CSV);
    const second = await importFavorites(vault, CSV);
    expect(second.added).toBe(0);
    expect(second.duplicates).toBe(2);
    expect(await listInbox(vault)).toHaveLength(2);
  });

  it('reports duplicates inside the file separately', async () => {
    const vault = makeVault();
    const report = await importFavorites(vault, 'https://a.example\nhttps://a.example');
    expect(report.parsed).toBe(1);
    expect(report.duplicatesInFile).toBe(1);
  });

  it('rejects empty input with a typed error', async () => {
    const vault = makeVault();
    await expect(importFavorites(vault, '   ')).rejects.toBeInstanceOf(ImportInputError);
  });

  it('rejects an unrecognisable file', async () => {
    const vault = makeVault();
    await expect(importFavorites(vault, '完全没有链接的一段话')).rejects.toThrow(/没有识别到可导入的条目/);
  });

  it('persists the inbox to disk', async () => {
    const vault = makeVault();
    await importFavorites(vault, CSV);
    const stored = JSON.parse(readFileSync(join(vault, '.interestseed', 'inbox.json'), 'utf8'));
    expect(Array.isArray(stored.items)).toBe(true);
    expect(stored.items).toHaveLength(2);
  });

  it('keeps the import source out of the graph', async () => {
    const vault = makeVault();
    await importFavorites(vault, CSV);
    // The importer must never write graph.json by itself.
    expect(() => readFileSync(join(vault, '.interestseed', 'graph.json'), 'utf8')).toThrow();
  });
});

describe('standalone import HTTP surface', () => {
  it('is wired to a 400 for bad input', async () => {
    // Guards the server-side mapping without booting the whole HTTP server.
    const serverSource = readFileSync(join(process.cwd(), 'standalone', 'src', 'server.ts'), 'utf8');
    expect(serverSource).toContain("'/api/inbox/import'");
    expect(serverSource).toContain('ImportInputError');
    expect(serverSource).toMatch(/new HttpError\(400, error\.message\)/);
  });
});
