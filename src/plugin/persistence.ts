import { Notice } from 'obsidian';
import type { LoadResult } from '../storage/GraphRepository';

export const DATA_SCHEMA_VERSION = 1;

export function pluginDataPayload(input: {
  settings: unknown;
  lastRebuiltAt: string | null;
  inboxSerialized: unknown;
}): {
  schemaVersion: number;
  settings: unknown;
  lastRebuiltAt: string | null;
  inbox: unknown;
} {
  return {
    schemaVersion: DATA_SCHEMA_VERSION,
    settings: input.settings,
    lastRebuiltAt: input.lastRebuiltAt,
    inbox: input.inboxSerialized,
  };
}

export async function persistPluginData(
  saveData: (data: unknown) => Promise<void>,
  payload: unknown,
): Promise<void> {
  try {
    await saveData(payload);
  } catch (error) {
    console.error('[InterestSeed] 保存设置失败', error);
    new Notice(
      `InterestSeed：设置保存失败。${error instanceof Error ? error.message : String(error)}`,
      10_000,
    );
  }
}

export function reportLoadResult(result: LoadResult): void {
  if (result.issues.length > 0) {
    console.warn(`[InterestSeed] 图谱数据问题：\n${result.issues.join('\n')}`);
  }
  if (result.appliedMigrations.length > 0) {
    console.warn(`[InterestSeed] 已迁移图谱数据：\n${result.appliedMigrations.join('\n')}`);
  }
  if (result.preMigrationBackupKey) {
    console.warn(`[InterestSeed] 迁移前旧数据已备份：${result.preMigrationBackupKey}`);
  }
  if (result.corruptedBackupKey) {
    console.warn(`[InterestSeed] 原始数据已备份：${result.corruptedBackupKey}`);
  }
  if (result.issuesBackupKey) {
    console.warn(`[InterestSeed] 清洗前图谱已备份：${result.issuesBackupKey}`);
  }
  if (result.issues.length > 0 && !result.blocked) {
    new Notice(
      `InterestSeed：图谱加载时清洗了 ${result.issues.length} 条问题记录；原始文件已备份到插件目录。`,
      10_000,
    );
  }

  if (result.blocked) {
    new Notice(
      `InterestSeed：${result.blockedReason ?? '图谱存储已暂停'}。请在命令面板运行“备份旧数据并重置图谱存储”。`,
      15_000,
    );
  } else if (result.source === 'recovered') {
    new Notice(
      'InterestSeed：图谱主文件损坏，已从备份恢复；原主文件已备份在插件目录。',
      10_000,
    );
  }
}
