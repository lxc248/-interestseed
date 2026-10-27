import { describe, expect, it } from 'vitest';

import {
  buildDiscoveryAuditFromProjection,
  projectDiscoveryAuditRecord,
  type DiscoveryAuditScope,
} from '../src/discovery/audit';
import { AuditVaultBinding } from '../src/discovery/auditBinding';
import {
  AUDIT_DISCOVERY_KEY,
  AuditRuntimeSession,
  loadDiscoveryAuditSource,
  type AuditRuntimeState,
  type DiscoveryAuditReadOnlyAdapter,
} from '../src/discovery/auditSource';
import { generateDiscoveries } from '../src/discovery/DiscoveryEngine';
import { emptyDiscoveryFile } from '../src/discovery/types';
import { qualityFixture } from './discoveryQuality';

const NOW = '2026-01-01T00:00:00.000Z';
const BINDING = AuditVaultBinding.fromVault({});
const SAFE_STATE: AuditRuntimeState = {
  blocked: false,
  issues: [],
  queuePending: false,
  queueFailed: false,
  queueClosed: false,
  memoryMatchesPersisted: true,
  sourceRegistered: true,
};
const SCOPE: DiscoveryAuditScope = {
  binding: BINDING,
  rangeConfirmed: true,
  projectKeys: ['P1', 'P2'],
  includeDismissed: false,
  maxActive: 50,
  maxDismissed: 20,
};

function session(state: AuditRuntimeState = SAFE_STATE): AuditRuntimeSession {
  return AuditRuntimeSession.fromLiveRuntime(() => state);
}

class ReadOnlyFake implements DiscoveryAuditReadOnlyAdapter {
  readonly binding = BINDING;
  readonly reads: string[] = [];
  readonly writes: string[] = [];

  constructor(private readonly raw: string | null) {}

  async readExact(key: string): Promise<string | null> {
    this.reads.push(key);
    return this.raw;
  }
}

function rawFixture(): string {
  const { graph } = qualityFixture();
  return JSON.stringify(generateDiscoveries(graph, emptyDiscoveryFile(NOW), () => NOW));
}

describe('Discovery audit source and projection', () => {
  it('reads only primary through readExact and never writes', async () => {
    const fake = new ReadOnlyFake(rawFixture());
    const result = await loadDiscoveryAuditSource(fake, BINDING, session());

    expect(result.ok).toBe(true);
    expect(fake.reads).toEqual([AUDIT_DISCOVERY_KEY]);
    expect(fake.writes).toEqual([]);
  });

  it('does not read backup when primary is missing', async () => {
    const fake = new ReadOnlyFake(null);
    const result = await loadDiscoveryAuditSource(fake, BINDING, session());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('missing');
    expect(fake.reads).toEqual([AUDIT_DISCOVERY_KEY]);
  });

  it('fails safely for blocked, incomplete, corrupt and unsupported schema', async () => {
    const raw = rawFixture();
    const blocked = await loadDiscoveryAuditSource(
      new ReadOnlyFake(raw),
      BINDING,
      session({ ...SAFE_STATE, blocked: true }),
    );
    const incomplete = await loadDiscoveryAuditSource(
      new ReadOnlyFake(raw),
      BINDING,
      session({ ...SAFE_STATE, issues: ['sanitized'] }),
    );
    const corrupt = await loadDiscoveryAuditSource(
      new ReadOnlyFake('{'),
      BINDING,
      session(),
    );
    const invalidShape = await loadDiscoveryAuditSource(
      new ReadOnlyFake(JSON.stringify({ discoverySchemaVersion: 2, discoveries: {} })),
      BINDING,
      session(),
    );
    const legacy = await loadDiscoveryAuditSource(
      new ReadOnlyFake(JSON.stringify({ discoverySchemaVersion: 999, discoveries: [] })),
      BINDING,
      session(),
    );

    for (const result of [blocked, incomplete, corrupt, invalidShape, legacy]) {
      expect(result.ok).toBe(false);
    }
    expect(blocked.ok ? '' : blocked.code).toBe('blocked');
    expect(incomplete.ok ? '' : incomplete.code).toBe('incomplete');
    expect(corrupt.ok ? '' : corrupt.code).toBe('corrupt');
    expect(invalidShape.ok ? '' : invalidShape.code).toBe('corrupt');
    expect(legacy.ok ? '' : legacy.code).toBe('unsupported-schema');
  });

  it('fails safely when the observed runtime state is unsafe', async () => {
    const cases = [
      { ...SAFE_STATE, queuePending: true },
      { ...SAFE_STATE, queueFailed: true },
      { ...SAFE_STATE, queueClosed: true },
      { ...SAFE_STATE, memoryMatchesPersisted: false },
      { ...SAFE_STATE, sourceRegistered: false },
    ];
    for (const runtimeState of cases) {
      const result = await loadDiscoveryAuditSource(
        new ReadOnlyFake(rawFixture()),
        BINDING,
        session(runtimeState),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe('incomplete');
    }
  });

  it('rejects an unsafe runtime session before reading', async () => {
    const fake = new ReadOnlyFake(rawFixture());
    const result = await loadDiscoveryAuditSource(
      fake,
      BINDING,
      session({ ...SAFE_STATE, queuePending: true }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('incomplete');
    expect(fake.reads).toEqual([]);
  });

  it('rejects invalid or expired binding and adapter mismatch', async () => {
    const inactive = AuditVaultBinding.fromVault({});
    inactive.invalidate();
    const inactiveResult = await loadDiscoveryAuditSource(
      new ReadOnlyFake(rawFixture()),
      inactive,
      session(),
    );
    const otherBinding = AuditVaultBinding.fromVault({});
    const mismatchAdapter = new ReadOnlyFake(rawFixture());
    Object.defineProperty(mismatchAdapter, 'binding', { value: otherBinding });
    const mismatchResult = await loadDiscoveryAuditSource(
      mismatchAdapter,
      BINDING,
      session(),
    );

    expect(inactiveResult.ok).toBe(false);
    expect(mismatchResult.ok).toBe(false);
  });

  it('cancels after read and before projection', async () => {
    const controller = new AbortController();
    const fake = new ReadOnlyFake(rawFixture());
    const original = fake.readExact.bind(fake);
    fake.readExact = async (key: string) => {
      const raw = await original(key);
      controller.abort();
      return raw;
    };

    const result = await loadDiscoveryAuditSource(fake, BINDING, session(), {
      signal: controller.signal,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('cancelled');
  });

  it('rejects an invalidated runtime session', async () => {
    const runtime = session();
    runtime.invalidate();
    const result = await loadDiscoveryAuditSource(
      new ReadOnlyFake(rawFixture()),
      BINDING,
      runtime,
    );
    expect(result.ok).toBe(false);
  });

  it('rejects when runtime state changes during read', async () => {
    let calls = 0;
    const runtime = AuditRuntimeSession.fromLiveRuntime(() => {
      calls += 1;
      return calls === 1 ? SAFE_STATE : { ...SAFE_STATE, queuePending: true };
    });
    const fake = new ReadOnlyFake(rawFixture());
    const result = await loadDiscoveryAuditSource(fake, BINDING, runtime);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('incomplete');
    expect(fake.reads).toEqual([AUDIT_DISCOVERY_KEY]);
  });

  it('rejects adapter read exceptions without leaking raw data', async () => {
    const fake = new ReadOnlyFake(rawFixture());
    fake.readExact = async () => {
      throw new Error('SENSITIVE raw path');
    };
    const result = await loadDiscoveryAuditSource(fake, BINDING, session());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('blocked');
      expect(result.message).not.toContain('SENSITIVE');
    }
  });

  it('rejects when the runtime session is invalidated during read', async () => {
    const runtime = session();
    const fake = new ReadOnlyFake(rawFixture());
    const original = fake.readExact.bind(fake);
    fake.readExact = async (key: string) => {
      const raw = await original(key);
      runtime.invalidate();
      return raw;
    };

    const result = await loadDiscoveryAuditSource(fake, BINDING, runtime);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('incomplete');
  });

  it('projects only minimal fields', () => {
    const raw = JSON.parse(rawFixture()) as Record<string, unknown>;
    const projected = (raw.discoveries as unknown[])
      .map((item) => projectDiscoveryAuditRecord(item))
      .filter((item) => item !== null);
    const text = JSON.stringify(projected);

    expect(projected).toHaveLength(4);
    expect(text).not.toContain('title');
    expect(text).not.toContain('description');
    expect(text).not.toContain('sourceUri');
    expect(text).not.toContain('vault:');
    expect(text).not.toContain('node_');
    expect(text).not.toContain('#shared');
    expect(text).not.toContain('evidence_text');
    expect(text).toContain('theme_');
  });

  it('leaves original input unchanged and aggregates projection', async () => {
    const raw = rawFixture();
    const before = raw;
    const source = await loadDiscoveryAuditSource(
      new ReadOnlyFake(raw),
      BINDING,
      session(),
    );
    expect(source.ok).toBe(true);
    if (!source.ok) return;

    const summary = buildDiscoveryAuditFromProjection(source.projection, SCOPE);
    expect(summary.inputCount).toBe(4);
    expect(summary.includedActive).toBe(4);
    expect(summary.sampledCount).toBe(4);
    expect(summary.feedback.none).toBe(4);
    expect(raw).toBe(before);
  });

  it('does not return a normal audit for invalid records', async () => {
    const raw = JSON.parse(rawFixture()) as {
      discoverySchemaVersion: number;
      updatedAt: string;
      discoveries: Array<Record<string, unknown>>;
    };
    raw.discoveries.push({
      ...raw.discoveries[0],
      id: 'bad',
      status: 'unknown',
    });
    const source = await loadDiscoveryAuditSource(
      new ReadOnlyFake(JSON.stringify(raw)),
      BINDING,
      session(),
    );

    expect(source.ok).toBe(false);
    if (!source.ok) expect(source.code).toBe('incomplete');
  });
});

