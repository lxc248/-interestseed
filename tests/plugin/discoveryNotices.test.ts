/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Copyright (C) 2026 aicoder
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const notices: string[] = [];
vi.mock('obsidian', () => ({
  Notice: class {
    constructor(public message: string) {
      notices.push(message);
    }
  },
}));

import {
  buildDiscoveryBlockedMessage,
  formatDiscoveryMigrationLog,
  formatDiscoveryMigrationNotice,
  hasDiscoveryMigrationSignal,
  reportDiscoveryBlocked,
  reportDiscoveryMigration,
} from '../../src/plugin/discoveryNotices';

function migration(overrides: Record<string, unknown> = {}) {
  return {
    totalRecords: 10,
    legacyRecords: 0,
    emptyEvidenceRecords: 0,
    supersededRecords: 0,
    persistedInThisInstance: 'not-attempted',
    persistedHistory: 'unknown',
    ...overrides,
  } as never;
}

describe('discoveryNotices', () => {
  beforeEach(() => {
    notices.length = 0;
  });

  it('has no signal when migration is missing', () => {
    expect(hasDiscoveryMigrationSignal(null)).toBe(false);
    expect(hasDiscoveryMigrationSignal(undefined)).toBe(false);
  });

  it('has no signal when every counter is zero', () => {
    expect(hasDiscoveryMigrationSignal(migration())).toBe(false);
  });

  it('has a signal when any counter is positive', () => {
    expect(hasDiscoveryMigrationSignal(migration({ legacyRecords: 1 }))).toBe(true);
    expect(hasDiscoveryMigrationSignal(migration({ emptyEvidenceRecords: 1 }))).toBe(true);
    expect(hasDiscoveryMigrationSignal(migration({ supersededRecords: 1 }))).toBe(true);
  });

  it('formats the diagnostic log line', () => {
    const line = formatDiscoveryMigrationLog(
      migration({ legacyRecords: 2, emptyEvidenceRecords: 3, supersededRecords: 4 }),
    );
    expect(line).toContain('总 10');
    expect(line).toContain('legacy 2');
    expect(line).toContain('空证据 3');
    expect(line).toContain('自动收敛 4');
  });

  it('formats the diagnostic notice text', () => {
    const text = formatDiscoveryMigrationNotice(migration({ legacyRecords: 1 }));
    expect(text).toBe('发现迁移诊断：本次加载 legacy 1，空证据 0，自动收敛 0；历史持久化未知');
  });

  it('stays quiet when there is no migration signal', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    reportDiscoveryMigration(migration());
    expect(warn).not.toHaveBeenCalled();
    expect(notices).toHaveLength(0);
    warn.mockRestore();
  });

  it('warns and notifies when migration touched data', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    reportDiscoveryMigration(migration({ legacyRecords: 5 }));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(notices.at(-1)).toContain('发现迁移诊断');
    warn.mockRestore();
  });

  it('builds blocked messages for every backup status', () => {
    expect(buildDiscoveryBlockedMessage('只读', null)).toBe('InterestSeed：只读');
    expect(buildDiscoveryBlockedMessage('只读', 'succeeded')).toBe(
      'InterestSeed：只读（原始内容已备份）',
    );
    expect(buildDiscoveryBlockedMessage('只读', 'failed')).toBe(
      'InterestSeed：只读（备份失败，原文件未被覆盖）',
    );
    expect(buildDiscoveryBlockedMessage('只读', 'unavailable')).toBe(
      'InterestSeed：只读（读取失败，原文件未被修改）',
    );
    expect(buildDiscoveryBlockedMessage('只读', 'not-needed')).toBe('InterestSeed：只读');
  });

  it('notifies the blocked message', () => {
    reportDiscoveryBlocked('只读', 'succeeded');
    expect(notices.at(-1)).toBe('InterestSeed：只读（原始内容已备份）');
  });
});
