import { describe, expect, it, vi } from 'vitest';

const notices: Array<{ message: string; timeout: number }> = [];
vi.mock('obsidian', () => ({
  Notice: class {
    constructor(public message: string, public timeout?: number) {
      notices.push({ message, timeout: timeout ?? 0 });
    }
  },
}));

import { pluginDataPayload, reportLoadResult } from '../../src/plugin/persistence';

describe('persistence', () => {
  it('builds a payload with schema version and inbox', () => {
    const payload = pluginDataPayload({
      settings: { enableAI: true },
      lastRebuiltAt: '2026-11-09T00:00:00.000Z',
      inboxSerialized: '[]',
    });
    expect(payload).toEqual({
      schemaVersion: 1,
      settings: { enableAI: true },
      lastRebuiltAt: '2026-11-09T00:00:00.000Z',
      inbox: '[]',
    });
  });

  it('reports a blocked load result', () => {
    reportLoadResult({
      source: 'clean',
      blocked: true,
      blockedReason: 'read-only',
      issues: [],
      appliedMigrations: [],
      preMigrationBackupKey: null,
      corruptedBackupKey: null,
      issuesBackupKey: null,
    } as never);
    expect(notices.some((entry) => entry.message.includes('read-only'))).toBe(true);
  });
});
