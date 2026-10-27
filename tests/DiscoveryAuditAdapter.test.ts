import { describe, expect, it } from 'vitest';

import { ObsidianDiscoveryAuditAdapter } from '../src/adapters/ObsidianDiscoveryAuditAdapter';
import { AuditVaultBinding } from '../src/discovery/auditBinding';
import { AuditTaskCoordinator } from '../src/discovery/auditTask';
import type { App } from 'obsidian';

function fakeApp(initial: string | null = '{}') {
  const calls: Array<{ method: string; path: string; data?: string }> = [];
  const files = new Map<string, string>();
  if (initial !== null) files.set('.obsidian/plugins/interestseed/discoveries/discoveries.json', initial);
  const adapter = {
    exists: async (path: string) => {
      calls.push({ method: 'exists', path });
      return files.has(path);
    },
    read: async (path: string) => {
      calls.push({ method: 'read', path });
      return files.get(path) ?? '';
    },
    write: async (path: string, data: string) => {
      calls.push({ method: 'write', path, data });
      files.set(path, data);
    },
  };
  return {
    app: { vault: { adapter } } as unknown as App,
    calls,
    files,
  };
}

describe('Obsidian discovery audit adapter', () => {
  it('只读取精确 primary，不读取 .bak、不写文件', async () => {
    const { app, calls } = fakeApp('{"ok":true}');
    const binding = AuditVaultBinding.fromVault({});
    const adapter = new ObsidianDiscoveryAuditAdapter(
      app,
      '.obsidian/plugins/interestseed',
      binding,
    );

    await expect(adapter.readExact('discoveries.json')).resolves.toBe('{"ok":true}');
    expect(calls).toEqual([
      {
        method: 'exists',
        path: '.obsidian/plugins/interestseed/discoveries/discoveries.json',
      },
      {
        method: 'read',
        path: '.obsidian/plugins/interestseed/discoveries/discoveries.json',
      },
    ]);
  });

  it('主文件缺失返回 null，不尝试备份或写入', async () => {
    const { app, calls } = fakeApp(null);
    const binding = AuditVaultBinding.fromVault({});
    const adapter = new ObsidianDiscoveryAuditAdapter(
      app,
      '.obsidian/plugins/interestseed',
      binding,
    );

    await expect(adapter.readExact('discoveries.json')).resolves.toBeNull();
    expect(calls).toEqual([
      {
        method: 'exists',
        path: '.obsidian/plugins/interestseed/discoveries/discoveries.json',
      },
    ]);
  });

  it('拒绝目录穿越和绝对 key', async () => {
    const { app } = fakeApp('{}');
    const binding = AuditVaultBinding.fromVault({});
    const adapter = new ObsidianDiscoveryAuditAdapter(
      app,
      '.obsidian/plugins/interestseed',
      binding,
    );

    await expect(adapter.readExact('../discoveries.json')).rejects.toThrow();
    await expect(adapter.readExact('/discoveries.json')).rejects.toThrow();
  });

  it('绑定失效后拒绝读取', async () => {
    const { app, calls } = fakeApp('{}');
    const binding = AuditVaultBinding.fromVault({});
    const adapter = new ObsidianDiscoveryAuditAdapter(
      app,
      '.obsidian/plugins/interestseed',
      binding,
    );
    binding.invalidate();

    await expect(adapter.readExact('discoveries.json')).rejects.toThrow();
    expect(calls).toEqual([]);
  });
});

describe('Audit task coordinator', () => {
  it('新任务使旧任务失效，取消后的任务不能发布结果', () => {
    const tasks = new AuditTaskCoordinator();
    const first = tasks.begin()!;
    const second = tasks.begin()!;

    expect(tasks.isCurrent(first)).toBe(false);
    expect(tasks.isCurrent(second)).toBe(true);

    tasks.cancel();
    expect(tasks.isCurrent(second)).toBe(false);
  });

  it('卸载后所有任务失效', () => {
    const tasks = new AuditTaskCoordinator();
    const token = tasks.begin()!;
    tasks.invalidate();

    expect(tasks.isClosed).toBe(true);
    expect(tasks.isCurrent(token)).toBe(false);
    expect(tasks.begin()).toBeNull();
  });

  it('新任务 abort 旧信号，旧任务不能覆盖新任务', () => {
    const tasks = new AuditTaskCoordinator();
    const first = tasks.begin()!;
    const second = tasks.begin()!;

    expect(first.signal.aborted).toBe(true);
    expect(second.signal.aborted).toBe(false);
    expect(tasks.isCurrent(first)).toBe(false);
    expect(tasks.isCurrent(second)).toBe(true);
  });

  it('finish 保留当前 token 供保存；新任务随后使其失效', () => {
    const tasks = new AuditTaskCoordinator();
    const first = tasks.begin()!;
    tasks.finish(first);
    expect(tasks.isCurrent(first)).toBe(true);

    const second = tasks.begin()!;
    expect(tasks.isCurrent(first)).toBe(false);
    expect(tasks.isCurrent(second)).toBe(true);
  });

  it('cancel 会 abort 当前 token 并阻止其发布或保存', () => {
    const tasks = new AuditTaskCoordinator();
    const token = tasks.begin()!;
    tasks.cancel();

    expect(token.signal.aborted).toBe(true);
    expect(tasks.isCurrent(token)).toBe(false);
  });
});
