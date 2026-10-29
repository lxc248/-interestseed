#!/usr/bin/env node
/**
 * InterestSeed Cosmic Viewer — single-file builder.
 *
 * Usage:
 *   node skill/render.mjs --graph graph.json --out star-map.html
 *   node skill/render.mjs --graph graph.json --out star-map.html --title "我的兴趣星图"
 *
 * Zero dependencies. The generated file works offline and requires no Obsidian.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = [here, path.resolve(here, '..')].find((dir) =>
  existsSync(path.join(dir, 'viewer', 'index.html')),
) || path.resolve(here, '..');

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const graphPath = arg('graph', path.join(root, 'viewer', 'graph-data.js'));
const outPath = arg('out', path.join(root, 'star-map.html'));
const title = arg('title', 'InterestSeed · Cosmic Interest Map');

let graph;
if (graphPath.endsWith('.js')) {
  const raw = await readFile(graphPath, 'utf8');
  const sandbox = { window: {} };
  vm.runInNewContext(raw, sandbox, { timeout: 2000 });
  graph = sandbox.window.__INTERESTSEED_GRAPH__;
  if (!graph || !Array.isArray(graph.nodes)) {
    throw new Error('graph file must assign window.__INTERESTSEED_GRAPH__');
  }
} else {
  graph = JSON.parse(await readFile(graphPath, 'utf8'));
}

const htmlPath = path.join(root, 'viewer', 'index.html');
let html = await readFile(htmlPath, 'utf8');
const css = await readFile(path.join(root, 'viewer', 'cosmic.css'), 'utf8');
const js = await readFile(path.join(root, 'viewer', 'cosmic.js'), 'utf8');

html = html.replace('<title>InterestSeed · Cosmic Interest Map</title>', `<title>${escapeHtml(title)}</title>`);
html = html.replace('<link rel="stylesheet" href="cosmic.css" />', `<style>\n${css}\n</style>`);
html = html.replace(
  '<script src="graph-data.js"></script>',
  `<script>window.__INTERESTSEED_GRAPH__ = ${JSON.stringify(graph)};</script>`,
);
html = html.replace('<script src="cosmic.js"></script>', `<script>\n${js}\n</script>`);
await writeFile(outPath, html, 'utf8');
console.log(`wrote ${outPath} (${Buffer.byteLength(html)} bytes)`);

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]);
}
