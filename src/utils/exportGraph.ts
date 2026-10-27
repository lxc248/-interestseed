import type { InterestSeedGraph } from '../types/graph';

/** 导出时只序列化图谱本身，不添加会破坏 GraphRepository 校验的额外字段。 */
export function serializeGraphExport(graph: InterestSeedGraph): string {
  return JSON.stringify(graph, null, 2);
}

/** 使用本地时间生成稳定、可排序的 JSON 文件名。 */
export function graphExportFilename(now: Date = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `interestseed-graph-${stamp}.json`;
}

/**
 * 触发浏览器下载。Obsidian 桌面端使用 Electron 的下载能力，
 * 不向 Vault 写入文件，也不发起网络请求。
 */
export function downloadGraphJson(
  graph: InterestSeedGraph,
  doc: Document = document,
  now: Date = new Date(),
): string {
  const text = serializeGraphExport(graph);
  const filename = graphExportFilename(now);
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = doc.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  doc.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // 延迟释放，避免部分 Electron 版本在下载开始前失效。
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  return filename;
}
