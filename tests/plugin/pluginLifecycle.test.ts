import { describe, expect, it, vi } from 'vitest';

import { unloadPlugin } from '../../src/plugin/pluginLifecycle';

describe('pluginLifecycle', () => {
  it('runs teardown callbacks and detaches view leaves', () => {
    const invalidateAuditBinding = vi.fn();
    const closeDiscoveryQueue = vi.fn();
    const flushDiscoveryQueue = vi.fn();
    const flushPersistence = vi.fn();
    const disposePersistence = vi.fn();
    const detachLeavesOfType = vi.fn();
    unloadPlugin({
      app: { workspace: { detachLeavesOfType } } as never,
      graphViewType: 'graph',
      agentViewType: 'agent',
      aiViewType: 'ai',
      invalidateAuditBinding,
      closeDiscoveryQueue,
      flushDiscoveryQueue,
      flushPersistence,
      disposePersistence,
    });
    expect(invalidateAuditBinding).toHaveBeenCalledTimes(1);
    expect(closeDiscoveryQueue).toHaveBeenCalledTimes(1);
    expect(flushDiscoveryQueue).toHaveBeenCalledTimes(1);
    expect(flushPersistence).toHaveBeenCalledTimes(1);
    expect(disposePersistence).toHaveBeenCalledTimes(1);
    expect(detachLeavesOfType).toHaveBeenCalledWith('graph');
    expect(detachLeavesOfType).toHaveBeenCalledWith('agent');
    expect(detachLeavesOfType).toHaveBeenCalledWith('ai');
  });
});
