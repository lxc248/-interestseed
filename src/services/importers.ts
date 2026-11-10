/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Copyright (C) 2026 aicoder
 */

/**
 * Parse exported bookmark / favourites files into { title, url } entries.
 *
 * Kept in sync with `mcp/importers.mjs` (the plain-JS twin used by the MCP
 * server, which cannot import TypeScript). `tests/importersParity.test.ts`
 * runs both against the same fixtures so the two cannot drift apart.
 */

export type ImportFormat = 'bookmarks-html' | 'json' | 'csv' | 'urls' | 'empty' | 'unknown';

export interface ImportEntry {
  title: string;
  url: string | null;
}

export interface ImportResult {
  format: ImportFormat;
  items: ImportEntry[];
  duplicates: number;
  truncated: boolean;
}

export const MAX_IMPORT_ITEMS = 500;

function cleanTitle(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, 160);
}

function normaliseUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  return trimmed;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" };

/** One pass only: sequential replaces would decode `&amp;lt;` twice. */
function decodeEntities(value: string): string {
  return value.replace(/&(amp|lt|gt|quot|#39);/g, (match, name: string) => ENTITIES[name] ?? match);
}

/**
 * Strip markup by scanning instead of with a regex: `<[^>]*>` backtracks
 * badly on hostile input, and CodeQL flags it as polynomial ReDoS.
 */
function stripTags(value: string): string {
  let out = '';
  let index = 0;
  let stripped = false;
  while (index < value.length) {
    const open = value.indexOf('<', index);
    if (open < 0) break;
    const close = value.indexOf('>', open);
    if (close < 0) break;
    out += `${value.slice(index, open)} `;
    index = close + 1;
    stripped = true;
  }
  out += value.slice(index);
  const text = stripped ? out : value;
  return text.split('<').join(' ').split('>').join(' ');
}

/**
 * Scan bookmark anchors linearly. A single regex over the whole document is the
 * classic polynomial-backtracking shape, so the tag and its text are located
 * with indexOf and only the small attribute string goes through a regex.
 */
function parseBookmarksHtml(text: string): ImportEntry[] {
  const entries: ImportEntry[] = [];
  const lower = text.toLowerCase();
  let cursor = 0;
  while (cursor < lower.length) {
    const start = lower.indexOf('<a ', cursor);
    if (start < 0) break;
    const tagEnd = lower.indexOf('>', start);
    if (tagEnd < 0) break;
    const close = lower.indexOf('</a>', tagEnd);
    if (close < 0) break;
    const tag = text.slice(start, tagEnd + 1);
    const href = /href="([^"]*)"/i.exec(tag);
    cursor = close + 4;
    if (!href) continue;
    const url = normaliseUrl(decodeEntities(href[1] ?? ''));
    if (!url) continue;
    entries.push({ title: cleanTitle(decodeEntities(stripTags(text.slice(tagEnd + 1, close)))), url });
  }
  return entries;
}

function looksLikeBookmarksHtml(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes('<a ') && lower.includes('href=') && lower.includes('</a>');
}

function pickEntry(source: unknown): ImportEntry | null {
  if (!source || typeof source !== 'object') return null;
  const record = source as Record<string, unknown>;
  const url =
    normaliseUrl(record.url) ??
    normaliseUrl(record.link) ??
    normaliseUrl(record.href) ??
    normaliseUrl(record.uri) ??
    (typeof record.bvid === 'string'
      ? normaliseUrl(`https://www.bilibili.com/video/${record.bvid}`)
      : null) ??
    (typeof record.id === 'string' && record.bvid === undefined
      ? normaliseUrl(`https://www.youtube.com/watch?v=${record.id}`)
      : null);
  const title = cleanTitle(record.title ?? record.name ?? record.intro ?? record.text ?? record.desc ?? '');
  if (!url && !title) return null;
  return { title, url };
}

function collectFromJson(node: unknown, out: ImportEntry[]): void {
  if (Array.isArray(node)) {
    for (const entry of node) collectFromJson(entry, out);
    return;
  }
  if (!node || typeof node !== 'object') return;
  const picked = pickEntry(node);
  if (picked) out.push(picked);
  for (const value of Object.values(node as Record<string, unknown>)) {
    if (value && typeof value === 'object') collectFromJson(value, out);
  }
}

function parseJson(text: string): ImportEntry[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    return null;
  }
  const out: ImportEntry[] = [];
  collectFromJson(parsed, out);
  return out;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === ',' && !quoted) {
      cells.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells.map((cell) => cell.trim().replace(/^"|"$/g, ''));
}

function parseCsv(text: string): ImportEntry[] | null {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return null;
  const header = splitCsvLine(lines[0] ?? '').map((cell) => cell.toLowerCase());
  const urlIndex = header.findIndex((cell) => ['url', 'link', 'href', 'address'].includes(cell));
  if (urlIndex < 0) return null;
  const titleIndex = header.findIndex((cell) =>
    ['title', 'name', 'text', 'description', 'bookmark'].includes(cell),
  );

  const entries: ImportEntry[] = [];
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const url = normaliseUrl(cells[urlIndex]);
    if (!url) continue;
    entries.push({ title: titleIndex >= 0 ? cleanTitle(cells[titleIndex]) : '', url });
  }
  return entries;
}

function parsePlainUrls(text: string): ImportEntry[] {
  const entries: ImportEntry[] = [];
  for (const line of text.split(/\r?\n/)) {
    const first = line.trim().split(/\s+/)[0] ?? '';
    const url = normaliseUrl(first);
    if (!url) continue;
    entries.push({ title: cleanTitle(line.replace(url, '')), url });
  }
  return entries;
}

export function detectImportFormat(text: string): ImportFormat {
  const value = text.trim();
  if (!value) return 'empty';
  if (looksLikeBookmarksHtml(value)) return 'bookmarks-html';
  if (value.startsWith('{') || value.startsWith('[')) return 'json';
  const firstLine = value.split(/\r?\n/)[0] ?? '';
  if (firstLine.includes(',') && /url|link|href|address/i.test(firstLine)) return 'csv';
  if (/^https?:\/\//im.test(value)) return 'urls';
  return 'unknown';
}

/**
 * Parse an export into deduplicated entries. Order is preserved so the newest
 * items stay first when a platform exports newest-first.
 */
export function parseImport(text: string, options: { maxItems?: number } = {}): ImportResult {
  const maxItems = options.maxItems ?? MAX_IMPORT_ITEMS;
  const format = detectImportFormat(text);
  let entries: ImportEntry[] = [];
  if (format === 'bookmarks-html') entries = parseBookmarksHtml(text);
  else if (format === 'json') entries = parseJson(text) ?? [];
  else if (format === 'csv') entries = parseCsv(text) ?? [];
  else if (format === 'urls') entries = parsePlainUrls(text);

  const seen = new Set<string>();
  const items: ImportEntry[] = [];
  let duplicates = 0;
  for (const entry of entries) {
    const title = cleanTitle(entry.title);
    const url = entry.url ?? null;
    if (!title && !url) continue;
    const key = (url ?? title).toLowerCase();
    if (seen.has(key)) {
      duplicates += 1;
      continue;
    }
    seen.add(key);
    items.push({ title, url });
    if (items.length >= maxItems) break;
  }

  return { format, items, duplicates, truncated: entries.length > items.length + duplicates };
}

/** Turn one parsed entry into the text the share inbox expects. */
export function inboxTextFor(entry: ImportEntry): string {
  const title = entry.title.trim();
  const url = entry.url?.trim() ?? '';
  if (title && url) return `${title} ${url}`;
  return title || url;
}
