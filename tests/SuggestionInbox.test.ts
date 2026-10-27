import { describe, expect, it } from 'vitest';
import { InterestSeedGraphStore } from '../src/core/GraphStore';
import type { InterestSeedEdge, InterestSeedNode, RelationStatus } from '../src/types/graph';
import { collectSuggestedEdges, type SuggestionStore } from '../src/ui/suggestionList';

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
  status: RelationStatus = 'suggested',
  relation = 'related-to',
  confidence = 0.5,
): InterestSeedEdge {
  return {
    id,
    source,
    target,
    relation,
    origin: 'rule',
    status,
    confidence,
    evidence: ['测试证据'],
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function setup(): InterestSeedGraphStore {
  const store = new InterestSeedGraphStore(undefined, { now: () => NOW });
  store.addNode(node('a', 'A'));
  store.addNode(node('b', 'B'));
  store.addNode(node('c', 'C'));
  return store;
}

describe('全局建议收件箱数据', () => {
  it('返回全图所有 suggested 关系，不受 Top 3 限制', () => {
    const store = setup();
    for (let index = 0; index < 5; index += 1) {
      store.addEdge(edge(`e${index}`, 'a', 'b', 'suggested', `rel-${index}`, index / 10));
    }

    const rows = collectSuggestedEdges(store);

    expect(rows).toHaveLength(5);
    expect(rows.every((row) => row.edge.status === 'suggested')).toBe(true);
    expect(rows.map((row) => row.edge.id).sort()).toEqual([
      'e0',
      'e1',
      'e2',
      'e3',
      'e4',
    ]);
  });

  it('排除 confirmed 和 rejected 关系', () => {
    const store = setup();
    store.addEdge(edge('s1', 'a', 'b', 'suggested'));
    store.addEdge(edge('c1', 'b', 'c', 'confirmed'));
    store.addEdge(edge('r1', 'a', 'c', 'rejected'));

    const rows = collectSuggestedEdges(store);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.edge.id).toBe('s1');
  });

  it('按 edge.id 识别关系，删除一条后不会错位处理其他关系', () => {
    const store = setup();
    store.addEdge(edge('e1', 'a', 'b'));
    store.addEdge(edge('e2', 'b', 'c'));

    const first = collectSuggestedEdges(store);
    store.removeEdge(first[0]?.edge.id ?? '');

    const remaining = collectSuggestedEdges(store);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.edge.id).toBe('e2');
  });

  it('端点缺失时仍返回行，不会使数据处理崩溃', () => {
    const fake: SuggestionStore = {
      listEdges: () => [edge('missing', 'ghost-a', 'ghost-b')],
      getNode: () => undefined,
    };

    const rows = collectSuggestedEdges(fake);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.source).toBeUndefined();
    expect(rows[0]?.target).toBeUndefined();
  });

  it('没有 suggested 关系时返回空列表', () => {
    const store = setup();
    store.addEdge(edge('c1', 'a', 'b', 'confirmed'));
    expect(collectSuggestedEdges(store)).toEqual([]);
  });
});
