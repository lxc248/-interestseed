/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Copyright (C) 2026 aicoder
 */
import { Notice } from 'obsidian';

import type {
  DiscoveryBackupStatus,
  DiscoveryMigrationDiagnostics,
} from '../discovery/DiscoveryRepository';

/**
 * 迁移诊断只在“本次加载真的动了数据”时才提示，避免每次启动都刷日志。
 */
export function hasDiscoveryMigrationSignal(
  migration: DiscoveryMigrationDiagnostics | null | undefined,
): boolean {
  if (!migration) return false;
  return (
    migration.legacyRecords > 0 ||
    migration.emptyEvidenceRecords > 0 ||
    migration.supersededRecords > 0
  );
}

export function formatDiscoveryMigrationLog(
  migration: DiscoveryMigrationDiagnostics,
): string {
  return `[InterestSeed] 发现迁移诊断（本次加载）：总 ${migration.totalRecords}，legacy ${migration.legacyRecords}，空证据 ${migration.emptyEvidenceRecords}，自动收敛 ${migration.supersededRecords}，本次实例持久化 ${migration.persistedInThisInstance}；历史持久化 ${migration.persistedHistory}`;
}

export function formatDiscoveryMigrationNotice(
  migration: DiscoveryMigrationDiagnostics,
): string {
  return `发现迁移诊断：本次加载 legacy ${migration.legacyRecords}，空证据 ${migration.emptyEvidenceRecords}，自动收敛 ${migration.supersededRecords}；历史持久化未知`;
}

export function reportDiscoveryMigration(
  migration: DiscoveryMigrationDiagnostics | null | undefined,
): void {
  if (!hasDiscoveryMigrationSignal(migration) || !migration) return;
  console.warn(formatDiscoveryMigrationLog(migration));
  new Notice(formatDiscoveryMigrationNotice(migration));
}

export function buildDiscoveryBlockedMessage(
  reason: string,
  backupStatus: DiscoveryBackupStatus | null | undefined,
): string {
  const hint =
    backupStatus === 'succeeded'
      ? '原始内容已备份'
      : backupStatus === 'failed'
        ? '备份失败，原文件未被覆盖'
        : backupStatus === 'unavailable'
          ? '读取失败，原文件未被修改'
          : '';
  return `InterestSeed：${reason}${hint ? `（${hint}）` : ''}`;
}

export function reportDiscoveryBlocked(
  reason: string,
  backupStatus: DiscoveryBackupStatus | null | undefined,
): void {
  new Notice(buildDiscoveryBlockedMessage(reason, backupStatus), 10_000);
}
