import { describe, expect, it } from 'vitest';
import {
  InterestSeedGraphBuilder,
  detectNodeType,
  extractSummary,
  extractTags,
  extractWikilinks,
  parseFrontmatter,
  type GraphBuildOptions,
} from '../src/core/GraphBuilder';
import { InterestSeedGraphStore } from '../src/core/GraphStore';
import { GraphSession } from '../src/core/GraphSession';
import { UndoHistory } from '../src/core/UndoManager';
import type {
  InterestSeedEdge,
  InterestSeedGraph,
  InterestSeedNode,
  NodeType,
} from '../src/types/graph';
import { emptyGraph } from '../src/types/graph';
import { edgeIdFor, nodeIdForUri } from '../src/utils/ids';

const NOW = '2026-01-01T00:00:00.000Z';

function node(
  title: string,
  options: {
    path?: string;
    tags?: string[];
    type?: NodeType;
    links?: string[];
    summary?: string;
  } = {},
): InterestSeedNode {
  const path = options.path ?? `${title}.md`;
  const metadata: Record<string, unknown> = {
    path,
    extension: 'md',
    links: options.links ?? [],
  };
  if (options.summary) metadata.summary = options.summary;

  return {
    id: `node_${title.toLowerCase()}`,
    type: options.type ?? 'document',
    title,
    sourceUri: `vault:${path}`,
    tags: options.tags ?? [],
    createdAt: NOW,
    updatedAt: NOW,
    metadata,
  };
}

const alpha = node('Alpha', {
  path: '项目/Alpha.md',
  type: 'project',
  tags: ['focus'],
  links: ['Notes/Beta'],
});
const beta = node('Beta', {
  path: 'Notes/Beta.md',
  tags: ['focus'],
  summary: '共享标签的文档。',
});
const gamma = node('Gamma', {
  path: 'Notes/Gamma.md',
  tags: ['focus'],
});

const options: GraphBuildOptions = {
  includeFolders: [],
  includeTags: [],
  includeOutgoingLinks: true,
};

function setup(initial: InterestSeedGraph = emptyGraph(NOW)): {
  builder: InterestSeedGraphBuilder;
  setCurrent: (graph: InterestSeedGraph) => void;
} {
  let current = initial;
  const builder = new InterestSeedGraphBuilder(
    () => current,
    undefined,
    () => NOW,
  );
  return {
    builder,
    setCurrent: (graph) => {
      current = graph;
    },
  };
}

function byTitle(graph: InterestSeedGraph, title: string): InterestSeedNode {
  const found = graph.nodes.find((item) => item.title === title);
  if (!found) throw new Error(`找不到节点：${title}`);
  return found;
}

describe('frontmatter 与文本解析', () => {
  it('解析标量、数字、布尔与块数组', () => {
    const { data, body } = parseFrontmatter(
      [
        '---',
        'title: 深度工作',
        'tags:',
        '  - focus',
        '  - 方法',
        'weight: 0.9',
        'project: true',
        '---',
        '# 深度工作',
        '',
        '正文内容。',
      ].join('\n'),
    );

    expect(data.title).toBe('深度工作');
    expect(data.tags).toEqual(['focus', '方法']);
    expect(data.weight).toBe(0.9);
    expect(body.startsWith('# 深度工作')).toBe(true);
  });

  it('提取标签、双链与摘要', () => {
    const { data, body } = parseFrontmatter(
      '---\ntags: [效率]\n---\n# 标题\n\n关于 #专注 与 [[目标|别名]]。\n',
    );

    expect(extractTags(data, body)).toEqual(['效率', '专注']);
    expect(extractWikilinks(body)[0]?.alias).toBe('别名');
    expect(extractSummary(body)).toContain('关于');
  });
});

describe('节点类型判定', () => {
  it('frontmatter type 优先，其次 project / activity 标记', () => {
    expect(detectNodeType({ path: 'a.md', extension: 'md' }, { type: 'topic' })).toBe('topic');
    expect(detectNodeType({ path: 'a.md', extension: 'md' }, { project: true })).toBe('project');
    expect(detectNodeType({ path: 'a.md', extension: 'md' }, { activity: 'true' })).toBe(
      'activity',
    );
  });
});

describe('InterestSeedGraphBuilder.build', () => {
  it('使用来源 uri 派生稳定 id 并保留节点信息', () => {
    const { builder } = setup();
    const graph = builder.build([alpha, beta, gamma], options);

    const alphaNode = byTitle(graph, 'Alpha');
    expect(alphaNode.id).toBe(nodeIdForUri(alpha.sourceUri ?? ''));
    expect(alphaNode.type).toBe('project');
    expect(alphaNode.tags).toEqual(['focus']);
    expect(graph.nodes).toHaveLength(3);
    expect(builder.lastReport.byType.project).toBe(1);
    expect(builder.lastReport.byType.document).toBe(2);
    expect(builder.lastReport.byType.topic).toBe(0);
  });

  it('把 metadata.links 解析为可追溯的 references 关系', () => {
    const { builder } = setup();
    const graph = builder.build([alpha, beta], options);

    const edge = graph.edges.find((item) => item.relation === 'references');
    expect(edge).toBeDefined();
    expect(edge?.origin).toBe('user');
    expect(edge?.status).toBe('suggested');
    expect(edge?.source).toBe(nodeIdForUri(alpha.sourceUri ?? ''));
    expect(edge?.target).toBe(nodeIdForUri(beta.sourceUri ?? ''));
    expect(edge?.evidence?.[0]).toContain('Notes/Beta');
  });

  it('只为链接 / 标签 / 用户主题建立关系，不因同目录相关', () => {
    const left = node('Left', { path: 'Same/Left.md' });
    const right = node('Right', { path: 'Same/Right.md' });
    const { builder } = setup();

    const graph = builder.build([left, right], options);
    expect(graph.edges).toHaveLength(0);
  });

  it('笔记匹配用户定义的主题节点', () => {
    const topic: InterestSeedNode = {
      id: 'topic-1',
      type: 'topic',
      title: 'Focus',
      tags: ['focus'],
      createdAt: NOW,
      updatedAt: NOW,
      metadata: {},
    };

    const { builder } = setup();
    const graph = builder.build([alpha, topic], options);

    const edge = graph.edges.find(
      (item) => item.relation === 'about' && item.target === 'topic-1',
    );
    expect(edge).toBeDefined();
    expect(edge?.origin).toBe('rule');
    expect(edge?.evidence?.[0]).toContain('Focus');
  });

  it('为共享标签的节点生成规则建议', () => {
    const { builder } = setup();
    const graph = builder.build([alpha, beta, gamma], options);

    const ruleEdges = graph.edges.filter(
      (edge) => edge.origin === 'rule' && edge.status === 'suggested',
    );
    expect(ruleEdges.length).toBeGreaterThanOrEqual(2);
    expect(ruleEdges[0]?.relation).toBe('related-to');
  });

  it('未解析的链接写入报告而不是虚构节点', () => {
    const delta = node('Delta', { links: ['不存在的笔记'] });
    const { builder } = setup();

    const graph = builder.build([delta], options);
    expect(graph.nodes).toHaveLength(1);
    expect(graph.edges).toHaveLength(0);
    expect(builder.lastReport.unresolvedLinks[0]).toContain('不存在的笔记');
  });

  it('重复来源只保留一个节点并记录 warning', () => {
    const duplicate = node('Alpha', { path: '项目/Alpha.md' });
    const { builder } = setup();

    const graph = builder.build([alpha, duplicate], options);
    expect(graph.nodes).toHaveLength(1);
    expect(builder.lastReport.warnings.length).toBeGreaterThan(0);
  });

  it('includeOutgoingLinks=false 时不出链关系', () => {
    const { builder } = setup();
    builder.configure({ enableRuleSuggestions: false });
    const graph = builder.build([alpha, beta], {
      ...options,
      includeOutgoingLinks: false,
    });

    expect(graph.edges).toHaveLength(0);
  });

  it('includeFolders / includeTags 过滤扫描节点', () => {
    const { builder } = setup();
    const byFolder = builder.build([alpha, beta, gamma], {
      ...options,
      includeFolders: ['Notes'],
    });
    expect(byFolder.nodes.map((item) => item.title).sort()).toEqual(['Beta', 'Gamma']);

    const other = node('Other', { path: 'Notes/Other.md', tags: ['misc'] });
    const byTag = builder.build([beta, other], { ...options, includeTags: ['focus'] });
    expect(byTag.nodes.map((item) => item.title)).toEqual(['Beta']);
  });

  it('重复扫描复用节点与关系，不产生重复数据', () => {
    const { builder, setCurrent } = setup();
    const first = builder.build([alpha, beta, gamma], options);

    setCurrent(first);
    const second = builder.build([alpha, beta, gamma], options);

    expect(second.nodes).toEqual(first.nodes);
    expect(second.edges).toEqual(first.edges);
    expect(second).toEqual(first);
  });

  it('保留用户确认的关系状态与时间戳', () => {
    const { builder, setCurrent } = setup();
    const first = builder.build([alpha, beta], options);

    const store = new InterestSeedGraphStore(first, { now: () => NOW });
    const reference = first.edges.find((item) => item.relation === 'references');
    if (!reference) throw new Error('缺少 references 关系');
    store.updateEdge(reference.id, { status: 'confirmed' });

    setCurrent(store.toJSON());
    const second = builder.build([alpha, beta], options);
    const edge = second.edges.find((item) => item.id === reference.id);

    expect(edge?.status).toBe('confirmed');
    expect(edge?.createdAt).toBe(reference.createdAt);
  });

  it('保留手动创建的节点与关系，即使再次扫描', () => {
    const manualNode: InterestSeedNode = {
      id: 'manual-node',
      type: 'project',
      title: '我的项目',
      tags: [],
      createdAt: NOW,
      updatedAt: NOW,
      metadata: {},
    };
    const manualEdge: InterestSeedEdge = {
      id: 'manual-edge',
      source: 'manual-node',
      target: nodeIdForUri(beta.sourceUri ?? ''),
      relation: 'contains',
      origin: 'user',
      status: 'confirmed',
      createdAt: NOW,
      updatedAt: NOW,
    };

    const initial: InterestSeedGraph = {
      schemaVersion: 2,
      updatedAt: NOW,
      nodes: [manualNode],
      edges: [manualEdge],
    };

    const { builder } = setup(initial);
    const graph = builder.build([beta], options);

    expect(graph.nodes.some((item) => item.id === 'manual-node')).toBe(true);
    expect(graph.edges.some((item) => item.id === 'manual-edge')).toBe(true);
  });

  it('重新扫描保留节点位置', () => {
    const positioned = {
      ...alpha,
      metadata: { ...alpha.metadata, position: { x: 10, y: 20 } },
    };

    const { builder, setCurrent } = setup();
    const first = builder.build([positioned, beta], options);
    expect(byTitle(first, 'Alpha').metadata.position).toEqual({ x: 10, y: 20 });

    setCurrent(first);
    const second = builder.build([alpha, beta], options);
    expect(byTitle(second, 'Alpha').metadata.position).toEqual({ x: 10, y: 20 });
  });

  it('重新扫描不清空撤销历史，也不覆盖手动关系', () => {
    const store = new InterestSeedGraphStore(undefined, { now: () => NOW });
    const undo = new UndoHistory();
    const session = new GraphSession(store, undo);

    const stableAlpha = { ...alpha, id: nodeIdForUri(alpha.sourceUri ?? '') };
    const stableBeta = { ...beta, id: nodeIdForUri(beta.sourceUri ?? '') };
    const manualTopic: InterestSeedNode = {
      id: 'manual-topic',
      type: 'topic',
      title: 'Focus',
      tags: ['focus'],
      createdAt: NOW,
      updatedAt: NOW,
      metadata: {},
    };
    const manualEdge: InterestSeedEdge = {
      id: 'manual-ref',
      source: stableAlpha.id,
      target: stableBeta.id,
      relation: 'references',
      origin: 'user',
      status: 'suggested',
      confidence: 1,
      evidence: ['手动确认的链接'],
      createdAt: NOW,
      updatedAt: NOW,
    };

    session.addNode(manualTopic);
    session.addNode(stableAlpha);
    session.addNode(stableBeta);
    session.addEdge(manualEdge);
    session.updateEdge(manualEdge.id, { status: 'confirmed' });

    const depthBeforeRescan = undo.depth();
    const builder = new InterestSeedGraphBuilder(
      () => store.getGraph(),
      undefined,
      () => NOW,
    );

    const graph = builder.build([stableAlpha, stableBeta], options);
    session.apply(graph);

    expect(undo.depth()).toBe(depthBeforeRescan);
    expect(store.getNode('manual-topic')).toBeDefined();
    expect(store.getEdge('manual-ref')?.status).toBe('confirmed');

    expect(undo.undo()).toBe(true);
    expect(store.getEdge('manual-ref')?.status).toBe('suggested');
  });

  it('降噪过滤后仍保留 confirmed 和 rejected 关系', () => {
    const nodes = Array.from({ length: 600 }, (_, index) =>
      node(`Node ${index}`, { tags: ['broad'] }),
    );
    const { builder, setCurrent } = setup();
    const first = builder.build(nodes, options);

    const store = new InterestSeedGraphStore(first, { now: () => NOW });
    const a = byTitle(first, 'Node 0');
    const b = byTitle(first, 'Node 1');
    const c = byTitle(first, 'Node 2');
    const d = byTitle(first, 'Node 3');
    store.addEdge({
      id: 'confirmed-high',
      source: a.id,
      target: b.id,
      relation: 'related-to',
      origin: 'user',
      status: 'confirmed',
      createdAt: NOW,
      updatedAt: NOW,
    });
    store.addEdge({
      id: 'rejected-high',
      source: c.id,
      target: d.id,
      relation: 'related-to',
      origin: 'user',
      status: 'rejected',
      createdAt: NOW,
      updatedAt: NOW,
    });

    setCurrent(store.toJSON());
    const second = builder.build(nodes, options);

    expect(second.edges.find((edge) => edge.id === 'confirmed-high')?.status).toBe(
      'confirmed',
    );
    expect(second.edges.find((edge) => edge.id === 'rejected-high')?.status).toBe(
      'rejected',
    );
    expect(second.edges.some((edge) => edge.status === 'suggested')).toBe(false);
  });

  it('降噪后不再生成的旧 suggested 关系会被重建清理', () => {
    const nodes = Array.from({ length: 600 }, (_, index) =>
      node(`Node ${index}`, { tags: ['broad'] }),
    );
    const { builder, setCurrent } = setup();
    const first = builder.build(nodes, options);

    const store = new InterestSeedGraphStore(first, { now: () => NOW });
    const a = byTitle(first, 'Node 0');
    const b = byTitle(first, 'Node 1');
    store.addEdge({
      id: 'old-suggested',
      source: a.id,
      target: b.id,
      relation: 'related-to',
      origin: 'rule',
      status: 'suggested',
      evidence: ['旧规则建议'],
      createdAt: NOW,
      updatedAt: NOW,
    });

    setCurrent(store.toJSON());
    const second = builder.build(nodes, options);

    expect(second.edges.some((edge) => edge.id === 'old-suggested')).toBe(false);
  });

  it('降噪后 rejected 关系仍抑制同 key 候选', () => {
    const a = node('A', { tags: ['focus'] });
    const b = node('B', { tags: ['focus'] });
    const { builder, setCurrent } = setup();
    const first = builder.build([a, b], options);
    const related = first.edges.find((edge) => edge.relation === 'related-to');
    if (!related) throw new Error('缺少 related-to 关系');

    const store = new InterestSeedGraphStore(first, { now: () => NOW });
    store.updateEdge(related.id, { status: 'rejected' });
    setCurrent(store.toJSON());

    const second = builder.build([a, b], options);
    const sameKey = second.edges.filter(
      (edge) => edge.relation === 'related-to',
    );

    expect(sameKey).toHaveLength(1);
    expect(sameKey[0]?.id).toBe(related.id);
    expect(sameKey[0]?.status).toBe('rejected');
  });

  it('标题排序反转时旧的 suggested 关系保留 ID 与方向', () => {
    const a = node('A', { tags: ['focus'] });
    const b = node('B', { tags: ['focus'] });
    const { builder, setCurrent } = setup();
    const first = builder.build([a, b], options);
    const edge = first.edges.find((item) => item.relation === 'related-to');
    if (!edge) throw new Error('缺少 related-to 关系');

    setCurrent(first);
    const renamedA = { ...a, title: 'Zeta' };
    const renamedB = { ...b, title: 'Alpha' };
    const second = builder.build([renamedA, renamedB], options);
    const related = second.edges.filter((item) => item.relation === 'related-to');

    expect(related).toHaveLength(1);
    expect(related[0]?.id).toBe(edge.id);
    expect(related[0]?.source).toBe(edge.source);
    expect(related[0]?.target).toBe(edge.target);
    expect(related[0]?.status).toBe('suggested');
  });

  it('手动 related-to 关系也会抑制反向标签候选', () => {
    const a = node('A', { tags: ['focus'] });
    const b = node('B', { tags: ['focus'] });
    const { builder, setCurrent } = setup();
    const first = builder.build([a, b], options);
    const store = new InterestSeedGraphStore(first, { now: () => NOW });
    const aNode = byTitle(first, 'A');
    const bNode = byTitle(first, 'B');
    store.addEdge({
      id: 'manual-related',
      source: bNode.id,
      target: aNode.id,
      relation: 'related-to',
      origin: 'user',
      status: 'confirmed',
      createdAt: NOW,
      updatedAt: NOW,
    });
    setCurrent(store.toJSON());

    const renamedA = { ...a, title: 'Zeta' };
    const renamedB = { ...b, title: 'Alpha' };
    const second = builder.build([renamedA, renamedB], options);
    const related = second.edges.filter((item) => item.relation === 'related-to');

    expect(related).toHaveLength(1);
    expect(related[0]?.id).toBe('manual-related');
    expect(related[0]?.status).toBe('confirmed');
  });

  it('不同关系类型不会被 related-to 方向保护误伤', () => {
    const a = node('A', { tags: ['focus'] });
    const b = node('B', { tags: ['focus'] });
    const { builder, setCurrent } = setup();
    const first = builder.build([a, b], options);
    const store = new InterestSeedGraphStore(first, { now: () => NOW });
    const aNode = byTitle(first, 'A');
    const bNode = byTitle(first, 'B');
    store.addEdge({
      id: 'manual-contains',
      source: aNode.id,
      target: bNode.id,
      relation: 'contains',
      origin: 'user',
      status: 'confirmed',
      createdAt: NOW,
      updatedAt: NOW,
    });
    setCurrent(store.toJSON());

    const renamedA = { ...a, title: 'Zeta' };
    const renamedB = { ...b, title: 'Alpha' };
    const second = builder.build([renamedA, renamedB], options);

    expect(second.edges.some((edge) => edge.id === 'manual-contains')).toBe(true);
    expect(second.edges.filter((edge) => edge.relation === 'related-to')).toHaveLength(1);
  });

  it('输入顺序反转时 confirmed 关系不会被相反方向的候选重复', () => {
    const a = node('A', { tags: ['focus'] });
    const b = node('B', { tags: ['focus'] });
    const { builder, setCurrent } = setup();
    const first = builder.build([a, b], options);
    const edge = first.edges.find((item) => item.relation === 'related-to');
    if (!edge) throw new Error('缺少 related-to 关系');

    const store = new InterestSeedGraphStore(first, { now: () => NOW });
    store.updateEdge(edge.id, { status: 'confirmed' });
    setCurrent(store.toJSON());

    // 标题排序反转，使共享标签候选的遍历方向变化。
    const renamedA = { ...a, title: 'Zeta' };
    const renamedB = { ...b, title: 'Alpha' };
    const second = builder.build([renamedA, renamedB], options);
    const related = second.edges.filter((item) => item.relation === 'related-to');

    expect(related).toHaveLength(1);
    expect(related[0]?.status).toBe('confirmed');
    expect(related[0]?.id).toBe(edge.id);
  });

  it('输入顺序反转时 rejected 不会以相反方向重新出现', () => {
    const a = node('A', { tags: ['focus'] });
    const b = node('B', { tags: ['focus'] });
    const { builder, setCurrent } = setup();
    const first = builder.build([a, b], options);
    const edge = first.edges.find((item) => item.relation === 'related-to');
    if (!edge) throw new Error('缺少 related-to 关系');

    const store = new InterestSeedGraphStore(first, { now: () => NOW });
    store.updateEdge(edge.id, { status: 'rejected' });
    setCurrent(store.toJSON());

    const renamedA = { ...a, title: 'Zeta' };
    const renamedB = { ...b, title: 'Alpha' };
    const second = builder.build([renamedA, renamedB], options);
    const related = second.edges.filter((item) => item.relation === 'related-to');

    expect(related).toHaveLength(1);
    expect(related[0]?.status).toBe('rejected');
    expect(related[0]?.id).toBe(edge.id);
  });

  it('降噪候选保持既有 edgeId 与 source/target 方向', () => {
    const { builder } = setup();
    const first = builder.build(
      [
        node('Alpha', { tags: ['focus'] }),
        node('Beta', { tags: ['focus'] }),
      ],
      options,
    );
    const alphaNode = byTitle(first, 'Alpha');
    const betaNode = byTitle(first, 'Beta');
    const edge = first.edges.find((item) => item.relation === 'related-to');

    expect(edge?.id).toBe(edgeIdFor(alphaNode.id, betaNode.id, 'related-to'));
    expect(edge?.source).toBe(alphaNode.id);
    expect(edge?.target).toBe(betaNode.id);
  });

  it('500 节点单标签的降噪候选没有语义重复', () => {
    const nodes = Array.from({ length: 500 }, (_, index) =>
      node(`Node ${index}`, { tags: ['broad'] }),
    );
    const { builder } = setup();
    const graph = builder.build(nodes, options);
    const related = graph.edges.filter((edge) => edge.relation === 'related-to');

    expect(related).toHaveLength(50);
    const pairs = new Set(
      related.map((edge) => [edge.source, edge.target].sort().join('|')),
    );
    expect(pairs.size).toBe(related.length);
  });

  it('扫描结果中消失的笔记节点会被移除', () => {
    const { builder, setCurrent } = setup();
    const first = builder.build([alpha, beta], options);

    setCurrent(first);
    const second = builder.build([beta], options);

    expect(second.nodes.map((item) => item.title)).toEqual(['Beta']);
    expect(second.edges.some((edge) => edge.relation === 'references')).toBe(false);
  });

  it('重命名规则建议后重扫保留用户名称、ID 与非名称字段', () => {
    const a = node('A', { tags: ['focus'] });
    const b = node('B', { tags: ['focus'] });
    const { builder, setCurrent } = setup();
    const first = builder.build([a, b], options);
    const original = first.edges.find((edge) => edge.relation === 'related-to');
    if (!original) throw new Error('缺少 related-to 关系');

    const store = new InterestSeedGraphStore(first, { now: () => NOW });
    store.updateEdge(original.id, { relation: '用户命名' });
    setCurrent(store.toJSON());

    const result = builder.buildWithReport([a, b], options);
    const edges = result.graph.edges.filter((edge) => edge.relation === '用户命名');

    expect(edges).toHaveLength(1);
    expect(edges[0]?.id).toBe(original.id);
    expect(edges[0]?.origin).toBe('rule');
    expect(edges[0]?.status).toBe('suggested');
    expect(edges[0]?.evidence).toEqual(original.evidence);
    expect(result.graph.edges.some((edge) => edge.relation === 'related-to')).toBe(false);
    expect(result.report.conflicts).toHaveLength(1);
    expect(result.report.conflicts[0]?.keptRelation).toBe('用户命名');
    expect(result.report.conflicts[0]?.candidateRelation).toBe('related-to');
  });

  it('重命名规则建议后连续重扫不重复生成关系', () => {
    const a = node('A', { tags: ['focus'] });
    const b = node('B', { tags: ['focus'] });
    const { builder, setCurrent } = setup();
    const first = builder.build([a, b], options);
    const original = first.edges.find((edge) => edge.relation === 'related-to');
    if (!original) throw new Error('缺少 related-to 关系');

    const store = new InterestSeedGraphStore(first, { now: () => NOW });
    store.updateEdge(original.id, { relation: '用户命名' });
    setCurrent(store.toJSON());

    const second = builder.buildWithReport([a, b], options);
    setCurrent(second.graph);
    const third = builder.buildWithReport([a, b], options);

    expect(third.graph.edges.filter((edge) => edge.relation === '用户命名')).toHaveLength(1);
    expect(third.graph.edges).toHaveLength(1);
    expect(third.report.conflicts).toHaveLength(1);
  });

  it('规则建议关闭时仍保留用户已改名的规则关系', () => {
    const a = node('A', { tags: ['focus'] });
    const b = node('B', { tags: ['focus'] });
    const { builder, setCurrent } = setup();
    const first = builder.build([a, b], options);
    const original = first.edges.find((edge) => edge.relation === 'related-to');
    if (!original) throw new Error('缺少 related-to 关系');

    const store = new InterestSeedGraphStore(first, { now: () => NOW });
    store.updateEdge(original.id, { relation: '用户命名' });
    setCurrent(store.toJSON());

    builder.configure({ enableRuleSuggestions: false, minConfidence: 0.35 });
    const result = builder.buildWithReport([a, b], options);

    expect(result.graph.edges).toHaveLength(1);
    expect(result.graph.edges[0]?.id).toBe(original.id);
    expect(result.graph.edges[0]?.relation).toBe('用户命名');
    expect(result.report.conflicts).toHaveLength(0);
  });

  it('用户把名称改回原始规则名后不再报告冲突', () => {
    const a = node('A', { tags: ['focus'] });
    const b = node('B', { tags: ['focus'] });
    const { builder, setCurrent } = setup();
    const first = builder.build([a, b], options);
    const original = first.edges.find((edge) => edge.relation === 'related-to');
    if (!original) throw new Error('缺少 related-to 关系');

    const store = new InterestSeedGraphStore(first, { now: () => NOW });
    store.updateEdge(original.id, { relation: '用户命名' });
    setCurrent(store.toJSON());
    const renamed = builder.build([a, b], options);

    const restored = new InterestSeedGraphStore(renamed, { now: () => NOW });
    restored.updateEdge(original.id, { relation: 'related-to' });
    setCurrent(restored.toJSON());
    const final = builder.buildWithReport([a, b], options);

    expect(final.graph.edges).toHaveLength(1);
    expect(final.graph.edges[0]?.id).toBe(original.id);
    expect(final.graph.edges[0]?.relation).toBe('related-to');
    expect(final.report.conflicts).toHaveLength(0);
  });
});
