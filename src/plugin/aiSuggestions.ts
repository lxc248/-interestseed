import { Notice, type App, type TFile } from 'obsidian';
import { pathFromUri, vaultUri } from '../utils/paths';

export async function suggestForFile(input: {
  file: TFile;
  findNodeByUri: (uri: string) => { id: string } | undefined;
  listNodes: () => { id: string; sourceUri?: string }[];
  expandWithAI: (nodeId: string) => Promise<void>;
}): Promise<void> {
  const node =
    input.findNodeByUri(vaultUri(input.file.path)) ??
    input.listNodes().find((item) => {
      if (!item.sourceUri) return false;
      return pathFromUri(item.sourceUri).toLowerCase() === input.file.path.toLowerCase();
    });
  if (!node) {
    new Notice('这篇笔记还没进入图谱；先运行一次“重新扫描”。');
    return;
  }
  await input.expandWithAI(node.id);
}

export async function suggestForActiveNote(input: {
  app: App;
  suggestForFile: (file: TFile) => Promise<void>;
}): Promise<void> {
  const file = input.app.workspace.getActiveFile();
  if (!file) {
    new Notice('先打开一篇 Markdown 笔记。');
    return;
  }
  await input.suggestForFile(file);
}

export async function suggestForSelectedNode(input: {
  nodeId: string | null;
  expandWithAI: (nodeId: string) => Promise<void>;
}): Promise<void> {
  if (!input.nodeId) {
    new Notice('先在图谱里选中一个节点。');
    return;
  }
  await input.expandWithAI(input.nodeId);
}
