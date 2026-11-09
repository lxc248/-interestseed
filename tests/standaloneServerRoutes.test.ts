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
  const vaultPath = await mkdtemp(join(tmpdir(), 'interestseed-routes-'));
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

afterEach(async () => {
  for (const server of servers.splice(0)) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
});

describe('standalone server routes', () => {
  it('returns state, config, experiments and discoveries', async () => {
    const base = await start();
    const state = await fetch(`${base}/api/state`);
    expect(state.status).toBe(200);
    const stateBody = await state.json();
    expect(stateBody.graph.nodes).toEqual([]);
    expect(stateBody.vaultPath).toBeUndefined();

    const health = await fetch(`${base}/api/health`);
    expect(health.status).toBe(200);
    const healthBody = await health.json();
    expect(healthBody).toMatchObject({ ok: true, service: 'interestseed', localOnly: true });
    expect(typeof healthBody.version).toBe('string');

    const config = await fetch(`${base}/api/config`);
    expect(config.status).toBe(200);
    expect((await config.json()).config.model).toBeTruthy();

    const experiments = await fetch(`${base}/api/experiments`);
    expect(experiments.status).toBe(200);
    expect((await experiments.json()).experiments).toEqual([]);

    const discoveries = await fetch(`${base}/api/discoveries`);
    expect(discoveries.status).toBe(200);
    expect((await discoveries.json()).discoveries).toEqual([]);
  });

  it('accepts an empty scan body', async () => {
    const base = await start();
    const response = await fetch(`${base}/api/scan`, {
      method: 'POST',
      headers: jsonHeaders(),
    });
    expect(response.status).toBe(200);
    expect((await response.json()).graph.nodes).toEqual([]);
  });

  it('updates config through PUT', async () => {
    const base = await start();
    const response = await fetch(`${base}/api/config`, {
      method: 'PUT',
      headers: jsonHeaders(),
      body: JSON.stringify({
        model: 'local-test-model',
        enableAI: false,
        includeFolders: ['Notes'],
      }),
    });
    expect(response.status).toBe(200);
    const saved = await response.json();
    expect(saved.config.model).toBe('local-test-model');
    expect(saved.config.enableAI).toBe(false);
    expect(saved.config.includeFolders).toEqual(['Notes']);

    const readBack = await (await fetch(`${base}/api/config`)).json();
    expect(readBack.config.model).toBe('local-test-model');
  });

  it('captures text and exposes it in state', async () => {
    const base = await start();
    const response = await fetch(`${base}/api/capture`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ text: '测试捕获：一个值得做三天实验的想法' }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.graph.nodes.length).toBeGreaterThan(0);
  });

  it('does not overwrite an existing capture with the same title', async () => {
    const base = await start();
    const body = JSON.stringify({ text: '同名捕获测试。' });
    const first = await fetch(`${base}/api/capture`, { method: 'POST', headers: jsonHeaders(), body });
    const second = await fetch(`${base}/api/capture`, { method: 'POST', headers: jsonHeaders(), body });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const firstBody = await first.json();
    const secondBody = await second.json();
    expect(secondBody.captured.path).not.toBe(firstBody.captured.path);
  });
  it('enqueues and lists inbox items', async () => {
    const base = await start();
    const created = await fetch(`${base}/api/inbox`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ text: '待处理的一条收藏', source: 'clipboard', sourceRef: 'test' }),
    });
    expect(created.status).toBe(200);
    expect((await created.json()).ok).toBe(true);

    const listed = await fetch(`${base}/api/inbox`);
    expect(listed.status).toBe(200);
    const items = (await listed.json()).items;
    expect(items).toHaveLength(1);
    expect(items[0].text).toContain('待处理');
  });

  it('validates and persists experiment decisions', async () => {
    const base = await start();
    const invalid = await fetch(`${base}/api/experiments/decision`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ decision: 'maybe' }),
    });
    expect(invalid.status).toBe(400);
    const missing = await fetch(`${base}/api/experiments/decision`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ decision: 'keep' }),
    });
    expect(missing.status).toBe(400);
    const accepted = await fetch(`${base}/api/experiments/decision`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ id: 'visual-experiment', decision: 'keep', note: 'done' }),
    });
    expect(accepted.status).toBe(200);
    expect(await accepted.json()).toMatchObject({ ok: true, decision: 'keep' });
  });
  it('handles empty undo and missing connect suggestions', async () => {
    const base = await start();
    const undo = await fetch(`${base}/api/undo`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: '{}',
    });
    expect(undo.status).toBe(200);
    expect(await undo.json()).toMatchObject({ ok: false });

    const connect = await fetch(`${base}/api/connect`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: '{}',
    });
    expect(connect.status).toBe(400);
    expect(await connect.json()).toEqual({ error: 'suggestion required' });
  });
});
