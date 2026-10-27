import { describe, expect, it } from 'vitest';
import { GraphSession } from '../src/core/GraphSession';
import { InterestSeedGraphStore } from '../src/core/GraphStore';
import { UndoHistory } from '../src/core/UndoManager';
import { edgeIdFor } from '../src/utils/ids';
import type { InterestSeedEdge, InterestSeedNode } from '../src/types/graph';

const NOW = '2026-01-01T00:00:00.000Z';

function node(id: string, title = id): InterestSeedNode {
  return {
    id,
    type: 'document',
    title,
    tags: [],
    createdAt: NOW,
    updatedAt: NOW,
    metadata: {},
  };
}

function edge(
  id: string,
  source: string,
  target: string,
  relation = 'references',
  origin: 'user' | 'rule' | 'ai' = 'user',
  status: 'confirmed' | 'suggested' | 'rejected' = 'suggested',
): InterestSeedEdge {
  const result: InterestSeedEdge = {
    id,
    source,
    target,
    relation,
    origin,
    status,
    createdAt: NOW,
    updatedAt: NOW,
  };
  if (origin !== 'user') result.evidence = ['测试证据'];
  return result;
}

function setup(): {
  store: InterestSeedGraphStore;
  undo: UndoHistory;
  session: GraphSession;
} {
  const store = new InterestSeedGraphStore(undefined, { now: () => NOW });
  const undo = new UndoHistory();
  const session = new GraphSession(store, undo);
  return { store, undo, session };
}

describe('GraphSession / 撤销记录', () => {
  it('新增节点可撤销、可重做', () => {
    const { store, undo, session } = setup();

    session.addNode(node('a', 'A'));
    expect(store.getNode('a')).toBeDefined();
    expect(undo.depth()).toBe(1);

    expect(undo.undo()).toBe(true);
    expect(store.getNode('a')).toBeUndefined();

    expect(undo.redo()).toBe(true);
    expect(store.getNode('a')).toBeDefined();
  });

  it('修改节点信息可撤销', () => {
    const { store, undo, session } = setup();
    session.addNode(node('a', 'A'));

    session.updateNode('a', { title: 'B', tags: ['x'] }, '改名');
    expect(store.getNode('a')?.title).toBe('B');
    expect(store.getNode('a')?.tags).toEqual(['x']);

    expect(undo.undo()).toBe(true);
    expect(store.getNode('a')?.title).toBe('A');
    expect(store.getNode('a')?.tags).toEqual([]);
  });

  it('新增和删除关系都可撤销', () => {
    const { store, undo, session } = setup();
    store.addNode(node('a', 'A'));
    store.addNode(node('b', 'B'));

    session.addEdge(edge('e1', 'a', 'b'));
    expect(store.getEdge('e1')).toBeDefined();
    expect(undo.undo()).toBe(true);
    expect(store.getEdge('e1')).toBeUndefined();

    session.addEdge(edge('e1', 'a', 'b'));
    session.removeEdge('e1');
    expect(store.getEdge('e1')).toBeUndefined();
    expect(undo.undo()).toBe(true);
    expect(store.getEdge('e1')).toBeDefined();
  });

  it('删除节点时同步删除关系，撤销后一起恢复', () => {
    const { store, undo, session } = setup();
    store.addNode(node('a', 'A'));
    store.addNode(node('b', 'B'));
    store.addEdge(edge('e1', 'a', 'b'));

    session.removeNode('a');
    expect(store.getNode('a')).toBeUndefined();
    expect(store.getGraph().edges).toHaveLength(0);

    expect(undo.undo()).toBe(true);
    expect(store.getNode('a')).toBeDefined();
    expect(store.getGraph().edges).toHaveLength(1);
    expect(store.getGraph().edges[0]?.id).toBe('e1');
  });

  it('确认关系可撤销回 suggested', () => {
    const { store, undo, session } = setup();
    store.addNode(node('a', 'A'));
    store.addNode(node('b', 'B'));
    session.addEdge(edge('e1', 'a', 'b', 'related-to', 'rule', 'suggested'));

    session.updateEdge('e1', { status: 'confirmed' }, '确认关系');
    expect(store.getEdge('e1')?.status).toBe('confirmed');

    expect(undo.undo()).toBe(true);
    expect(store.getEdge('e1')?.status).toBe('suggested');

    expect(undo.redo()).toBe(true);
    expect(store.getEdge('e1')?.status).toBe('confirmed');
  });

  it('修改关系名称保留 edge.id，并支持撤销/重做', () => {
    const { store, undo, session } = setup();
    store.addNode(node('a', 'A'));
    store.addNode(node('b', 'B'));
    session.addEdge(edge('e1', 'a', 'b', 'references', 'rule', 'suggested'));

    session.updateEdge('e1', { relation: 'contrasts' }, '编辑关系');
    expect(store.getEdge('e1')?.id).toBe('e1');
    expect(store.getEdge('e1')?.relation).toBe('contrasts');
    expect(store.getEdge('e1')?.userRenamed).toBe(true);

    expect(undo.undo()).toBe(true);
    expect(store.getEdge('e1')?.id).toBe('e1');
    expect(store.getEdge('e1')?.relation).toBe('references');
    expect(store.getEdge('e1')?.userRenamed).toBeUndefined();

    expect(undo.redo()).toBe(true);
    expect(store.getEdge('e1')?.id).toBe('e1');
    expect(store.getEdge('e1')?.relation).toBe('contrasts');
    expect(store.getEdge('e1')?.userRenamed).toBe(true);
  });

  it('规则关系改回与 ID 对应的原名时清除保护标记', () => {
    const { store, session } = setup();
    store.addNode(node('a', 'A'));
    store.addNode(node('b', 'B'));
    const id = edgeIdFor('a', 'b', 'references');
    session.addEdge(edge(id, 'a', 'b', 'references', 'rule', 'suggested'));

    session.updateEdge(id, { relation: 'contrasts' }, '编辑关系');
    expect(store.getEdge(id)?.userRenamed).toBe(true);

    session.updateEdge(id, { relation: 'references' }, '恢复原名');
    expect(store.getEdge(id)?.id).toBe(id);
    expect(store.getEdge(id)?.relation).toBe('references');
    expect(store.getEdge(id)?.userRenamed).toBeUndefined();
  });

  it('修改关系名称不重写原始 evidence', () => {
    const { store, session } = setup();
    store.addNode(node('a', 'A'));
    store.addNode(node('b', 'B'));
    session.addEdge(edge('e1', 'a', 'b', 'related-to', 'rule', 'suggested'));

    session.updateEdge('e1', { relation: 'contrasts' }, '编辑关系');

    expect(store.getEdge('e1')?.id).toBe('e1');
    expect(store.getEdge('e1')?.relation).toBe('contrasts');
    expect(store.getEdge('e1')?.evidence).toEqual(['测试证据']);
    expect(store.getEdge('e1')?.origin).toBe('rule');
    expect(store.getEdge('e1')?.status).toBe('suggested');
  });

  it('修改后的关系名称可通过序列化重新加载，ID 不变', () => {
    const { store, session } = setup();
    store.addNode(node('a', 'A'));
    store.addNode(node('b', 'B'));
    session.addEdge(edge('e1', 'a', 'b', 'references'));
    session.updateEdge('e1', { relation: 'contrasts' }, '编辑关系');

    const reloaded = new InterestSeedGraphStore(undefined, { now: () => NOW });
    reloaded.replace(JSON.parse(JSON.stringify(store.getGraph())));

    expect(reloaded.getEdge('e1')?.id).toBe('e1');
    expect(reloaded.getEdge('e1')?.relation).toBe('contrasts');
  });

  it('修改关系名称不得与同端点同 relation 的边合并或覆盖', () => {
    const { store, session } = setup();
    store.addNode(node('a', 'A'));
    store.addNode(node('b', 'B'));
    session.addEdge(edge('e1', 'a', 'b', 'references'));
    session.addEdge(edge('e2', 'a', 'b', 'contrasts'));

    expect(() =>
      session.updateEdge('e1', { relation: 'contrasts' }, '编辑关系'),
    ).toThrowError(/已存在相同关系/);
    expect(store.getEdge('e1')?.relation).toBe('references');
    expect(store.getEdge('e2')?.relation).toBe('contrasts');
  });

  it('拒绝关系支持撤销与重做', () => {
    const { store, undo, session } = setup();
    store.addNode(node('a', 'A'));
    store.addNode(node('b', 'B'));
    session.addEdge(edge('e1', 'a', 'b'));

    session.updateEdge('e1', { status: 'rejected' }, '拒绝关系');
    expect(store.getEdge('e1')?.status).toBe('rejected');

    expect(undo.undo()).toBe(true);
    expect(store.getEdge('e1')?.status).toBe('suggested');

    expect(undo.redo()).toBe(true);
    expect(store.getEdge('e1')?.status).toBe('rejected');
  });

  it('拒绝关系可以恢复为建议，保留字段并支持撤销/重做', () => {
    const { store, undo, session } = setup();
    store.addNode(node('a', 'A'));
    store.addNode(node('b', 'B'));
    session.addEdge(edge('e1', 'a', 'b', 'related-to', 'rule', 'rejected'));

    const before = store.getEdge('e1');
    session.restoreEdge('e1');
    const restored = store.getEdge('e1');

    expect(restored?.status).toBe('suggested');
    expect(restored?.id).toBe(before?.id);
    expect(restored?.source).toBe(before?.source);
    expect(restored?.target).toBe(before?.target);
    expect(restored?.relation).toBe(before?.relation);
    expect(restored?.origin).toBe(before?.origin);
    expect(restored?.confidence).toBe(before?.confidence);
    expect(restored?.evidence).toEqual(before?.evidence);
    expect(store.stats().suggested).toBe(1);
    expect(store.stats().rejected).toBe(0);

    expect(undo.undo()).toBe(true);
    expect(store.getEdge('e1')?.status).toBe('rejected');

    expect(undo.redo()).toBe(true);
    expect(store.getEdge('e1')?.status).toBe('suggested');
  });

  it('恢复只接受已拒绝且仍然存在的关系', () => {
    const { store, session } = setup();
    store.addNode(node('a', 'A'));
    store.addNode(node('b', 'B'));
    session.addEdge(edge('e1', 'a', 'b'));

    expect(() => session.restoreEdge('e1')).toThrowError(/只有已拒绝/);
    expect(() => session.restoreEdge('missing')).toThrowError(/不存在/);
    expect(store.getEdge('e1')?.status).toBe('suggested');
  });

  it('非法修改抛错且不会产生撤销记录', () => {
    const { store, undo, session } = setup();
    store.addNode(node('a', 'A'));
    const depth = undo.depth();

    expect(() => session.addEdge(edge('bad', 'a', 'ghost'))).toThrowError(/不存在/);
    expect(store.getGraph().edges).toHaveLength(0);
    expect(undo.depth()).toBe(depth);

    expect(() => session.updateNode('a', { id: 'other' })).toThrowError(/不可修改/);
    expect(undo.depth()).toBe(depth);
  });

  it('整体替换（重建 / 清空）也可以撤销', () => {
    const { store, undo, session } = setup();
    store.addNode(node('a', 'A'));
    const before = store.getGraph();

    session.replace({ ...before, nodes: [], edges: [] }, '清空图谱');
    expect(store.getGraph().nodes).toHaveLength(0);

    expect(undo.undo()).toBe(true);
    expect(store.getGraph().nodes).toHaveLength(1);
    expect(store.getNode('a')).toBeDefined();
  });
});
