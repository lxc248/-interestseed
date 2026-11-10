import { describe, expect, it, vi } from 'vitest';

const notices: Array<{ message: string; timeout: number }> = [];
vi.mock('obsidian', () => ({
  Notice: class {
    constructor(public message: string, public timeout?: number) {
      notices.push({ message, timeout: timeout ?? 0 });
    }
  },
}));

import {
  persistPluginData,
  pluginDataPayload,
  reportLoadResult,
  unpackStoredState,
} from '../../src/plugin/persistence';

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

  it('builds a payload with optional fields missing', () => {
    expect(pluginDataPayload({ settings: undefined, lastRebuiltAt: null, inboxSerialized: undefined })).toEqual({
      schemaVersion: 1,
      settings: undefined,
      lastRebuiltAt: null,
      inbox: undefined,
    });
  });

  it('notices when persistence fails', async () => {
    const saveData = vi.fn(async () => {
      throw new Error('disk full');
    });
    await persistPluginData(saveData, { schemaVersion: 1 });
    expect(notices.some((entry) => entry.message.includes('设置保存失败'))).toBe(true);
  });

  it('unpacks stored state and normalizes lastRebuiltAt', () => {
    const unpacked = unpackStoredState({
      schemaVersion: 1,
      settings: { enableAI: false },
      inbox: '[]',
      lastRebuiltAt: 1700000000000,
    });
    expect(unpacked.dataVersion).toBe(1);
    expect(unpacked.settings).toEqual({ enableAI: false });
    expect(unpacked.inbox).toBe('[]');
    expect(unpacked.lastRebuiltAt).toMatch(/^\d{4}-\d{2}-\d{2}/);
  });

  it('parses a string lastRebuiltAt and ignores an invalid one', () => {
    const valid = unpackStoredState({ lastRebuiltAt: '2026-11-09T00:00:00.000Z' });
    expect(valid.lastRebuiltAt).toBe('2026-11-09T00:00:00.000Z');
    const invalid = unpackStoredState({ lastRebuiltAt: 'not-a-date' });
    expect(invalid.lastRebuiltAt).toBeNull();
  });

  it('defaults non-numeric schema versions to 0', () => {
    expect(unpackStoredState({ schemaVersion: 'x' }).dataVersion).toBe(0);
  });

  it('handles null stored state as empty', () => {
    expect(unpackStoredState(null)).toEqual({
      settings: undefined,
      inbox: undefined,
      lastRebuiltAt: null,
      dataVersion: 0,
    });
  });

  it('handles primitive stored state as empty', () => {
    expect(unpackStoredState('legacy').dataVersion).toBe(0);
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
