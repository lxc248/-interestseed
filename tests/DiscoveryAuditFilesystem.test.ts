import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { App } from 'obsidian';

import { ObsidianDiscoveryAuditAdapter } from '../src/adapters/ObsidianDiscoveryAuditAdapter';
import { AuditVaultBinding } from '../src/discovery/auditBinding';
import {
  AuditRuntimeSession,
  loadDiscoveryAuditSource,
  type AuditRuntimeState,
} from '../src/discovery/auditSource';
import { generateDiscoveries } from '../src/discovery/DiscoveryEngine';
import { emptyDiscoveryFile } from '../src/discovery/types';
import { qualityFixture } from './discoveryQuality';

const NOW = '2026-01-01T00:00:00.000Z';
const PLUGIN_DIR = '.obsidian/plugins/interestseed';
const SAFE_STATE: AuditRuntimeState = {
  blocked: false,
  issues: [],
  queuePending: false,
  queueFailed: false,
  queueClosed: false,
  memoryMatchesPersisted: true,
  sourceRegistered: true,
};

class TempVaultAdapter {
  readonly reads: string[] = [];
  readonly writes: string[] = [];

  constructor(private readonly root: string) {}

  private resolve(vaultPath: string): string {
    return path.join(this.root, ...vaultPath.split('/'));
  }

  async exists(vaultPath: string): Promise<boolean> {
    try {
      await fs.access(this.resolve(vaultPath));
      return true;
    } catch {
      return false;
    }
  }

  async read(vaultPath: string): Promise<string> {
    this.reads.push(vaultPath);
    return fs.readFile(this.resolve(vaultPath), 'utf8');
  }

  async write(vaultPath: string, data: string): Promise<void> {
    this.writes.push(vaultPath);
    await fs.writeFile(this.resolve(vaultPath), data, 'utf8');
  }
}

const roots: string[] = [];

async function fixture(): Promise<{
  root: string;
  adapter: TempVaultAdapter;
  binding: AuditVaultBinding;
  raw: string;
}> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'interestseed-audit-fs-'));
  roots.push(root);
  const adapter = new TempVaultAdapter(root);
  const binding = AuditVaultBinding.fromVault({});
  const { graph } = qualityFixture();
  const raw = JSON.stringify(generateDiscoveries(graph, emptyDiscoveryFile(NOW), () => NOW));
  return { root, adapter, binding, raw };
}

async function writeDiscovery(root: string, name: string, content: string): Promise<void> {
  const dir = path.join(root, ...PLUGIN_DIR.split('/'), 'discoveries');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), content, 'utf8');
}

function sourceApp(adapter: TempVaultAdapter): App {
  return { vault: { adapter } } as unknown as App;
}

function session(): AuditRuntimeSession {
  return AuditRuntimeSession.fromLiveRuntime(() => SAFE_STATE);
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe('audit filesystem isolation with a real temporary directory', () => {
  it('reads exact primary and never falls back to a differing .bak', async () => {
    const { root, adapter, binding, raw } = await fixture();
    await writeDiscovery(root, 'discoveries.json', raw);
    await writeDiscovery(root, 'discoveries.json.bak', JSON.stringify({ schema: 'backup' }));

    const auditAdapter = new ObsidianDiscoveryAuditAdapter(
      sourceApp(adapter),
      PLUGIN_DIR,
      binding,
    );
    const result = await loadDiscoveryAuditSource(auditAdapter, binding, session());

    expect(result.ok).toBe(true);
    expect(adapter.reads).toEqual([`${PLUGIN_DIR}/discoveries/discoveries.json`]);
    expect(adapter.writes).toEqual([]);
  });

  it('reports missing primary even when .bak exists', async () => {
    const { root, adapter, binding, raw } = await fixture();
    await writeDiscovery(root, 'discoveries.json.bak', raw);

    const auditAdapter = new ObsidianDiscoveryAuditAdapter(
      sourceApp(adapter),
      PLUGIN_DIR,
      binding,
    );
    const result = await loadDiscoveryAuditSource(auditAdapter, binding, session());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('missing');
    expect(adapter.reads).toEqual([]);
    expect(adapter.writes).toEqual([]);
  });

  it('reports corrupt primary without replacing it from .bak', async () => {
    const { root, adapter, binding, raw } = await fixture();
    await writeDiscovery(root, 'discoveries.json', '{ not-json');
    await writeDiscovery(root, 'discoveries.json.bak', raw);

    const auditAdapter = new ObsidianDiscoveryAuditAdapter(
      sourceApp(adapter),
      PLUGIN_DIR,
      binding,
    );
    const result = await loadDiscoveryAuditSource(auditAdapter, binding, session());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('corrupt');
    expect(adapter.writes).toEqual([]);
  });

  it('reports unsupported schema and invalid records without writing', async () => {
    const { root, adapter, binding } = await fixture();
    const unsupported = JSON.stringify({ discoverySchemaVersion: 999, discoveries: [] });
    await writeDiscovery(root, 'discoveries.json', unsupported);

    const auditAdapter = new ObsidianDiscoveryAuditAdapter(
      sourceApp(adapter),
      PLUGIN_DIR,
      binding,
    );
    const schemaResult = await loadDiscoveryAuditSource(auditAdapter, binding, session());
    expect(schemaResult.ok).toBe(false);
    if (!schemaResult.ok) expect(schemaResult.code).toBe('unsupported-schema');
    expect(adapter.writes).toEqual([]);

    const invalid = JSON.stringify({
      discoverySchemaVersion: 2,
      discoveries: [{ id: 'bad', status: 'unknown' }],
    });
    await writeDiscovery(root, 'discoveries.json', invalid);
    const invalidResult = await loadDiscoveryAuditSource(auditAdapter, binding, session());
    expect(invalidResult.ok).toBe(false);
    if (!invalidResult.ok) expect(invalidResult.code).toBe('incomplete');
    expect(adapter.writes).toEqual([]);
  });

  it('does not create temp or corrupt files during audit failures', async () => {
    const { root, adapter, binding, raw } = await fixture();
    await writeDiscovery(root, 'discoveries.json', '{ broken');
    await writeDiscovery(root, 'discoveries.json.bak', raw);

    const before = (await fs.readdir(path.join(root, ...PLUGIN_DIR.split('/'), 'discoveries'))).sort();
    const auditAdapter = new ObsidianDiscoveryAuditAdapter(
      sourceApp(adapter),
      PLUGIN_DIR,
      binding,
    );
    await loadDiscoveryAuditSource(auditAdapter, binding, session());
    const after = (await fs.readdir(path.join(root, ...PLUGIN_DIR.split('/'), 'discoveries'))).sort();

    expect(after).toEqual(before);
    expect(after).not.toContain('discoveries.json.tmp');
    expect(after.some((name) => name.includes('corrupt'))).toBe(false);
  });
});
