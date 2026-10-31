import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import type { InterestSeedNode } from '../../src/types/graph';
import {
  collectNodeTags,
  createSeedNode,
  matchesIncludeTags,
  nodeTypeFromFrontmatter,
  shouldScanPath,
  titleFromMetadata,
} from '../../src/adapters/vaultScan';
import { vaultUri } from '../../src/utils/paths';
import type { StandaloneConfig } from './state';

export interface ScanResult {
  nodes: InterestSeedNode[];
  files: number;
  skipped: number;
}

export async function scanVault(
  vaultPath: string,
  config: StandaloneConfig,
): Promise<ScanResult> {
  const nodes: InterestSeedNode[] = [];
  let files = 0;
  let skipped = 0;

  const walk = async (dir: string): Promise<void> => {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      const rel = relative(vaultPath, full).replace(/\\/g, '/');
      if (entry.isDirectory()) {
        if (shouldScanPath(rel, config)) await walk(full);
        continue;
      }
      if (!entry.isFile() || !/\.md$/i.test(entry.name)) continue;
      if (!shouldScanPath(rel, config)) {
        skipped += 1;
        continue;
      }
      files += 1;
      const node = await nodeFromFile(full, rel);
      if (node && matchesIncludeTags(node.tags, config.includeTags)) nodes.push(node);
    }
  };

  await walk(vaultPath);
  return { nodes, files, skipped };
}

async function nodeFromFile(
  fullPath: string,
  relPath: string,
): Promise<InterestSeedNode | null> {
  const raw = (await readFile(fullPath, 'utf8')).replace(/^\uFEFF/, '');
  const frontmatter = parseFrontmatter(raw);
  const body = frontmatter.body;
  const headings = [...body.matchAll(/^(#{1,6})\s+(.+)$/gm)].map((match) => ({
    level: match[1]!.length,
    heading: match[2]!.trim(),
  }));
  const inlineTags = [...body.matchAll(/(?:^|\s)#([\p{L}\p{N}_/-]+)/gu)].map(
    (match) => `#${match[1]!}`,
  );
  const tags = collectNodeTags(frontmatter.data.tags, inlineTags);
  const links = [
    ...[...body.matchAll(/\[\[([^\]]+)\]\]/g)].map((match) => match[1]!.split('|')[0]!),
  ];
  const info = await stat(fullPath);
  const title = titleFromMetadata(frontmatter.data.title, headings, relPath);
  const summary = firstParagraph(body);

  return createSeedNode({
    uri: vaultUri(relPath),
    path: relPath,
    title,
    type: nodeTypeFromFrontmatter(frontmatter.data),
    tags,
    createdAt: info.birthtime.toISOString(),
    updatedAt: info.mtime.toISOString(),
    summary,
    links,
    extension: 'md',
  });
}

function firstParagraph(body: string): string {
  const lines = body.split(/\r?\n/);
  const paragraph: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (paragraph.length > 0) break;
      continue;
    }
    if (trimmed.startsWith('#') || trimmed.startsWith('```')) continue;
    paragraph.push(trimmed);
    if (paragraph.join(' ').length >= 180) break;
  }
  return paragraph.join(' ').slice(0, 240).trim();
}

function parseFrontmatter(raw: string): {
  data: Record<string, unknown>;
  body: string;
} {
  if (!raw.startsWith('---')) return { data: {}, body: raw };
  const end = raw.indexOf('\n---', 3);
  if (end < 0) return { data: {}, body: raw };
  const text = raw.slice(3, end).replace(/^\r?\n/, '');
  const body = raw.slice(end + 4).replace(/^\r?\n/, '');
  const data: Record<string, unknown> = {};
  let currentKey: string | null = null;
  for (const line of text.split(/\r?\n/)) {
    const arrayItem = /^\s*-\s+(.+)$/.exec(line);
    if (arrayItem && currentKey) {
      const value = data[currentKey];
      if (!Array.isArray(value)) data[currentKey] = [];
      (data[currentKey] as unknown[]).push(stripQuotes(arrayItem[1]!.trim()));
      continue;
    }
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!match) continue;
    currentKey = match[1]!;
    const value = match[2]!.trim();
    if (!value) {
      data[currentKey] = [];
    } else if (value.startsWith('[') && value.endsWith(']')) {
      data[currentKey] = value
        .slice(1, -1)
        .split(',')
        .map((item) => stripQuotes(item.trim()))
        .filter(Boolean);
    } else {
      data[currentKey] = stripQuotes(value);
    }
  }
  return { data, body };
}

function stripQuotes(value: string): string {
  return value.replace(/^["']|["']$/g, '');
}
