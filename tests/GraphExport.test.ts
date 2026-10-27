import { describe, expect, it } from 'vitest';

import { emptyGraph } from '../src/types/graph';
import { graphExportFilename, serializeGraphExport } from '../src/utils/exportGraph';

describe('图谱 JSON 导出', () => {
  it('导出的 JSON 保留完整图谱结构且可重新解析', () => {
    const graph = emptyGraph('2026-10-20T00:00:00.000Z');
    graph.nodes.push({
      id: 'node_export_test',
      type: 'document',
      title: '导出测试',
      tags: ['导出'],
      createdAt: '2026-10-20T00:00:00.000Z',
      updatedAt: '2026-10-20T00:00:00.000Z',
      metadata: { path: 'note.md', extension: 'md' },
      sourceUri: 'vault:note.md',
    });
    graph.edges.push({
      id: 'edge_export_test',
      source: 'node_export_test',
      target: 'node_export_test',
      relation: 'related-to',
      origin: 'user',
      status: 'confirmed',
      confidence: 1,
      evidence: ['导出测试'],
      createdAt: '2026-10-20T00:00:00.000Z',
      updatedAt: '2026-10-20T00:00:00.000Z',
    });

    const text = serializeGraphExport(graph);
    const parsed = JSON.parse(text) as typeof graph;

    expect(parsed.schemaVersion).toBe(graph.schemaVersion);
    expect(parsed.nodes).toHaveLength(1);
    expect(parsed.edges).toHaveLength(1);
    expect(parsed.nodes[0]?.title).toBe('导出测试');
    expect(parsed.edges[0]?.status).toBe('confirmed');
    expect(text).toContain('\n  "nodes": [');
  });

  it('空图谱也能导出为合法 JSON', () => {
    const text = serializeGraphExport(emptyGraph('2026-10-20T00:00:00.000Z'));
    const parsed = JSON.parse(text) as { nodes: unknown[]; edges: unknown[] };

    expect(parsed.nodes).toEqual([]);
    expect(parsed.edges).toEqual([]);
  });

  it('导出不修改原图谱对象', () => {
    const graph = emptyGraph('2026-10-20T00:00:00.000Z');
    const before = JSON.stringify(graph);

    serializeGraphExport(graph);

    expect(JSON.stringify(graph)).toBe(before);
  });

  it('文件名包含本地时间且以 .json 结尾', () => {
    expect(graphExportFilename(new Date(2026, 9, 20, 3, 4, 5))).toBe(
      'interestseed-graph-20261020-030405.json',
    );
  });
});
