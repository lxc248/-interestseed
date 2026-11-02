#!/usr/bin/env node
/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Copyright (C) 2026 aicoder
 *
 * Lightweight copy monitor. Searches public GitHub metadata for repositories
 * that present themselves as InterestSeed, plus a few unique code strings.
 * It is a signal, not a legal conclusion. Review every hit manually.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const TOKEN = process.env.GITHUB_TOKEN;
if (!TOKEN) {
  console.error('GITHUB_TOKEN is required');
  process.exit(1);
}

const OWNER = 'lxc248';
const REPO = '-interestseed';
const SELF = `${OWNER}/${REPO}`.toLowerCase();
const OUT = 'review/copy-monitor-latest.md';
const API = 'https://api.github.com';

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  'User-Agent': 'InterestSeed-copy-monitor',
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function gh(path, accept = headers.Accept) {
  const response = await fetch(`${API}${path}`, { headers: { ...headers, Accept: accept } });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status} ${path}: ${text.slice(0, 300)}`);
  }
  return response.json();
}

function addHit(map, hit) {
  const key = `${hit.kind}:${hit.repo}:${hit.path ?? ''}`;
  if (map.has(key)) return;
  map.set(key, hit);
}

const repoQueries = [
  'InterestSeed in:name,description',
  'interestseed in:name,description',
];

const codeQueries = [
  '"InterestSeedGraphBuilder"',
  '"interestseed-ai-key"',
  '"InterestSeedGraphStore"',
  '"discovery feedback lifecycle"',
];

const hits = new Map();

for (const query of repoQueries) {
  const url = `/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=30`;
  const result = await gh(url);
  for (const item of result.items ?? []) {
    if (item.full_name.toLowerCase() === SELF) continue;
    addHit(hits, {
      kind: 'repo',
      repo: item.full_name,
      url: item.html_url,
      detail: `stars=${item.stargazers_count} · ${item.description ?? 'no description'}`,
      high: /interestseed/i.test(`${item.name} ${item.description ?? ''}`),
    });
  }
  await sleep(1500);
}

for (const query of codeQueries) {
  const url = `/search/code?q=${encodeURIComponent(query)}&per_page=20`;
  try {
    const result = await gh(url, 'application/vnd.github.text-match+json');
    for (const item of result.items ?? []) {
      const repo = item.repository?.full_name ?? 'unknown';
      if (repo.toLowerCase() === SELF) continue;
      addHit(hits, {
        kind: 'code',
        repo,
        path: item.path,
        url: item.html_url,
        detail: query,
        high: true,
      });
    }
  } catch (error) {
    addHit(hits, {
      kind: 'error',
      repo: 'search',
      detail: `${query}: ${String(error.message).slice(0, 180)}`,
      high: false,
    });
  }
  await sleep(2000);
}

let forks = [];
try {
  forks = await gh(`/repos/${OWNER}/${REPO}/forks?per_page=100&sort=newest`);
} catch {
  forks = [];
}

const all = [...hits.values()];
const high = all.filter((hit) => hit.high);
const code = all.filter((hit) => hit.kind === 'code');
const errors = all.filter((hit) => hit.kind === 'error');

const lines = [
  '# InterestSeed copy monitor',
  '',
  `Generated: ${new Date().toISOString()}`,
  `Repository: https://github.com/${OWNER}/${REPO}`,
  '',
  'This is a public-metadata signal, not a legal conclusion. A hit may be a',
  'legitimate fork, a mention, or an unrelated project with a similar name.',
  '',
  `High findings: ${high.length}`,
  '',
  '## High-signal hits',
  '',
  ...(high.length
    ? high.map((hit) => `- **${hit.repo}** — ${hit.url ?? ''}\n  - ${hit.detail}${hit.path ? ` · \`${hit.path}\`` : ''}`)
    : ['- none']),
  '',
  '## Code-string hits',
  '',
  ...(code.length
    ? code.map((hit) => `- **${hit.repo}** — \`${hit.path}\`\n  - ${hit.detail}`)
    : ['- none']),
  '',
  '## Forks of record',
  '',
  ...(forks.length
    ? forks.map((fork) => `- ${fork.full_name} — ${fork.html_url} (fork is allowed if it follows TRADEMARKS.md)`)
    : ['- none']),
  '',
  '## Search errors',
  '',
  ...(errors.length ? errors.map((hit) => `- ${hit.detail}`) : ['- none']),
  '',
  '## Manual follow-up',
  '',
  '1. Open every high-signal hit and check whether LICENSE, NOTICE and',
  '   copyright notices are preserved.',
  '2. If it is a hosted derivative, check whether it offers corresponding',
  '   source as AGPL-3.0 requires.',
  '3. If it presents itself as official InterestSeed, record screenshots and',
  '   contact the maintainer; escalate to the host if unresolved.',
  '',
];

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, lines.join('\n'), 'utf8');
console.log(lines.join('\n'));
