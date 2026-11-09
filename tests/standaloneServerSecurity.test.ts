import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { connect } from 'node:net';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInterestSeedServer } from '../standalone/src/server';

const dirs: string[] = [];
const servers: Server[] = [];

async function session(base: string): Promise<string> {
  const response = await fetch(`${base}/api/session`);
  const body = await response.json() as { token?: string };
  if (!body.token) throw new Error('missing session token');
  return body.token;
}

async function rawGet(base: string, host: string): Promise<number> {
  const url = new URL(base);
  return new Promise<number>((resolve, reject) => {
    const socket = connect(Number(url.port), url.hostname, () => {
      socket.write(`GET /api/state HTTP/1.1\r\nHost: ${host}\r\nConnection: close\r\n\r\n`);
    });
    let raw = '';
    socket.setEncoding('utf8');
    socket.on('data', (chunk) => { raw += chunk; });
    socket.on('end', () => {
      const match = raw.match(/^HTTP\/1\.[01] (\d{3})/);
      resolve(match ? Number(match[1]) : 0);
    });
    socket.on('error', reject);
  });
}
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

  it('allows the actual localhost origin with a session token', async () => {
    const base = await start();
    const token = await session(base);
    const response = await fetch(`${base}/api/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: new URL(base).origin,
        'X-InterestSeed-Token': token,
      },
      body: '{}',
    });
    expect(response.status).toBe(200);
  });

  it('rejects a loopback origin on another port', async () => {
    const base = await start();
    const token = await session(base);
    const response = await fetch(`${base}/api/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:4173', 'X-InterestSeed-Token': token },
      body: '{}',
    });
    expect(response.status).toBe(403);
  });

  it('rejects a foreign Host header', async () => {
    const base = await start();
    expect(await rawGet(base, 'evil.example')).toBe(403);
  });

  it('requires a session token for browser-origin writes', async () => {
    const base = await start();
    const response = await fetch(`${base}/api/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: new URL(base).origin },
      body: '{}',
    });
    expect(response.status).toBe(403);
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
    expect(response.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect(response.headers.get('permissions-policy')).toContain('camera=()');
    expect(response.headers.get('cross-origin-opener-policy')).toBe('same-origin');
    expect(response.headers.get('x-permitted-cross-domain-policies')).toBe('none');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.get('cross-origin-resource-policy')).toBe('same-origin');
    expect(response.headers.get('content-type')).toContain('text/html');
  });

  it('sets no-store and nosniff headers on JSON API responses', async () => {
    const base = await start();
    const response = await fetch(`${base}/api/state`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
  });

  it('serves the standalone web assets with correct MIME types', async () => {
    const base = await start();
    const script = await fetch(`${base}/app.js`);
    expect(script.status).toBe(200);
    expect(script.headers.get('content-type')).toContain('javascript');

    const styles = await fetch(`${base}/styles.css`);
    expect(styles.status).toBe(200);
    expect(styles.headers.get('content-type')).toContain('text/css');
  });

  it('returns 404 for missing static files', async () => {
    const base = await start();
    const response = await fetch(`${base}/missing-file.js`);
    expect(response.status).toBe(404);
  });

  it('does not serve files outside the web root', async () => {
    const base = await start();
    const response = await fetch(`${base}/%2e%2e/%2e%2e/package.json`);
    expect(response.status).not.toBe(200);
    expect(await response.text()).not.toContain('"name": "interestseed"');
  });

  it('does not leak internal exception text on a route error', async () => {
    const base = await start();
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const response = await fetch(`${base}/api/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{',
      });
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Invalid JSON body.' });
    } finally {
      log.mockRestore();
    }
  });

  it('rejects request bodies above 1 MiB', async () => {
    const base = await start();
    const response = await fetch(`${base}/api/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'x'.repeat(1024 * 1024 + 1),
    });
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: 'Request body too large.' });
  });

  it('rejects remote AI base URLs unless explicitly allowed', async () => {
    const base = await start();
    const tested = await fetch(`${base}/api/config/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseUrl: 'https://api.example.com/v1' }),
    });
    expect(tested.status).toBe(400);
    const saved = await fetch(`${base}/api/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseUrl: 'https://api.example.com/v1' }),
    });
    expect(saved.status).toBe(400);
  });
  it('rejects non-http API base URLs', async () => {
    const base = await start();
    const response = await fetch(`${base}/api/config/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseUrl: 'ftp://127.0.0.1/model' }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ ok: false });
  });
});
