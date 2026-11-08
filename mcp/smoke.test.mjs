/* global process, URL */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const server = fileURLToPath(new URL('./server.mjs', import.meta.url));

function runServer(input, options = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'interestseed-mcp-'));
  const graph = options.graphPath || join(dir, 'graph.json');
  const payload = JSON.stringify({
    schemaVersion: 2,
    updatedAt: '2026-01-01T00:00:00.000Z',
    nodes: [
      { id: 'a', type: 'topic', title: '测试兴趣', tags: ['focus'], createdAt: '', updatedAt: '', metadata: {} },
      { id: 'b', type: 'video', title: '测试视频', tags: [], createdAt: '', updatedAt: '', metadata: {} },
    ],
    edges: [
      { id: 'e1', source: 'a', target: 'b', relation: '引出', origin: 'user', status: 'confirmed', createdAt: '', updatedAt: '' },
    ],
  });
  if (options.graphDirectory) {
    mkdirSync(graph);
  } else if (options.graphContent !== null) {
    writeFileSync(graph, `${options.bom ? '\uFEFF' : ''}${options.graphContent ?? payload}`);
  }
  const result = spawnSync(process.execPath, [
    server,
    ...(options.minimal ? ['--minimal'] : []),
    '--graph',
    graph,
  ], {
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

test('accepts a UTF-8 BOM graph file', () => {
  const { lines } = runServer(
    [JSON.stringify({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'interestseed_get_graph', arguments: {} } })],
    { bom: true },
  );
  const payload = JSON.parse(lines[0].result.content[0].text);
  assert.equal(payload.summary.nodes, 2);
});

test('keeps serving after malformed JSON', () => {
  const { lines } = runServer([
    'not json',
    JSON.stringify({ jsonrpc: '2.0', id: 5, method: 'initialize', params: {} }),
  ]);
  assert.equal(lines[0].error.code, -32700);
  assert.equal(lines[1].result.protocolVersion, '2026-07-28');
});

test('minimal mode exposes only next-step and experiment', () => {
  const { lines } = runServer([
    JSON.stringify({ jsonrpc: '2.0', id: 6, method: 'initialize', params: {} }),
    JSON.stringify({ jsonrpc: '2.0', id: 7, method: 'tools/list', params: {} }),
    JSON.stringify({ jsonrpc: '2.0', id: 8, method: 'resources/list', params: {} }),
    JSON.stringify({ jsonrpc: '2.0', id: 9, method: 'prompts/list', params: {} }),
  ], { minimal: true });

  assert.deepEqual(
    lines[1].result.tools.map((tool) => tool.name),
    ['interestseed_next_step', 'interestseed_get_experiment'],
  );
  assert.deepEqual(
    lines[2].result.resources.map((resource) => resource.uri),
    ['interestseed://next'],
  );
  assert.equal(lines[3].result.prompts.length, 0);
});

test('minimal mode rejects full graph and prompt access', () => {
  const { lines } = runServer([
    JSON.stringify({ jsonrpc: '2.0', id: 10, method: 'tools/call', params: { name: 'interestseed_get_graph', arguments: {} } }),
    JSON.stringify({ jsonrpc: '2.0', id: 11, method: 'resources/read', params: { uri: 'interestseed://graph' } }),
    JSON.stringify({ jsonrpc: '2.0', id: 12, method: 'prompts/get', params: { name: 'review-interest', arguments: {} } }),
  ], { minimal: true });

  assert.match(lines[0].result.content[0].text, /InterestSeed MCP 错误/);
  assert.equal(lines[1].error.code, -32602);
  assert.equal(lines[2].error.code, -32602);
});

test('minimal mode still returns the next step', () => {
  const { lines } = runServer([
    JSON.stringify({ jsonrpc: '2.0', id: 13, method: 'tools/call', params: { name: 'interestseed_next_step', arguments: {} } }),
  ], { minimal: true });

  const payload = JSON.parse(lines[0].result.content[0].text);
  assert.equal(payload.action, 'capture_spark');
});

test('missing graph returns a stable tool error', () => {
  const { lines } = runServer([
    JSON.stringify({ jsonrpc: '2.0', id: 14, method: 'tools/call', params: { name: 'interestseed_next_step', arguments: {} } }),
  ], { graphContent: null });

  const text = lines[0].result.content[0].text;
  assert.equal(lines[0].result.isError, true);
  assert.match(text, /InterestSeed MCP 错误/);
  assert.doesNotMatch(text, /ENOENT|no such file|graph\.json|图谱文件/i);
});

test('malformed graph returns a stable tool error', () => {
  const { lines } = runServer([
    JSON.stringify({ jsonrpc: '2.0', id: 15, method: 'tools/call', params: { name: 'interestseed_next_step', arguments: {} } }),
  ], { graphContent: 'not json' });

  const text = lines[0].result.content[0].text;
  assert.equal(lines[0].result.isError, true);
  assert.doesNotMatch(text, /SyntaxError|Unexpected token|not json/i);
});

test('graph without nodes or edges returns a stable tool error', () => {
  const { lines } = runServer([
    JSON.stringify({ jsonrpc: '2.0', id: 16, method: 'tools/call', params: { name: 'interestseed_next_step', arguments: {} } }),
  ], { graphContent: JSON.stringify({ nodes: [] }) });

  const text = lines[0].result.content[0].text;
  assert.equal(lines[0].result.isError, true);
  assert.doesNotMatch(text, /nodes|edges|图谱文件缺少/i);
});

test('directory graph path returns a stable tool error', () => {
  const { lines } = runServer([
    JSON.stringify({ jsonrpc: '2.0', id: 17, method: 'tools/call', params: { name: 'interestseed_next_step', arguments: {} } }),
  ], { graphDirectory: true });

  const text = lines[0].result.content[0].text;
  assert.equal(lines[0].result.isError, true);
  assert.doesNotMatch(text, /EISDIR|is a directory|graph\.json/i);
});
