import { existsSync } from 'node:fs';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ShareInbox, type InboxSource, type InboxStatus, type ShareInboxItem } from '../../src/inbox/ShareInbox';
import { captureToVault } from './capture';
import { ensureStateDir, stateDir } from './state';

const FILE = 'inbox.json';

function pathFor(vaultPath: string): string {
  return join(stateDir(vaultPath), FILE);
}

async function load(vaultPath: string): Promise<ShareInbox> {
  const inbox = new ShareInbox();
  const path = pathFor(vaultPath);
  if (!existsSync(path)) return inbox;
  const raw = (await readFile(path, 'utf8')).replace(/^\uFEFF/, '');
  const parsed = JSON.parse(raw) as { items?: unknown };
  inbox.load(parsed.items);
  return inbox;
}

async function save(vaultPath: string, inbox: ShareInbox): Promise<void> {
  await ensureStateDir(vaultPath);
  const path = pathFor(vaultPath);
  const temp = `${path}.tmp`;
  await writeFile(temp, `${JSON.stringify({ items: inbox.serialize() }, null, 2)}\n`, 'utf8');
  await rename(temp, path);
}

export async function listInbox(vaultPath: string): Promise<ShareInboxItem[]> {
  return [...(await load(vaultPath)).all()];
}

export async function enqueueInbox(
  vaultPath: string,
  text: string,
  source: InboxSource = 'clipboard',
  sourceRef = '',
): Promise<{ item: ShareInboxItem; duplicate: boolean }> {
  const inbox = await load(vaultPath);
  const result = inbox.enqueue(text, source, sourceRef);
  if (!result) throw new Error('Nothing to enqueue.');
  await save(vaultPath, inbox);
  return result;
}

export async function resolveInbox(
  vaultPath: string,
  id: string,
  status: Exclude<InboxStatus, 'pending'>,
): Promise<{ item: ShareInboxItem; captured?: { path: string; title: string }; nodes?: number }> {
  const inbox = await load(vaultPath);
  const item = inbox.all().find((candidate) => candidate.id === id);
  if (!item) throw new Error('Inbox item not found.');
  let captured: { path: string; title: string } | undefined;
  if (status === 'kept') {
    captured = await captureToVault(vaultPath, { text: item.text });
  }
  const resolved = inbox.resolve(id, status);
  if (!resolved) throw new Error('Inbox item not found.');
  await save(vaultPath, inbox);
  return { item: resolved, ...(captured ? { captured } : {}) };
}
