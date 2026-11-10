/**
 * /api/config/test 会真的向用户配置的地址发起外部请求，
 * 是唯一一条「服务端替用户出网」的路径，失败分支必须覆盖且不能泄露 Key。
 */
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createInterestSeedServer } from '../standalone/src/server';

const KEY = 'sk-test-should-never-be-echoed';

const dirs: string[] = [];
const servers: Server[] = [];
const upstreams: Server[] = [];

async function start(mainServer?: Server): Promise<string> {
  const vaultPath = await mkdtemp(join(tmpdir(), 'interestseed-cfgtest-'));
  dirs.push(vaultPath);
  const server = mainServer ?? createInterestSeedServer({ vaultPath, port: 0 });
  servers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    if (!server.listening) server.listen(0, '127.0.0.1', () => resolve());
    else resolve();
  });
  const address = server.address() as AddressInfo | null;
  if (!address) throw new Error('server did not bind');
  return `http://127.0.0.1:${address.port}`;
}

async function startUpstream(
  handler: (path: string) => { status: number; headers?: Record<string, string>; body: string },
): Promise<string> {
  const upstream = createServer((request, response) => {
    const result = handler(request.url ?? '/');
    response.writeHead(result.status, {
      'Content-Type': 'application/json',
      ...(result.headers ?? {}),
    });
    response.end(result.body);
  });
  upstreams.push(upstream);
  await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', () => resolve()));
  const address = upstream.address() as AddressInfo | null;
  if (!address) throw new Error('upstream did not bind');
  return `http://127.0.0.1:${address.port}`;
}

async function post(base: string, path: string, body: unknown): Promise<Response> {
  return fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

afterEach(async () => {
  delete process.env.INTERESTSEED_ALLOW_REMOTE_AI;
  for (const server of servers.splice(0)) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  for (const upstream of upstreams.splice(0)) {
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
  }
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
});

describe('POST /api/config/test', () => {
  it('rejects non-http protocols', async () => {
    const base = await start();
    const response = await post(base, '/api/config/test', {
      baseUrl: 'ftp://example.com',
      apiKey: KEY,
    });
    expect(response.status).toBe(400);
    expect(String((await response.json()).message)).toContain('只支持 http(s)');
  });

  it('refuses a remote base url unless explicitly allowed', async () => {
    const base = await start();
    const response = await post(base, '/api/config/test', {
      baseUrl: 'https://api.example.com',
      apiKey: KEY,
    });
    expect(response.status).toBe(400);
    expect(String((await response.json()).message)).toContain('INTERESTSEED_ALLOW_REMOTE_AI');
  });

  it('refuses when no key is configured', async () => {
    const base = await start();
    const response = await post(base, '/api/config/test', { baseUrl: 'http://127.0.0.1:9' });
    expect(response.status).toBe(400);
    expect((await response.json()).message).toBe('还没有配置 Key。');
  });

  it('reports the model list when the provider answers', async () => {
    const upstream = await startUpstream((path) =>
      path.startsWith('/models')
        ? { status: 200, body: JSON.stringify({ data: [{ id: 'a' }, { id: 'b' }] }) }
        : { status: 404, body: '{}' },
    );
    const base = await start();
    const response = await post(base, '/api/config/test', { baseUrl: upstream, apiKey: KEY });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.mode).toBe('models');
    expect(body.modelCount).toBe(2);
    expect(JSON.stringify(body)).not.toContain(KEY);
  });

  it('maps a rate limit to 429 with the retry hint', async () => {
    const upstream = await startUpstream((path) =>
      path.startsWith('/models')
        ? { status: 401, body: '{"error":"unauthorized"}' }
        : { status: 429, headers: { 'Retry-After': '12' }, body: '{"error":"slow down"}' },
    );
    const base = await start();
    const response = await post(base, '/api/config/test', { baseUrl: upstream, apiKey: KEY });
    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(String(body.message)).toContain('12');
    expect(JSON.stringify(body)).not.toContain(KEY);
  });

  it('maps an upstream failure to 502 and redacts the key', async () => {
    const upstream = await startUpstream(() => ({
      status: 500,
      body: JSON.stringify({ error: `boom ${KEY}` }),
    }));
    const base = await start();
    const response = await post(base, '/api/config/test', { baseUrl: upstream, apiKey: KEY });
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.ok).toBe(false);
    const text = JSON.stringify(body);
    expect(text).not.toContain(KEY);
    expect(text).toContain('[redacted]');
  });

  it('maps an unreachable endpoint to 502 without echoing the key', async () => {
    const base = await start();
    const response = await post(base, '/api/config/test', {
      baseUrl: 'http://127.0.0.1:1',
      apiKey: KEY,
    });
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(String(body.message)).toContain('连接失败');
    expect(JSON.stringify(body)).not.toContain(KEY);
  });
});
