import type { App } from 'obsidian';

import { normalizePath } from '../utils/paths';
import type { AuditVaultBinding } from '../discovery/auditBinding';
import type { DiscoveryAuditReadOnlyAdapter } from '../discovery/auditSource';

/**
 * 只读访问当前插件配置下的发现主数据。
 *
 * 只拼接插件目录 + discoveries/<key> 的 vault 相对路径：
 * - 不读取 .bak；
 * - 不调用 DiscoveryRepository.loadDetailed；
 * - 不写入、迁移或备份；
 * - 不接受绝对路径或目录穿越 key。
 */
export class ObsidianDiscoveryAuditAdapter implements DiscoveryAuditReadOnlyAdapter {
  readonly binding: AuditVaultBinding;

  constructor(
    private readonly app: App,
    private readonly pluginDir: string,
    binding: AuditVaultBinding,
  ) {
    if (!binding.isActive) throw new Error('Vault 绑定已失效');
    const normalizedDir = normalizePath(pluginDir);
    if (!normalizedDir || normalizedDir.startsWith('/') || normalizedDir.includes('..')) {
      throw new Error('插件目录不是安全的 vault 相对路径');
    }
    this.binding = binding;
  }

  async readExact(key: string): Promise<string | null> {
    if (!this.binding.isActive) {
      throw new Error('Vault 绑定已失效');
    }
    if (
      !key ||
      key.includes('/') ||
      key.includes('\\') ||
      key.includes('..') ||
      key.startsWith('.')
    ) {
      throw new Error('审计读取 key 不是顶层文件名');
    }
    const normalizedKey = normalizePath(key);
    if (!normalizedKey) {
      throw new Error('审计读取 key 不是顶层文件名');
    }
    const path = normalizePath(`${this.pluginDir}/discoveries/${normalizedKey}`);
    const adapter = this.app.vault.adapter;
    if (!(await adapter.exists(path))) return null;
    return adapter.read(path);
  }
}
