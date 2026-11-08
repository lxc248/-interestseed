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
  const vaultPath = await mkdtemp(join(tmpdir(), 'interestseed-server-'));
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

afterEach(async () => {
  for (const server of servers.splice(0)) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
});

describe('standalone server request guards', () => {
  it('rejects state-changing requests without JSON content type', async () => {
    const base = await start();
    const response = await fetch(`${base}/api/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: '{}',
    });
    expect(response.status).toBe(415);
  });

  it('rejects a cross-origin JSON request', async () => {
    const base = await start();
    const response = await fetch(`${base}/api/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' },
      body: '{}',
    });
    expect(response.status).toBe(403);
  });

  it('rejects a null origin', async () => {
    const base = await start();
    const response = await fetch(`${base}/api/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'null' },
      body: '{}',
    });
    expect(response.status).toBe(403);
  });

  it('rejects a cross-site fetch metadata request', async () => {
    const base = await start();
    const response = await fetch(`${base}/api/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'cross-site' },
      body: '{}',
    });
    expect(response.status).toBe(403);
  });

  it('allows a localhost origin', async () => {
    const base = await start();
    const response = await fetch(`${base}/api/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:4173' },
      body: '{}',
    });
    expect(response.status).toBe(200);
  });

  it('allows a CLI-style request without an origin', async () => {
    const base = await start();
    const response = await fetch(`${base}/api/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(response.status).toBe(200);
  });

  it('sets the static-file security headers', async () => {
    const base = await start();
    const response = await fetch(`${base}/`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-security-policy')).toContain("default-src 'self'");
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
  });

  it('does not serve files outside the web root', async () => {
    const base = await start();
    const response = await fetch(`${base}/%2e%2e/%2e%2e/package.json`);
    expect(response.status).not.toBe(200);
    expect(await response.text()).not.toContain('"name": "interestseed"');
  });
});
