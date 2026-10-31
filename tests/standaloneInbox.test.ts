import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { enqueueInbox, listInbox, resolveInbox } from '../standalone/src/inbox';
import { scanVault } from '../standalone/src/vault';
import { DEFAULT_CONFIG } from '../standalone/src/state';

const dirs: string[] = [];

async function vault(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'interestseed-inbox-'));
  dirs.push(dir);
  return dir;
}

afterEach(async () => {
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
});

describe('standalone share inbox', () => {
  it('queues a saved item without touching the graph', async () => {
    const root = await vault();
    const result = await enqueueInbox(root, '一条想验证的收藏', 'clipboard');
    expect(result.duplicate).toBe(false);
    expect(await listInbox(root)).toHaveLength(1);
    const scan = await scanVault(root, DEFAULT_CONFIG);
    expect(scan.nodes).toHaveLength(0);
  });

  it('keeps an item by writing it into the vault inbox', async () => {
    const root = await vault();
    const queued = await enqueueInbox(root, '一条想验证的收藏', 'clipboard');
    const kept = await resolveInbox(root, queued.item.id, 'kept');
    expect(kept.item.status).toBe('kept');
    expect(kept.captured?.path).toContain('InterestSeed/Inbox/');
    const scan = await scanVault(root, DEFAULT_CONFIG);
    expect(scan.nodes).toHaveLength(1);
  });
});
