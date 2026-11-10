/* global process, URL, setTimeout, clearTimeout, fetch */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverPath = fileURLToPath(new URL('./server.mjs', import.meta.url));
const TOKEN = 'test-token-1234567890';

const GRAPH = JSON.stringify({
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

/** Start the server in HTTP mode on a free port and wait for its listening line. */
async function startHttp({ token = TOKEN, extraArgs = [] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'interestseed-mcp-http-'));
  const graph = join(dir, 'graph.json');
  writeFileSync(graph, GRAPH);

  const args = [serverPath, '--http', '0', '--graph', graph, ...extraArgs];
  if (token) args.push('--token', token);

  const child = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let stdout = '';
  let stderr = '';

  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`server did not listen: ${stderr}`)), 10000);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      const line = stdout.split('\n').find((entry) => entry.trim().startsWith('{'));
      if (!line) return;
      clearTimeout(timer);
      try {
        resolve(JSON.parse(line).url);
      } catch (cause) {
        reject(cause);
      }
    });
    child.on('error', (cause) => {
      clearTimeout(timer);
      reject(cause);
    });
  });

  const stop = () => {
    child.kill();
    rmSync(dir, { recursive: true, force: true });
  };
  return { url, stderr: () => stderr, stop };
}

function rpc(url, body, { token = TOKEN, method = 'POST', path = '/mcp', headers = {} } = {}) {
  return fetch(`${url}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

test('http: health check needs no token', async () => {
  const srv = await startHttp();
  try {
    const res = await rpc(srv.url, undefined, { token: '', method: 'GET', path: '/health' });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.protocolVersion, '2026-07-28');
  } finally {
    srv.stop();
  }
});

test('http: rejects requests without a token', async () => {
  const srv = await startHttp();
  try {
    const res = await rpc(srv.url, { jsonrpc: '2.0', id: 1, method: 'tools/list' }, { token: '' });
    assert.equal(res.status, 401);
    assert.equal((await res.json()).error, 'unauthorized');
  } finally {
    srv.stop();
  }
});

test('http: rejects a wrong token', async () => {
  const srv = await startHttp();
  try {
    const res = await rpc(srv.url, { jsonrpc: '2.0', id: 1, method: 'tools/list' }, { token: 'wrong-token' });
    assert.equal(res.status, 401);
  } finally {
    srv.stop();
  }
});

test('http: initialize returns a session id', async () => {
  const srv = await startHttp();
  try {
    const res = await rpc(srv.url, { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
    assert.equal(res.status, 200);
    assert.ok(res.headers.get('mcp-session-id'));
    const body = await res.json();
    assert.equal(body.result.protocolVersion, '2026-07-28');
    assert.equal(body.result.serverInfo.name, 'interestseed');
  } finally {
    srv.stop();
  }
});

test('http: tools/list returns all five tools', async () => {
  const srv = await startHttp();
  try {
    const res = await rpc(srv.url, { jsonrpc: '2.0', id: 2, method: 'tools/list' });
    const body = await res.json();
    assert.equal(body.result.tools.length, 5);
  } finally {
    srv.stop();
  }
});

test('http: tools/call reads the graph', async () => {
  const srv = await startHttp();
  try {
    const res = await rpc(srv.url, {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'interestseed_get_graph', arguments: {} },
    });
    const body = await res.json();
    assert.equal(body.result.content[0].type, 'text');
    assert.ok(body.result.content[0].text.includes('测试兴趣'));
  } finally {
    srv.stop();
  }
});

test('http: notifications return 202 with no body', async () => {
  const srv = await startHttp();
  try {
    const res = await rpc(srv.url, { jsonrpc: '2.0', method: 'notifications/initialized' });
    assert.equal(res.status, 202);
    assert.equal(await res.text(), '');
  } finally {
    srv.stop();
  }
});

test('http: unknown method returns a JSON-RPC error', async () => {
  const srv = await startHttp();
  try {
    const res = await rpc(srv.url, { jsonrpc: '2.0', id: 4, method: 'nope/nope' });
    const body = await res.json();
    assert.equal(body.error.code, -32601);
  } finally {
    srv.stop();
  }
});

test('http: batch requests return an array', async () => {
  const srv = await startHttp();
  try {
    const res = await rpc(srv.url, [
      { jsonrpc: '2.0', id: 5, method: 'ping' },
      { jsonrpc: '2.0', id: 6, method: 'tools/list' },
    ]);
    const body = await res.json();
    assert.ok(Array.isArray(body));
    assert.equal(body.length, 2);
  } finally {
    srv.stop();
  }
});

test('http: malformed JSON returns a parse error', async () => {
  const srv = await startHttp();
  try {
    const res = await fetch(`${srv.url}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` },
      body: '{not json',
    });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error.code, -32700);
  } finally {
    srv.stop();
  }
});

test('http: preflight advertises the auth header', async () => {
  const srv = await startHttp();
  try {
    const res = await rpc(srv.url, undefined, { token: '', method: 'OPTIONS' });
    assert.equal(res.status, 204);
    assert.match(res.headers.get('access-control-allow-headers') ?? '', /authorization/);
  } finally {
    srv.stop();
  }
});

test('http: unknown path is 404 and GET /mcp is 405', async () => {
  const srv = await startHttp();
  try {
    const notFound = await rpc(srv.url, undefined, { method: 'GET', path: '/nope' });
    assert.equal(notFound.status, 404);
    const wrongMethod = await rpc(srv.url, undefined, { method: 'GET', path: '/mcp' });
    assert.equal(wrongMethod.status, 405);
  } finally {
    srv.stop();
  }
});

test('http: generates a token when none is supplied', async () => {
  const srv = await startHttp({ token: '' });
  try {
    // Without the generated token the request must be refused.
    const denied = await rpc(srv.url, { jsonrpc: '2.0', id: 7, method: 'ping' }, { token: '' });
    assert.equal(denied.status, 401);
    assert.match(srv.stderr(), /INTERESTSEED_MCP_TOKEN=/);
  } finally {
    srv.stop();
  }
});
