import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../site', import.meta.url)));
const errors = [];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (entry.name.endsWith('.html')) files.push(path);
  }
  return files;
}

async function isFile(path) {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

function localTarget(file, raw) {
  const clean = raw.split('#')[0].split('?')[0];
  if (!clean || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(clean)) return null;
  const base = clean.startsWith('/') ? root : dirname(file);
  const target = resolve(base, clean.replace(/^\/+/, ''));
  return clean.endsWith('/') ? join(target, 'index.html') : target;
}

const htmlFiles = (await walk(root)).sort();
for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    const target = localTarget(file, match[1]);
    if (target && !(await isFile(target))) {
      errors.push(`${file.slice(root.length + 1)}: missing ${match[1]}`);
    }
  }
  for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)) {
    try {
      JSON.parse(match[1]);
    } catch {
      errors.push(`${file.slice(root.length + 1)}: invalid JSON-LD`);
    }
  }
}

const publicPages = [
  'index.html',
  'how-it-works/index.html',
  'download/index.html',
  '3-day-interest-experiment/index.html',
  'interestseed-vs-readwise/index.html',
  'interestseed-vs-obsidian/index.html',
];
for (const page of publicPages) {
  const html = await readFile(join(root, page), 'utf8');
  for (const [label, pattern] of [
    ['title', /<title>[^<]+<\/title>/],
    ['description', /name="description"/],
    ['canonical', /rel="canonical"/],
    ['og:title', /property="og:title"/],
    ['og:url', /property="og:url"/],
  ]) {
    if (!pattern.test(html)) errors.push(`${page}: missing ${label}`);
  }
}

const sitemap = await readFile(join(root, 'sitemap.xml'), 'utf8');
for (const match of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) {
  const url = new URL(match[1]);
  const path = url.pathname.replace(/^\/-interestseed/, '') || '/';
  const target = path.endsWith('/') ? join(root, path, 'index.html') : join(root, path);
  if (!(await isFile(target))) errors.push(`sitemap.xml: missing ${match[1]}`);
}

if (errors.length > 0) {
  console.error(`Site check failed with ${errors.length} error(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Site check passed: ${htmlFiles.length} HTML pages, sitemap and JSON-LD are valid.`);
}
