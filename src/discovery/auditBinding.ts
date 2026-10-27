const activeBindings = new WeakSet<object>();

/**
 * 当前插件上下文内的 Vault 绑定。
 *
 * 只能通过 fromVault(vault) 创建；不暴露路径、名称或可序列化 token。
 * 这不是用户授权凭证，也不是不可伪造的系统级身份；它只约束调用路径和生命周期。
 */
export class AuditVaultBinding {
  private constructor() {}

  static fromVault(vault: object): AuditVaultBinding {
    if (!vault || typeof vault !== 'object') {
      throw new Error('无法从当前上下文建立 Vault 绑定');
    }
    const binding = new AuditVaultBinding();
    activeBindings.add(binding);
    return binding;
  }

  get isActive(): boolean {
    return activeBindings.has(this);
  }

  invalidate(): void {
    activeBindings.delete(this);
  }
}
