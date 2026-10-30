/* global process, URL */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const server = fileURLToPath(new URL('./server.mjs', import.meta.url));

function runServer(input) {
  const dir = mkdtempSync(join(tmpdir(), 'interestseed-mcp-'));
  const graph = join(dir, 'graph.json');
  writeFileSync(
    graph,
    JSON.stringify({
      schemaVersion: 2,
      updatedAt: '2026-01-01T00:00:00.000Z',
      nodes: [
        { id: 'a', type: 'topic', title: '测试兴趣', tags: ['focus'], createdAt: '', updatedAt: '', metadata: {} },
        { id: 'b', type: 'video', title: '测试视频', tags: [], createdAt: '', updatedAt: '', metadata: {} },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b', relation: '引出', origin: 'user', status: 'confirmed', createdAt: '', updatedAt: '' },
      ],
    }),
  );
  const result = spawnSync(process.execPath, [server, '--graph', graph], {
    input: input.join('\n'),
    encoding: 'utf8',
    windowsHide: true,
  });
  rmSync(dir, { recursive: true, force: true });
  if (result.status !== 0) {
    throw new Error(`server exit ${result.status}: ${result.stderr}`);
  }
  const lines = (result.stdout || '')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  return { lines, stderr: result.stderr ?? '' };
}

test('initialize and tools/call', () => {
  const { lines } = runServer([
    JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
    JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'interestseed_get_graph', arguments: {} } }),
  ]);
  assert.equal(lines[0].result.protocolVersion, '2026-07-28');
  assert.equal(lines[1].result.content[0].type, 'text');
  const payload = JSON.parse(lines[1].result.content[0].text);
  assert.equal(payload.summary.nodes, 2);
  assert.equal(payload.summary.edges, 1);
});

test('invalid tool returns a stable error without leaking paths', () => {
  const { lines } = runServer([
    JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'interestseed_unknown', arguments: {} } }),
  ]);
  const text = lines[0].result.content[0].text;
  assert.match(text, /InterestSeed MCP 错误/);
  assert.doesNotMatch(text, /C:\\\\|\\\\Users\\\\/);
});
