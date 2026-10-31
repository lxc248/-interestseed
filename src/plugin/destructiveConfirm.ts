import type { App } from 'obsidian';
import { confirmAction } from '../ui/ConfirmModal';

/** Destructive actions use the same explicit confirmation copy. */
export function confirmClearGraph(app: App): Promise<boolean> {
  return confirmAction(
    app,
    '清空当前图谱里的所有节点和关系？这一步会进入撤销历史，但仍建议先创建备份。',
    '清空',
  );
}
