/**
 * Parse exported bookmark files into a flat list of { title, url } entries.
 *
 * Every short-video and social platform either has no consumer API or requires
 * an enterprise agreement, so the practical import path is the file the user
 * exports themselves. This module only reads text: no network, no HTML
 * rendering, no page fetching.
 */

const MAX_ITEMS = 500;

function cleanTitle(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, 160);
}

function normaliseUrl(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  return trimmed;
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" };

/** One pass only: sequential replaces would decode `&amp;lt;` twice. */
function decodeEntities(value) {
  return value.replace(/&(amp|lt|gt|quot|#39);/g, (match, name) => ENTITIES[name] ?? match);
}

/** Strip markup until it stops changing, then drop leftover angle brackets. */
function stripTags(value) {
  let text = value;
  for (let round = 0; round < 3; round += 1) {
    const next = text.replace(/<[^>]*>/g, ' ');
    if (next === text) break;
    text = next;
  }
  return text.replace(/[<>]/g, ' ');
}

/** Netscape bookmark export: the format every browser and many tools emit. */
function parseBookmarksHtml(text) {
  const items = [];
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
    const url = normaliseUrl(decodeEntities(href[1]));
    if (!url) continue;
    items.push({ title: cleanTitle(decodeEntities(stripTags(text.slice(tagEnd + 1, close)))), url });
  }
  return items;
}

function looksLikeBookmarksHtml(text) {
  const lower = text.toLowerCase();
  return lower.includes('<a ') && lower.includes('href=') && lower.includes('</a>');
}

/** Only the fields we understand are read; unknown shapes are ignored. */
function pickEntry(source) {
  if (!source || typeof source !== 'object') return null;
  const url =
    normaliseUrl(source.url) ??
    normaliseUrl(source.link) ??
    normaliseUrl(source.href) ??
    normaliseUrl(source.uri) ??
    (typeof source.bvid === 'string' ? normaliseUrl(`https://www.bilibili.com/video/${source.bvid}`) : null) ??
    (typeof source.id === 'string' && typeof source.bvid === 'undefined'
      ? normaliseUrl(`https://www.youtube.com/watch?v=${source.id}`)
      : null);
  const title = cleanTitle(
    source.title ?? source.name ?? source.intro ?? source.text ?? source.desc ?? '',
  );
  if (!url && !title) return null;
  return { title, url };
}

function collectFromJson(node, out) {
  if (Array.isArray(node)) {
    for (const entry of node) collectFromJson(entry, out);
    return;
  }
  if (!node || typeof node !== 'object') return;
  const picked = pickEntry(node);
  if (picked) out.push(picked);
  for (const value of Object.values(node)) {
    if (value && typeof value === 'object') collectFromJson(value, out);
  }
}

function parseJson(text) {
  let parsed;
  try {
    parsed = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    return null;
  }
  const out = [];
  collectFromJson(parsed, out);
  return out;
}

function splitCsvLine(line) {
  const cells = [];
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

/** CSV export from browser extensions, Reddit saved lists, or spreadsheet apps. */
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return null;
  const header = splitCsvLine(lines[0]).map((cell) => cell.toLowerCase());
  const urlIndex = header.findIndex((cell) => ['url', 'link', 'href', 'address'].includes(cell));
  if (urlIndex < 0) return null;
  const titleIndex = header.findIndex((cell) =>
    ['title', 'name', 'text', 'description', 'bookmark'].includes(cell),
  );

  const items = [];
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const url = normaliseUrl(cells[urlIndex]);
    if (!url) continue;
    const title = titleIndex >= 0 ? cleanTitle(cells[titleIndex]) : '';
    items.push({ title, url });
  }
  return items;
}

/** Last resort: one URL per line, optionally followed by a note. */
function parsePlainUrls(text) {
  const items = [];
  for (const line of text.split(/\r?\n/)) {
    const url = normaliseUrl(line.trim().split(/\s+/)[0] ?? '');
    if (!url) continue;
    items.push({ title: cleanTitle(line.replace(url, '')), url });
  }
  return items;
}

export function detectFormat(text) {
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
export function parseImport(text, { maxItems = MAX_ITEMS } = {}) {
  const format = detectFormat(text);
  let entries = [];
  if (format === 'bookmarks-html') entries = parseBookmarksHtml(text);
  else if (format === 'json') entries = parseJson(text) ?? [];
  else if (format === 'csv') entries = parseCsv(text) ?? [];
  else if (format === 'urls') entries = parsePlainUrls(text);

  const seen = new Set();
  const items = [];
  let duplicates = 0;
  for (const entry of entries) {
    const title = cleanTitle(entry.title ?? '');
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
