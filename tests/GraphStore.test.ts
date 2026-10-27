import { describe, expect, it } from 'vitest';
import {
  InterestSeedGraphStore as GraphStore,
  GraphStoreError,
  mergeStatus,
} from '../src/core/GraphStore';
import type { GraphChangeEvent } from '../src/core/GraphStore';

const NOW = '2026-01-01T00:00:00.000Z';

function createStore(now = NOW): GraphStore {
  return new GraphStore(undefined, { now: () => now });
}

describe('GraphStore / 节点', () => {
  it('创建节点时补齐默认值并清洗标签', () => {
    const store = createStore();
    const node = store.addNode({ title: '  研究计划  ', tags: ['#Focus', 'focus', ' 归档 '] });

    expect(node.title).toBe('研究计划');
    expect(node.type).toBe('document');
    expect(node.tags).toEqual(['Focus', '归档']);
    expect(node.createdAt).toBe(NOW);
    expect(node.updatedAt).toBe(NOW);
    expect(node.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(node.metadata).toEqual({});
    expect(node.sourceUri).toBeUndefined();
    expect(store.nodeCount).toBe(1);
  });

  it('支持显式类型、sourceUri 与 metadata', () => {
    const store = createStore();
    const node = store.addNode({
      id: 'p1',
      type: 'project',
      title: '论文',
      sourceUri: 'vault:项目/论文.md',
      metadata: { summary: '摘要' },
    });

    expect(node.type).toBe('project');
    expect(node.sourceUri).toBe('vault:项目/论文.md');
    expect(node.metadata).toEqual({ summary: '摘要' });
  });

  it('拒绝空标题、未知类型与重复 id', () => {
    const store = createStore();
    expect(() => store.addNode({ title: '   ' })).toThrowError(GraphStoreError);
    expect(() =>
      store.addNode({ title: 'X', type: 'unknown' as never }),
    ).toThrowError(/未知的节点类型/);

    store.addNode({ id: 'fixed', title: 'A' });
    expect(() => store.addNode({ id: 'fixed', title: 'B' })).toThrowError(/节点已存在/);
  });

  it('updateNode 更新字段并推进 updatedAt', () => {
    let clock = NOW;
    const store = new GraphStore(undefined, { now: () => clock });
    const node = store.addNode({ id: 'n1', title: 'A' });

    clock = '2026-01-02T00:00:00.000Z';
    const updated = store.updateNode('n1', {
      type: 'topic',
      title: '  A2  ',
      tags: ['x', 'x', 'y'],
      metadata: { summary: '新摘要' },
    });

    expect(updated.type).toBe('topic');
    expect(updated.title).toBe('A2');
    expect(updated.tags).toEqual(['x', 'y']);
    expect(updated.metadata.summary).toBe('新摘要');
    expect(updated.updatedAt).toBe('2026-01-02T00:00:00.000Z');
    expect(updated.createdAt).toBe(NOW);
    expect(node.id).toBe('n1');
  });

  it('removeNode 级联删除所有关联边', () => {
    const store = createStore();
    store.addNode({ id: 'a', title: 'A' });
    store.addNode({ id: 'b', title: 'B' });
    store.addNode({ id: 'c', title: 'C' });
    store.addEdge({ source: 'a', target: 'b', relation: 'references' });
    store.addEdge({ source: 'b', target: 'c', relation: 'references' });

    expect(store.removeNode('b')).toBe(2);
    expect(store.edgeCount).toBe(0);
    expect(store.getNode('a')).toBeDefined();
    expect(store.removeNode('missing')).toBe(0);
  });

  it('更新节点不会修改旧引用或外部补丁对象', () => {
    const store = createStore();
    const before = store.addNode({
      id: 'a',
      title: 'A',
      tags: ['x'],
      metadata: { key: 'old' },
    });
    const patch = { title: 'B', metadata: { key: 'new' } };

    const next = store.updateNode('a', patch);

    expect(before.title).toBe('A');
    expect(before.metadata).toEqual({ key: 'old' });
    expect(next).not.toBe(before);

    patch.metadata.key = 'mutated';
    expect(store.getNode('a')?.metadata.key).toBe('new');
  });

  it('更新节点 sourceUri 时拒绝与其他节点重复', () => {
    const store = createStore();
    store.addNode({ id: 'a', title: 'A', sourceUri: 'vault:a.md' });
    store.addNode({ id: 'b', title: 'B', sourceUri: 'vault:b.md' });

    expect(() => store.updateNode('b', { sourceUri: 'vault:a.md' })).toThrowError(
      /同一来源/,
    );
    expect(store.getNode('b')?.sourceUri).toBe('vault:b.md');
  });

  it('upsertNode 按 id 或 sourceUri 匹配', () => {
    const store = createStore();
    const first = store.upsertNode({ title: 'A', sourceUri: '笔记/a.md' });
    const second = store.upsertNode({ title: 'A 改名', sourceUri: '笔记/a.md' });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(store.nodeCount).toBe(1);
    expect(second.node.title).toBe('A 改名');
    expect(store.findNodeByUri('笔记/a.md')?.id).toBe(second.node.id);
  });

  it('同一 sourceUri 不能再创建第二个节点', () => {
    const store = createStore();
    store.addNode({ id: 'x', title: 'X', sourceUri: 'vault:a.md' });
    expect(() =>
      store.addNode({ id: 'y', title: 'Y', sourceUri: 'vault:a.md' }),
    ).toThrowError(/同一来源/);
  });
});

describe('GraphStore / 关系', () => {
  function seededStore(): GraphStore {
    const store = createStore();
    store.addNode({ id: 'a', title: 'A' });
    store.addNode({ id: 'b', title: 'B' });
    store.addNode({ id: 'c', title: 'C' });
    return store;
  }

  it('校验端点、自环与空 relation', () => {
    const store = seededStore();
    expect(() => store.addEdge({ source: 'a', target: 'missing', relation: 'x' })).toThrowError(
      /不存在/,
    );
    expect(() => store.addEdge({ source: 'a', target: 'a', relation: 'x' })).toThrowError(/自环/);
    expect(() => store.addEdge({ source: 'a', target: 'b', relation: '  ' })).toThrowError(
      /relation/,
    );
  });

  it('同一对端点 + 同一 relation 会合并，并保留最强状态与置信度', () => {
    const store = seededStore();
    const first = store.addEdge({
      source: 'a',
      target: 'b',
      relation: 'related-to',
      origin: 'rule',
      status: 'suggested',
      confidence: 0.42,
      evidence: ['共享标签 #x'],
    });

    const merged = store.addEdge({
      source: 'a',
      target: 'b',
      relation: 'related-to',
      origin: 'user',
      status: 'confirmed',
      confidence: 0.8,
      evidence: ['人工确认'],
    });

    expect(store.edgeCount).toBe(1);
    expect(merged.id).toBe(first.id);
    expect(merged.status).toBe('confirmed');
    expect(merged.origin).toBe('user');
    expect(merged.confidence).toBe(0.8);
    expect(merged.evidence).toEqual(['共享标签 #x', '人工确认']);
  });

  it('状态合并遵循 confirmed > rejected > suggested', () => {
    expect(mergeStatus('suggested', 'confirmed')).toBe('confirmed');
    expect(mergeStatus('suggested', 'rejected')).toBe('rejected');
    expect(mergeStatus('rejected', 'confirmed')).toBe('confirmed');
    expect(mergeStatus('suggested', 'suggested')).toBe('suggested');
  });

  it('不同 relation 会生成不同的边', () => {
    const store = seededStore();
    store.addEdge({ source: 'a', target: 'b', relation: 'references' });
    store.addEdge({ source: 'a', target: 'b', relation: 'contrasts' });

    expect(store.edgeCount).toBe(2);
    expect(store.findEdge('a', 'b', 'references')?.relation).toBe('references');
    expect(store.degree('a')).toBe(2);
  });

  it('updateEdge 支持确认、拒绝、置信度与改名', () => {
    const store = seededStore();
    const edge = store.addEdge({
      source: 'a',
      target: 'b',
      relation: 'related-to',
      origin: 'rule',
      status: 'suggested',
      confidence: 0.4,
      evidence: ['两个笔记具有相同标签：focus'],
    });

    const confirmed = store.updateEdge(edge.id, { status: 'confirmed' });
    expect(confirmed.status).toBe('confirmed');

    const rejected = store.updateEdge(edge.id, { status: 'rejected', evidence: ['不相关'] });
    expect(rejected.status).toBe('rejected');
    expect(rejected.evidence).toEqual(['不相关']);

    store.updateEdge(edge.id, { relation: 'supports' });
    expect(store.findEdge('a', 'b', 'supports')).toBeDefined();
    expect(store.findEdge('a', 'b', 'related-to')).toBeUndefined();
  });

  it('规则与 AI 关系必须提供 evidence', () => {    const store = seededStore();
    expect(() =>
      store.addEdge({
        source: 'a',
        target: 'b',
        relation: 'related-to',
        origin: 'rule',
        status: 'suggested',
      }),
    ).toThrowError(/evidence/);

    expect(() =>
      store.addEdge({
        source: 'a',
        target: 'b',
        relation: 'suggests',
        origin: 'ai',
        status: 'suggested',
        confidence: 0.8,
      }),
    ).toThrowError(/evidence/);

    const edge = store.addEdge({
      source: 'a',
      target: 'b',
      relation: 'related-to',
      origin: 'rule',
      status: 'suggested',
      evidence: ['两个笔记具有相同标签：focus'],
    });
    expect(edge.origin).toBe('rule');
    expect(edge.evidence).toEqual(['两个笔记具有相同标签：focus']);
  });

  it('接口级不变量：不可变字段、重复关系 id 与 validate', () => {
    const store = seededStore();

    expect(() => store.updateNode('a', { id: 'b' })).toThrowError(/id 不可修改/);
    expect(() =>
      store.updateNode('a', { createdAt: '2020-01-01T00:00:00.000Z' }),
    ).toThrowError(/createdAt 不可修改/);

    const created = store.addEdge({
      id: 'e1',
      source: 'a',
      target: 'b',
      relation: 'references',
      origin: 'user',
      status: 'confirmed',
    });
    expect(created.id).toBe('e1');

    expect(() =>
      store.addEdge({
        id: 'e1',
        source: 'a',
        target: 'b',
        relation: 'owns',
      }),
    ).toThrowError(/id 冲突/);

    expect(() =>
      store.updateEdge('e1', { source: 'c' }),
    ).toThrowError(/source 不可修改/);

    expect(store.validate()).toEqual([]);
  });

  it('更新关系名称时拒绝与已有关系重复', () => {
    const store = seededStore();
    const first = store.addEdge({
      source: 'a',
      target: 'b',
      relation: 'references',
      origin: 'user',
      status: 'confirmed',
    });
    const second = store.addEdge({
      source: 'a',
      target: 'b',
      relation: 'owns',
      origin: 'user',
      status: 'confirmed',
    });

    expect(() => store.updateEdge(second.id, { relation: 'references' })).toThrowError(
      /已存在/,
    );

    expect(store.findEdge('a', 'b', 'references')?.id).toBe(first.id);
    expect(store.findEdge('a', 'b', 'owns')?.id).toBe(second.id);
  });

  it('规则关系不能通过更新清空 evidence', () => {
    const store = seededStore();
    const edge = store.addEdge({
      source: 'a',
      target: 'b',
      relation: 'related-to',
      origin: 'rule',
      status: 'suggested',
      evidence: ['两个笔记具有相同标签：focus'],
    });

    expect(() => store.updateEdge(edge.id, { evidence: [] })).toThrowError(/evidence/);
    expect(store.getEdge(edge.id)?.evidence).toEqual(['两个笔记具有相同标签：focus']);
  });

  it('更新关系不会修改旧引用', () => {
    const store = seededStore();
    const before = store.addEdge({
      source: 'a',
      target: 'b',
      relation: 'references',
      origin: 'user',
      status: 'suggested',
    });

    store.updateEdge(before.id, { status: 'confirmed' });

    expect(before.status).toBe('suggested');
    expect(store.getEdge(before.id)?.status).toBe('confirmed');
  });

  it('neighbors 支持方向、来源与状态过滤', () => {
    const store = seededStore();
    store.addEdge({
      source: 'a',
      target: 'b',
      relation: 'references',
      origin: 'user',
      status: 'confirmed',
    });
    store.addEdge({
      source: 'a',
      target: 'c',
      relation: 'related-to',
      origin: 'rule',
      status: 'suggested',
      evidence: ['两个笔记具有相同标签：x'],
    });

    expect(store.neighbors('a').map((entry) => entry.node.id).sort()).toEqual(['b', 'c']);
    expect(store.neighbors('a', { direction: 'incoming' })).toEqual([]);
    expect(store.neighbors('a', { direction: 'outgoing' })).toHaveLength(2);
    expect(store.neighbors('a', { statuses: ['suggested'] }).map((entry) => entry.node.id)).toEqual(
      ['c'],
    );
    expect(store.neighbors('a', { origins: ['user'] }).map((entry) => entry.node.id)).toEqual([
      'b',
    ]);
  });

  it('areConnected 识别任意方向', () => {
    const store = seededStore();
    store.addEdge({ source: 'a', target: 'b', relation: 'references' });
    expect(store.areConnected('a', 'b')).toBe(true);
    expect(store.areConnected('b', 'a')).toBe(true);
    expect(store.areConnected('a', 'c')).toBe(false);
  });

  it('removeEdge 清理索引与邻接', () => {
    const store = seededStore();
    const edge = store.addEdge({ source: 'a', target: 'b', relation: 'references' });
    expect(store.removeEdge(edge.id)).toBe(true);
    expect(store.removeEdge(edge.id)).toBe(false);
    expect(store.edgeCount).toBe(0);
    expect(store.degree('a')).toBe(0);
  });
});

describe('GraphStore / 序列化与统计', () => {
  it('发布增删改事件并支持取消订阅', () => {
    const store = createStore();
    const events: GraphChangeEvent[] = [];
    const unsubscribe = store.subscribe((event) => events.push(event));

    store.addNode({ id: 'a', title: 'A' });
    store.addNode({ id: 'b', title: 'B' });
    store.addEdge({ source: 'a', target: 'b', relation: 'references' });

    unsubscribe();
    store.updateNode('a', { title: 'A2' });

    expect(events.map((event) => event.type)).toEqual(['node:added', 'node:added', 'edge:added']);
  });

  it('toJSON 输出按 id 排序的数组结构', () => {
    const store = createStore();
    store.addNode({ id: 'c', title: 'C' });
    store.addNode({ id: 'a', title: 'A' });
    store.addNode({ id: 'b', title: 'B' });

    const graph = store.toJSON();
    expect(graph.nodes.map((node) => node.id)).toEqual(['a', 'b', 'c']);
    expect(graph.schemaVersion).toBe(2);
    expect(Array.isArray(graph.nodes)).toBe(true);
    expect(Array.isArray(graph.edges)).toBe(true);
  });

  it('视口可静默保存并随图谱输出', () => {
    const store = createStore();
    const events: GraphChangeEvent[] = [];
    store.subscribe((event) => events.push(event));

    store.setViewport({ zoom: 2, panX: 10, panY: -20 }, { silent: true });

    expect(events).toHaveLength(0);
    expect(store.currentViewport).toEqual({ zoom: 2, panX: 10, panY: -20 });
    expect(store.toJSON().viewport).toEqual({ zoom: 2, panX: 10, panY: -20 });

    store.setViewport(undefined);
    expect(store.toJSON().viewport).toBeUndefined();
    expect(events.at(-1)?.type).toBe('viewport:changed');
  });

  it('replace 重建索引并丢弃悬空边', () => {
    const store = createStore();
    store.replace(
      {
        schemaVersion: 2,
        updatedAt: NOW,
        nodes: [
          {
            id: 'a',
            type: 'document',
            title: 'A',
            tags: [],
            createdAt: NOW,
            updatedAt: NOW,
            metadata: {},
          },
        ],
        edges: [
          {
            id: 'dangling',
            source: 'a',
            target: 'missing',
            relation: 'references',
            origin: 'user',
            status: 'confirmed',
            createdAt: NOW,
            updatedAt: NOW,
          },
        ],
        viewport: { zoom: 1.5, panX: 1, panY: 2 },
      },
      { silent: true },
    );

    expect(store.nodeCount).toBe(1);
    expect(store.edgeCount).toBe(0);
    expect(store.currentViewport?.zoom).toBe(1.5);
  });

  it('stats 汇总类型、状态与孤立节点', () => {
    const store = createStore();
    store.addNode({ id: 'p', title: 'P', type: 'project' });
    store.addNode({ id: 'd', title: 'D', type: 'document' });
    store.addNode({ id: 'i', title: 'I', type: 'image' });

    store.addEdge({
      source: 'p',
      target: 'd',
      relation: 'contains',
      origin: 'user',
      status: 'confirmed',
    });
    store.addEdge({
      source: 'd',
      target: 'i',
      relation: 'references',
      origin: 'rule',
      status: 'suggested',
      evidence: ['两个笔记具有相同标签：x'],
    });
    store.addEdge({
      source: 'p',
      target: 'i',
      relation: 'unrelated',
      origin: 'user',
      status: 'rejected',
    });

    const stats = store.stats();
    expect(stats.nodes).toBe(3);
    expect(stats.edges).toBe(3);
    expect(stats.confirmed).toBe(1);
    expect(stats.suggested).toBe(1);
    expect(stats.rejected).toBe(1);
    expect(stats.orphans).toBe(1);
    expect(stats.averageDegree).toBeCloseTo(2 / 3);
    expect(stats.byType.project).toBe(1);
    expect(stats.byType.image).toBe(1);
    expect(stats.byType.video).toBe(0);
  });

  it('stats 的孤立与平均度只按 confirmed 关系计算', () => {
    const store = createStore();
    for (const id of ['a', 'b', 'c', 'd']) {
      store.addNode({ id, title: id.toUpperCase() });
    }

    const suggested = store.addEdge({
      source: 'a',
      target: 'b',
      relation: 'references',
      origin: 'user',
      status: 'suggested',
    });
    store.addEdge({
      source: 'a',
      target: 'c',
      relation: 'references',
      origin: 'user',
      status: 'rejected',
    });
    store.addEdge({
      source: 'b',
      target: 'd',
      relation: 'references',
      origin: 'user',
      status: 'rejected',
    });

    expect(store.stats().orphans).toBe(4);
    expect(store.stats().averageDegree).toBe(0);

    store.updateEdge(suggested.id, { status: 'confirmed' });

    const stats = store.stats();
    expect(stats.confirmed).toBe(1);
    expect(stats.suggested).toBe(0);
    expect(stats.rejected).toBe(2);
    expect(stats.orphans).toBe(2);
    expect(stats.averageDegree).toBeCloseTo(0.5);
  });
});
