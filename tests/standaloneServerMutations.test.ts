/**
 * 补上 standalone 服务里此前没有行为测试的写端点。
 * 这些路由都会改 vault 数据，属于风险最高的一类。
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createInterestSeedServer } from '../standalone/src/server';

const dirs: string[] = [];
const servers: Server[] = [];

async function start(): Promise<string> {
  const vaultPath = await mkdtemp(join(tmpdir(), 'interestseed-mutations-'));
  dirs.push(vaultPath);
  const server = createInterestSeedServer({ vaultPath, port: 0 });
  servers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address() as AddressInfo | null;
  if (!address) throw new Error('server did not bind');
  return `http://127.0.0.1:${address.port}`;
}

function jsonHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json' };
}

async function post(base: string, path: string, body: unknown): Promise<Response> {
  return fetch(`${base}${path}`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(body),
  });
}

function expectNoInternalLeak(body: Record<string, unknown>): void {
  const text = JSON.stringify(body);
  expect(text).not.toMatch(/\bstack\b/i);
  expect(text).not.toMatch(/at .*\.ts:\d+/);
}

afterEach(async () => {
  for (const server of servers.splice(0)) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
});

describe('standalone server mutation routes', () => {
  it('serves the raw graph', async () => {
    const base = await start();
    const response = await fetch(`${base}/api/graph`);
    expect(response.status).toBe(200);
    const graph = await response.json();
    expect(Array.isArray(graph.nodes)).toBe(true);
    expect(Array.isArray(graph.edges)).toBe(true);
  });

  it('returns an actionable 409 when AI is not configured', async () => {
    const base = await start();
    const getResponse = await fetch(`${base}/api/suggest?nodeId=missing`);
    expect(getResponse.status).toBe(409);
    const getBody = await getResponse.json();
    expect(String(getBody.error)).toMatch(/AI 已关闭|API key/i);
    expectNoInternalLeak(getBody);

    const postResponse = await post(base, '/api/suggest', { nodeId: 'missing' });
    expect(postResponse.status).toBe(409);
    expect(String((await postResponse.json()).error)).toMatch(/AI 已关闭|API key/i);
  });

  it('validates edge rejection input', async () => {
    const base = await start();
    const missing = await post(base, '/api/edges/reject', {});
    expect(missing.status).toBe(400);
    expect((await missing.json()).error).toBe('edgeId required');

    const unknown = await post(base, '/api/edges/reject', { edgeId: 'nope' });
    expect(unknown.status).toBe(404);
    expect((await unknown.json()).error).toBe('Edge not found.');
  });

  it('refreshes discoveries without mutating the graph', async () => {
    const base = await start();
    const response = await post(base, '/api/discoveries/refresh', {});
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.discoveries)).toBe(true);

    const graph = await (await fetch(`${base}/api/graph`)).json();
    expect(graph.nodes).toEqual([]);
  });

  it('reports unknown discovery ids as ok:false without leaking internals', async () => {
    const base = await start();
    const cases: Array<[string, unknown]> = [
      ['/api/discoveries/apply', { id: 'missing' }],
      ['/api/discoveries/dismiss', { id: 'missing' }],
      ['/api/discoveries/feedback', { id: 'missing', action: 'accepted' }],
    ];
    for (const [path, payload] of cases) {
      const response = await post(base, path, payload);
      expect(response.status, `${path} status`).toBe(200);
      const body = await response.json();
      expect(body.ok, `${path} should report failure`).toBe(false);
      expect(body.message).toBe('Discovery not found.');
      expectNoInternalLeak(body);
    }
  });

  it('resolves an inbox item into the graph when kept', async () => {
    const base = await start();
    const enqueued = await post(base, '/api/inbox', {
      text: '一条用于端点测试的真实分享内容',
      source: 'clipboard',
    });
    expect(enqueued.status).toBe(200);
    const enqueuedBody = await enqueued.json();
    const id = enqueuedBody.item?.id ?? enqueuedBody.id;
    expect(typeof id).toBe('string');

    const resolved = await post(base, '/api/inbox/resolve', { id, status: 'kept' });
    expect(resolved.status).toBe(200);
    const resolvedBody = await resolved.json();
    expect(resolvedBody.ok).toBe(true);
    expect(Array.isArray(resolvedBody.graph?.nodes)).toBe(true);
    expect(resolvedBody.graph.nodes.length).toBeGreaterThan(0);
  });

  it('logs and extends an experiment', async () => {
    const base = await start();
    const created = await post(base, '/api/experiments', { title: '端点测试实验' });
    expect(created.status).toBe(200);
    const createdBody = await created.json();
    const experimentId = createdBody.experiment?.id ?? createdBody.experiment?.state?.id;
    expect(typeof experimentId).toBe('string');

    const logged = await post(base, '/api/experiments/log', {
      id: experimentId,
      interest: 4,
      energy: 3,
      evidence: '真实做了一次',
    });
    expect(logged.status).toBe(200);
    const loggedBody = await logged.json();
    expect(loggedBody.ok).toBe(true);
    expect(loggedBody.experiment.logs.length).toBeGreaterThan(0);

    const extended = await post(base, '/api/experiments/extend', {
      id: experimentId,
      targetDays: 7,
    });
    expect(extended.status).toBe(200);
    expect((await extended.json()).ok).toBe(true);
  });

  it('maps experiment domain failures to 400 and 404', async () => {
    const base = await start();

    const noTitle = await post(base, '/api/experiments', {});
    expect(noTitle.status).toBe(400);
    expect((await noTitle.json()).error).toBe('Experiment title is required.');

    for (const path of ['/api/experiments/log', '/api/experiments/extend']) {
      const response = await post(base, path, { id: 'missing', targetDays: 7 });
      expect(response.status, `${path} status`).toBe(404);
      const body = await response.json();
      expect(body.error).toBe('Experiment not found.');
      expectNoInternalLeak(body);
    }
  });
});
