import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const roots = ['README.md', 'README.en.md', 'docs', 'standalone', 'mcp', 'archive'];
const errors = [];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (entry.name.endsWith('.md')) files.push(path);
  }
  return files;
}

async function isTarget(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function localTarget(file, raw) {
  const value = raw.trim().replace(/^<|>$/g, '').split('#')[0].split('?')[0];
  if (!value || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value)) return null;
  const decoded = decodeURIComponent(value);
  const target = decoded.startsWith('/')
    ? resolve(root, decoded.replace(/^\/+/, ''))
    : resolve(dirname(file), decoded);
  return target;
}

const files = [];
for (const rootItem of roots) {
  const path = join(root, rootItem);
  try {
    const info = await stat(path);
    if (info.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  } catch {
    errors.push(`missing docs root: ${rootItem}`);
  }
}

for (const file of files) {
  const raw = await readFile(file, 'utf8');
  const text = raw.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  const links = [
    ...text.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g),
    ...text.matchAll(/\b(?:src|href)="([^"]+)"/g),
  ];
  for (const match of links) {
    const target = localTarget(file, match[1]);
    if (target && !(await isTarget(target))) {
      errors.push(`${file.slice(root.length + 1)}: missing ${match[1]}`);
    }
  }
}

if (errors.length > 0) {
  console.error(`Docs check failed with ${errors.length} error(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Docs check passed: ${files.length} Markdown files have valid local links.`);
}
