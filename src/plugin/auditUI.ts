/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Copyright (C) 2026 aicoder
 */
import { Notice, type App } from 'obsidian';

import type { AuditVaultBinding } from '../discovery/auditBinding';
import {
  buildDiscoveryAuditFromProjection,
  formatDiscoveryAudit,
  type DiscoveryAuditScope,
} from '../discovery/audit';
import { loadDiscoveryAuditSource } from '../discovery/auditSource';
import type { AuditRuntimeSession } from '../discovery/auditSource';
import type { AuditTaskCoordinator, AuditTaskToken } from '../discovery/auditTask';
import type { ObsidianDiscoveryAuditAdapter } from '../adapters/ObsidianDiscoveryAuditAdapter';
import type { Discovery } from '../discovery/types';
import {
  DiscoveryAuditPreviewModal,
  DiscoveryAuditSaveModal,
  DiscoveryAuditScopeModal,
} from '../ui/DiscoveryAuditModal';

export function collectAuditProjectKeys(discoveries: Discovery[]): string[] {
  return [
    ...new Set(
      discoveries
        .flatMap((item) => item.projectKeys)
        .map((key) => key.trim())
        .filter(Boolean),
    ),
  ].sort();
}

export function promptAuditScopeModal(
  app: App,
  binding: AuditVaultBinding,
  projectKeys: string[],
  onConfirm: (scope: DiscoveryAuditScope) => void,
): void {
  new DiscoveryAuditScopeModal(app, {
    binding,
    projectKeys,
    onConfirm,
  }).open();
}

export async function runDiscoveryAudit(input: {
  app: App;
  auditTasks: AuditTaskCoordinator;
  getAuditVaultBinding: () => AuditVaultBinding | null;
  getAuditRuntimeSession: () => AuditRuntimeSession | null;
  getDiscoveryAuditAdapter: () => ObsidianDiscoveryAuditAdapter | null;
  scope: DiscoveryAuditScope;
}): Promise<void> {
  const {
    app,
    auditTasks,
    getAuditVaultBinding,
    getAuditRuntimeSession,
    getDiscoveryAuditAdapter,
    scope,
  } = input;
  const token = auditTasks.begin();
  if (!token) {
    new Notice('InterestSeed：插件上下文已失效，无法审计。');
    return;
  }
  const binding = getAuditVaultBinding();
  const session = getAuditRuntimeSession();
  const adapter = getDiscoveryAuditAdapter();
  if (!binding || scope.binding !== binding || !session || !adapter) {
    auditTasks.cancel();
    new Notice('InterestSeed：Vault 绑定或数据完整性状态不可用，已取消审计。');
    return;
  }

  try {
    const source = await loadDiscoveryAuditSource(adapter, binding, session, {
      signal: token.signal,
    });
    if (!auditTasks.isCurrent(token)) return;
    if (!source.ok) {
      new Notice(`InterestSeed：${source.message}（${source.code}）`, 10_000);
      return;
    }
    const summary = buildDiscoveryAuditFromProjection(source.projection, scope);
    if (!auditTasks.isCurrent(token)) return;
    const text = formatDiscoveryAudit(summary);
    new DiscoveryAuditPreviewModal(app, {
      text,
      onSave: () => {
        if (!auditTasks.isCurrent(token)) {
          new Notice('InterestSeed：审计任务已失效，未保存报告。', 8000);
          return;
        }
        openAuditSaveDialog(app, auditTasks, text, token);
      },
      onClose: () => auditTasks.cancel(),
    }).open();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    new Notice(`InterestSeed：审计失败——${message}`, 10_000);
  } finally {
    auditTasks.finish(token);
  }
}

export function openAuditSaveDialog(
  app: App,
  auditTasks: AuditTaskCoordinator,
  text: string,
  token: AuditTaskToken,
): void {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  new DiscoveryAuditSaveModal(app, {
    text,
    defaultName: `InterestSeed-audit-${stamp}.md`,
    canSave: () => auditTasks.isCurrent(token),
    onSaved: () => {
      new Notice('InterestSeed：聚合审计报告已保存。', 6000);
    },
  }).open();
}
