import { mkdtemp, rm } from 'node:fs/promises';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { startServer } from '../standalone/src/server';

const dirs: string[] = [];

afterEach(async () => {
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
});

describe('standalone server startup', () => {
  it('logs the bound port and the local-only warning', async () => {
    const vaultPath = await mkdtemp(join(tmpdir(), 'interestseed-startup-'));
    dirs.push(vaultPath);
    const logs: string[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(' '));
    });

    const server = startServer({ vaultPath, port: 0 });
    await once(server, 'listening');
    await new Promise((resolve) => setTimeout(resolve, 10));

    const output = logs.join('\n');
    expect(output).toMatch(/InterestSeed running at http:\/\/127\.0\.0\.1:\d+/);
    expect(output).toContain('Local only: do not expose this port to a network.');

    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve(undefined)));
    });
    spy.mockRestore();
  });

  it('reports an occupied port without an unhandled exception', async () => {
    const vaultPath = await mkdtemp(join(tmpdir(), 'interestseed-startup-'));
    dirs.push(vaultPath);
    const blocker = createServer();
    blocker.listen(0, '127.0.0.1');
    await once(blocker, 'listening');
    const address = blocker.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const errors: string[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      errors.push(args.map(String).join(' '));
    });

    const server = startServer({ vaultPath, port });
    await once(server, 'error');
    expect(errors.join('\n')).toContain('already in use');

    spy.mockRestore();
    process.exitCode = 0;
    await new Promise((resolve) => blocker.close(() => resolve(undefined)));
  });
});
