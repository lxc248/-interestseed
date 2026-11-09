import { Notice, type App } from 'obsidian';
import type { InterestSeedGraph, InterestSeedNode } from '../types/graph';
import { buildJsonCanvas } from '../services/jsonCanvas';
import { renderInterestRoute } from '../services/interestRoute';
import { slugifyFileName } from '../utils/paths';

export async function exportJsonCanvas(app: App, graph: InterestSeedGraph): Promise<void> {
  if (graph.nodes.length === 0) {
    new Notice('图谱里还没有节点，先留下一个火花。');
    return;
  }
  const canvas = buildJsonCanvas(graph);
  const folder = 'InterestSeed';
  if (!app.vault.getAbstractFileByPath(folder)) {
    await app.vault.createFolder(folder);
  }
  const stamp = new Date().toISOString().slice(0, 10);
  let path = `${folder}/兴趣图谱-${stamp}.canvas`;
  let suffix = 2;
  while (app.vault.getAbstractFileByPath(path)) {
    path = `${folder}/兴趣图谱-${stamp}-${suffix}.canvas`;
    suffix += 1;
  }
  await app.vault.create(path, JSON.stringify(canvas, null, 2));
  await app.workspace.openLinkText(path, '', false);
  new Notice(`已导出 JSON Canvas：${path}`);
}

export async function exportInterestRoute(
  app: App,
  input: {
    theme: string;
    nodes: readonly InterestSeedNode[];
    connectedIds: ReadonlySet<string>;
    experiment: {
      title: string;
      day: number;
      targetDays: number;
      status: string;
      next?: string;
    } | null;
  },
): Promise<void> {
  const markdown = renderInterestRoute(input);
  const folder = 'InterestSeed';
  if (!app.vault.getAbstractFileByPath(folder)) {
    await app.vault.createFolder(folder);
  }
  const date = new Date().toISOString().slice(0, 10);
  const base = `${folder}/兴趣路线 - ${slugifyFileName(input.theme)} - ${date}`;
  let path = `${base}.md`;
  let suffix = 2;
  while (app.vault.getAbstractFileByPath(path)) {
    path = `${base} ${suffix}.md`;
    suffix += 1;
  }
  const file = await app.vault.create(path, markdown);
  new Notice(`已生成兴趣路线：${path}`);
  await app.workspace.openLinkText(file.path, '', false);
}
