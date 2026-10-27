import { Notice } from 'obsidian';
import type { Plugin } from 'obsidian';
import type { UndoHistory } from '../core/UndoManager';

export interface CommandHost {
  activateView(): Promise<void> | void;
  rebuildGraph(silent?: boolean): Promise<void>;
  exportGraph(): void;
  promptRebuild(): void;
  promptCreateNode(): void;
  createFromActiveFile(): void;
  refreshSuggestions(): void;
  promptAudit(): void;
  openDiscoveryOverview(): void;
  reconcileDiscoveries(): Promise<void>;
  readonly undo: UndoHistory;
  expandWithAI(nodeId?: string): Promise<void>;
  clearGraph(): Promise<void>;
  retrySave(): Promise<void>;
  repairGraphStorage(): Promise<void>;
  createBackup(): Promise<void>;
}

/** 命令注册与插件实现分离，main.ts 只负责提供宿主能力。 */
export function registerCommands(plugin: Plugin, host: CommandHost): void {
  plugin.addCommand({
    id: 'interestseed-open',
    name: '打开兴趣图谱',
    callback: () => {
      void host.activateView();
    },
  });

  plugin.addCommand({
    id: 'interestseed-export',
    name: '导出兴趣图谱 JSON',
    callback: () => host.exportGraph(),
  });

  plugin.addCommand({
    id: 'interestseed-rebuild',
    name: '从仓库重建兴趣图谱',
    callback: () => host.promptRebuild(),
  });

  plugin.addCommand({
    id: 'interestseed-new-node',
    name: '新建节点',
    callback: () => host.promptCreateNode(),
  });

  plugin.addCommand({
    id: 'interestseed-node-from-file',
    name: '从当前文件创建节点',
    callback: () => host.createFromActiveFile(),
  });

  plugin.addCommand({
    id: 'interestseed-refresh-suggestions',
    name: '刷新规则建议',
    callback: () => host.refreshSuggestions(),
  });

  plugin.addCommand({
    id: 'interestseed-audit',
    name: '生成发现聚合审计（只读预览）',
    callback: () => host.promptAudit(),
  });

  plugin.addCommand({
    id: 'interestseed-overview',
    name: '打开兴趣总览（只读）',
    callback: () => host.openDiscoveryOverview(),
  });

  plugin.addCommand({
    id: 'interestseed-reconcile-discoveries',
    name: '核对发现与图谱应用状态',
    callback: () => {
      void host.reconcileDiscoveries();
    },
  });

  plugin.addCommand({
    id: 'interestseed-undo',
    name: '撤销图谱操作',
    callback: () => {
      if (!host.undo.undo()) new Notice('没有可撤销的操作。');
    },
  });

  plugin.addCommand({
    id: 'interestseed-redo',
    name: '重做图谱操作',
    callback: () => {
      if (!host.undo.redo()) new Notice('没有可重做的操作。');
    },
  });

  plugin.addCommand({
    id: 'interestseed-ai-expand',
    name: 'AI 关系建议（未启用）',
    callback: () => {
      void host.expandWithAI();
    },
  });

  plugin.addCommand({
    id: 'interestseed-clear',
    name: '清空兴趣图谱',
    callback: () => {
      void host.clearGraph();
    },
  });

  plugin.addCommand({
    id: 'interestseed-retry-save',
    name: '重试保存图谱',
    callback: () => {
      void host.retrySave();
    },
  });

  plugin.addCommand({
    id: 'interestseed-backup',
    name: '创建图谱备份',
    callback: () => {
      void host.createBackup();
    },
  });

  plugin.addCommand({
    id: 'interestseed-repair-storage',
    name: '备份旧数据并重置图谱存储',
    callback: () => {
      void host.repairGraphStorage();
    },
  });
}
