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

const scopeOpen = vi.fn();
const previewOpen = vi.fn();
const saveOpen = vi.fn();

vi.mock('../../src/ui/DiscoveryAuditModal', () => ({
  DiscoveryAuditScopeModal: class {
    constructor(
      public app: unknown,
      public options: Record<string, unknown>,
    ) {}
    open() {
      scopeOpen(this);
    }
  },
  DiscoveryAuditPreviewModal: class {
    constructor(
      public app: unknown,
      public options: Record<string, unknown>,
    ) {}
    open() {
      previewOpen(this);
    }
  },
  DiscoveryAuditSaveModal: class {
    constructor(
      public app: unknown,
      public options: Record<string, unknown>,
    ) {}
    open() {
      saveOpen(this);
    }
  },
}));

const loadDiscoveryAuditSource = vi.fn();
vi.mock('../../src/discovery/auditSource', () => ({
  AuditRuntimeSession: class {},
  loadDiscoveryAuditSource: (...args: unknown[]) => loadDiscoveryAuditSource(...args),
}));

vi.mock('../../src/discovery/audit', () => ({
  buildDiscoveryAuditFromProjection: vi.fn(() => ({ summary: true })),
  formatDiscoveryAudit: vi.fn(() => '审计报告正文'),
}));

import {
  collectAuditProjectKeys,
  openAuditSaveDialog,
  promptAuditScopeModal,
  runDiscoveryAudit,
} from '../../src/plugin/auditUI';

function makeTasks(overrides: Record<string, unknown> = {}) {
  return {
    begin: vi.fn(() => ({ signal: { aborted: false } })),
    isCurrent: vi.fn(() => true),
    cancel: vi.fn(),
    finish: vi.fn(),
    ...overrides,
  } as never;
}

describe('auditUI', () => {
  beforeEach(() => {
    notices.length = 0;
    scopeOpen.mockReset();
    previewOpen.mockReset();
    saveOpen.mockReset();
    loadDiscoveryAuditSource.mockReset();
  });

  it('collects trimmed, unique, sorted project keys', () => {
    const keys = collectAuditProjectKeys([
      { projectKeys: [' b ', 'a', ''] },
      { projectKeys: ['a', '  '] },
    ] as never);
    expect(keys).toEqual(['a', 'b']);
  });

  it('opens the audit scope modal with binding and keys', () => {
    const onConfirm = vi.fn();
    const binding = { id: 'b1' };
    promptAuditScopeModal({} as never, binding as never, ['k1'], onConfirm);
    expect(scopeOpen).toHaveBeenCalledTimes(1);
    const options = scopeOpen.mock.calls[0]?.[0]?.options as Record<string, unknown>;
    expect(options.binding).toBe(binding);
    expect(options.projectKeys).toEqual(['k1']);
    expect(options.onConfirm).toBe(onConfirm);
  });

  it('notices when the audit task context is gone', async () => {
    await runDiscoveryAudit({
      app: {} as never,
      auditTasks: makeTasks({ begin: vi.fn(() => null) }),
      getAuditVaultBinding: () => null,
      getAuditRuntimeSession: () => null,
      getDiscoveryAuditAdapter: () => null,
      scope: { binding: {} } as never,
    });
    expect(notices.at(-1)).toBe('InterestSeed：插件上下文已失效，无法审计。');
    expect(previewOpen).not.toHaveBeenCalled();
  });

  it('cancels when the vault binding does not match', async () => {
    const tasks = makeTasks();
    await runDiscoveryAudit({
      app: {} as never,
      auditTasks: tasks,
      getAuditVaultBinding: () => ({ id: 'other' }) as never,
      getAuditRuntimeSession: () => ({}) as never,
      getDiscoveryAuditAdapter: () => ({}) as never,
      scope: { binding: { id: 'wanted' } } as never,
    });
    expect((tasks as { cancel: () => void }).cancel).toHaveBeenCalled();
    expect(notices.at(-1)).toBe(
      'InterestSeed：Vault 绑定或数据完整性状态不可用，已取消审计。',
    );
  });

  it('notices when the audit source fails', async () => {
    const binding = { id: 'b1' };
    loadDiscoveryAuditSource.mockResolvedValueOnce({
      ok: false,
      message: '数据不完整',
      code: 'E_SOURCE',
    });
    await runDiscoveryAudit({
      app: {} as never,
      auditTasks: makeTasks(),
      getAuditVaultBinding: () => binding as never,
      getAuditRuntimeSession: () => ({}) as never,
      getDiscoveryAuditAdapter: () => ({}) as never,
      scope: { binding } as never,
    });
    expect(notices.at(-1)).toBe('InterestSeed：数据不完整（E_SOURCE）');
    expect(previewOpen).not.toHaveBeenCalled();
  });

  it('opens the audit preview on success', async () => {
    const binding = { id: 'b1' };
    loadDiscoveryAuditSource.mockResolvedValueOnce({ ok: true, projection: {} });
    const tasks = makeTasks();
    await runDiscoveryAudit({
      app: {} as never,
      auditTasks: tasks,
      getAuditVaultBinding: () => binding as never,
      getAuditRuntimeSession: () => ({}) as never,
      getDiscoveryAuditAdapter: () => ({}) as never,
      scope: { binding } as never,
    });
    expect(previewOpen).toHaveBeenCalledTimes(1);
    const options = previewOpen.mock.calls[0]?.[0]?.options as Record<string, unknown>;
    expect(options.text).toBe('审计报告正文');
    (options.onSave as () => void)();
    expect(saveOpen).toHaveBeenCalledTimes(1);
    (options.onClose as () => void)();
    expect((tasks as { cancel: () => void }).cancel).toHaveBeenCalled();
    expect((tasks as { finish: () => void }).finish).toHaveBeenCalled();
  });

  it('reports audit failures', async () => {
    const binding = { id: 'b1' };
    loadDiscoveryAuditSource.mockRejectedValueOnce(new Error('boom'));
    await runDiscoveryAudit({
      app: {} as never,
      auditTasks: makeTasks(),
      getAuditVaultBinding: () => binding as never,
      getAuditRuntimeSession: () => ({}) as never,
      getDiscoveryAuditAdapter: () => ({}) as never,
      scope: { binding } as never,
    });
    expect(notices.at(-1)).toBe('InterestSeed：审计失败——boom');
  });

  it('opens the save dialog with a stamped default name', () => {
    const tasks = makeTasks();
    openAuditSaveDialog({} as never, tasks, '正文', { signal: { aborted: false } } as never);
    expect(saveOpen).toHaveBeenCalledTimes(1);
    const options = saveOpen.mock.calls[0]?.[0]?.options as Record<string, unknown>;
    expect(String(options.defaultName)).toMatch(/^InterestSeed-audit-.+\.md$/);
    expect((options.canSave as () => boolean)()).toBe(true);
    (options.onSaved as () => void)();
    expect(notices.at(-1)).toBe('InterestSeed：聚合审计报告已保存。');
  });
});
