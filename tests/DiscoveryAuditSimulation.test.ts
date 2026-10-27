import { describe, expect, it } from 'vitest';

import { AuditVaultBinding } from '../src/discovery/auditBinding';
import {
  AuditRuntimeSession,
  loadDiscoveryAuditSource,
  type AuditRuntimeState,
  type DiscoveryAuditReadOnlyAdapter,
} from '../src/discovery/auditSource';
import { DiscoveryWriteQueue } from '../src/discovery/DiscoveryWriteQueue';
import { generateDiscoveries } from '../src/discovery/DiscoveryEngine';
import { emptyDiscoveryFile } from '../src/discovery/types';
import { qualityFixture } from './discoveryQuality';

const NOW = '2026-01-01T00:00:00.000Z';

function deferred(): {
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: Error) => void;
} {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function rawFixture(): string {
  const { graph } = qualityFixture();
  return JSON.stringify(generateDiscoveries(graph, emptyDiscoveryFile(NOW), () => NOW));
}

class FakeAdapter implements DiscoveryAuditReadOnlyAdapter {
  readonly binding = AuditVaultBinding.fromVault({});
  reads = 0;

  constructor(private readonly raw: string | null) {}

  async readExact(): Promise<string | null> {
    this.reads += 1;
    return this.raw;
  }
}

function queueState(queue: DiscoveryWriteQueue): AuditRuntimeState {
  return {
    blocked: false,
    issues: [],
    queuePending: queue.hasPending(),
    queueFailed: queue.hasSaveFailed,
    queueClosed: queue.isClosed,
    memoryMatchesPersisted:
      !queue.hasPending() && !queue.hasSaveFailed && !queue.isClosed,
    sourceRegistered: true,
  };
}

function queueSession(queue: DiscoveryWriteQueue): AuditRuntimeSession {
  return AuditRuntimeSession.fromLiveRuntime(() => queueState(queue));
}

describe('audit runtime simulation with real write queue', () => {
  it('rejects audit while the real queue has a pending save, then allows after completion', async () => {
    const save = deferred();
    const queue = new DiscoveryWriteQueue(emptyDiscoveryFile(NOW), () => save.promise);
    const pending = queue.enqueue(() => emptyDiscoveryFile(NOW));
    const adapter = new FakeAdapter(rawFixture());
    const binding = adapter.binding;
    const session = queueSession(queue);

    const whilePending = await loadDiscoveryAuditSource(adapter, binding, session);
    expect(whilePending.ok).toBe(false);
    if (!whilePending.ok) expect(whilePending.code).toBe('incomplete');
    expect(adapter.reads).toBe(0);

    save.resolve();
    await pending;
    await Promise.resolve();
    expect(queue.hasPending()).toBe(false);

    const after = await loadDiscoveryAuditSource(adapter, binding, session);
    expect(after.ok).toBe(true);
    expect(adapter.reads).toBe(1);
  });

  it('rejects audit after a real queue save failure, then recovers after a successful save', async () => {
    let shouldFail = true;
    const queue = new DiscoveryWriteQueue(emptyDiscoveryFile(NOW), async () => {
      if (shouldFail) throw new Error('simulated disk failure');
    });
    await expect(queue.enqueue(() => emptyDiscoveryFile(NOW))).rejects.toThrow('simulated disk failure');
    await Promise.resolve();
    expect(queue.hasSaveFailed).toBe(true);

    const adapter = new FakeAdapter(rawFixture());
    const binding = adapter.binding;
    const session = queueSession(queue);
    const failed = await loadDiscoveryAuditSource(adapter, binding, session);
    expect(failed.ok).toBe(false);
    if (!failed.ok) expect(failed.code).toBe('incomplete');
    expect(adapter.reads).toBe(0);

    shouldFail = false;
    await queue.enqueue(() => emptyDiscoveryFile(NOW));
    await Promise.resolve();
    expect(queue.hasSaveFailed).toBe(false);
    const recovered = await loadDiscoveryAuditSource(adapter, binding, session);
    expect(recovered.ok).toBe(true);
  });

  it('rejects audit when the real queue is closed', async () => {
    const queue = new DiscoveryWriteQueue(emptyDiscoveryFile(NOW), async () => {});
    queue.close();
    const adapter = new FakeAdapter(rawFixture());
    const binding = adapter.binding;
    const session = queueSession(queue);
    const result = await loadDiscoveryAuditSource(adapter, binding, session);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('incomplete');
    expect(adapter.reads).toBe(0);
  });
});

describe('audit cancellation simulation', () => {
  it('aborts a delayed read and does not return a projection', async () => {
    const read = deferred();
    const binding = AuditVaultBinding.fromVault({});
    const adapter: DiscoveryAuditReadOnlyAdapter = {
      binding,
      async readExact() {
        await read.promise;
        return rawFixture();
      },
    };
    const session = AuditRuntimeSession.fromLiveRuntime(() => ({
      blocked: false,
      issues: [],
      queuePending: false,
      queueFailed: false,
      queueClosed: false,
      memoryMatchesPersisted: true,
      sourceRegistered: true,
    }));
    const controller = new AbortController();
    const running = loadDiscoveryAuditSource(adapter, binding, session, {
      signal: controller.signal,
    });
    controller.abort();
    read.resolve();

    const result = await running;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('cancelled');
  });
});

