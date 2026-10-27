import { describe, expect, it } from 'vitest';

import { generateDiscoveries, DiscoveryEngine } from '../src/discovery/DiscoveryEngine';
import { applyDiscoveryFeedback } from '../src/discovery/feedback';
import { emptyDiscoveryFile } from '../src/discovery/types';
import { emptyGraph } from '../src/types/graph';
import type { InterestSeedEdge, InterestSeedGraph, InterestSeedNode } from '../src/types/graph';

const NOW = '2026-01-01T00:00:00.000Z';

function node(
  id: string,
  path: string,
  tags: string[],
  sourceUri = `vault:${path}`,
): InterestSeedNode {
  return {
    id,
    type: 'document',
    title: id,
    sourceUri,
    tags,
    createdAt: NOW,
    updatedAt: NOW,
    metadata: { path },
  };
}

function edge(
  id: string,
  source: string,
  target: string,
  status: 'confirmed' | 'suggested' = 'confirmed',
  relation = 'related-to',
): InterestSeedEdge {
  return {
    id,
    source,
    target,
    relation,
    origin: 'rule',
    status,
    confidence: 0.6,
    evidence: [`${source} 与 ${target} 的关系证据`],
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function graph(nodes: InterestSeedNode[], edges: InterestSeedEdge[]): InterestSeedGraph {
  const base = emptyGraph(NOW);
  return { ...base, nodes, edges };
}

describe('DiscoveryEngine 跨目录共同主题', () => {
  it('两个推定目录有共同标签和确认关系证据时产生发现', () => {
    const g = graph(
      [
        node('a', 'P1/a.md', ['无人机']),
        node('b', 'P1/b.md', ['无人机']),
        node('c', 'P2/c.md', ['无人机']),
        node('d', 'P2/d.md', ['无人机']),
      ],
      [edge('e-ab', 'a', 'b'), edge('e-cd', 'c', 'd')],
    );

    const file = generateDiscoveries(g, emptyDiscoveryFile(NOW), () => NOW);
    const discoveries = file.discoveries.filter(
      (item) => item.kind === 'cross-project-topic',
    );

    expect(discoveries.length).toBeGreaterThan(0);
    expect(discoveries[0]?.projectKeys).toEqual(['P1', 'P2']);
    expect(discoveries[0]?.subjectKeys).toEqual(['无人机']);
    expect(
      discoveries[0]?.evidence.some((item) => item.kind === 'confirmed-edge'),
    ).toBe(true);
  });

  it('证据文本使用节点标题而不是内部 id', () => {
    const a = node('a', 'P1/a.md', ['无人机']);
    const b = node('b', 'P1/b.md', ['无人机']);
    const c = node('c', 'P2/c.md', ['无人机']);
    const d = node('d', 'P2/d.md', ['无人机']);
    a.title = 'Alpha';
    b.title = 'Beta';
    c.title = 'Gamma';
    d.title = 'Delta';
    const g = graph([a, b, c, d], [edge('e-ab', 'a', 'b'), edge('e-cd', 'c', 'd')]);

    const file = generateDiscoveries(g, emptyDiscoveryFile(NOW), () => NOW);
    const evidence = file.discoveries[0]?.evidence ?? [];
    const confirmed = evidence.filter((item) => item.kind === 'confirmed-edge');

    expect(confirmed.some((item) => item.text.includes('Alpha') || item.text.includes('Beta'))).toBe(true);
    expect(confirmed.some((item) => item.text.includes('node_'))).toBe(false);
  });

  it('只有共享标签没有确认关系证据时不产生发现', () => {
    const g = graph(
      [node('a', 'P1/a.md', ['无人机']), node('c', 'P2/c.md', ['无人机'])],
      [],
    );

    const file = generateDiscoveries(g, emptyDiscoveryFile(NOW), () => NOW);
    expect(file.discoveries).toHaveLength(0);
  });

  it('只有跨目录没有共同主题时不产生发现', () => {
    const g = graph(
      [node('a', 'P1/a.md', ['甲']), node('c', 'P2/c.md', ['乙'])],
      [edge('e1', 'a', 'c')],
    );

    const file = generateDiscoveries(g, emptyDiscoveryFile(NOW), () => NOW);
    expect(file.discoveries).toHaveLength(0);
  });

  it('suggested 关系不能作为确认级证据', () => {
    const g = graph(
      [
        node('a', 'P1/a.md', ['无人机']),
        node('b', 'P1/b.md', ['无人机']),
        node('c', 'P2/c.md', ['无人机']),
      ],
      [edge('e1', 'a', 'b', 'suggested')],
    );

    const file = generateDiscoveries(g, emptyDiscoveryFile(NOW), () => NOW);
    expect(file.discoveries).toHaveLength(0);
  });

  it('节点来源不可定位时不产生发现', () => {
    const g = graph(
      [
        node('a', 'P1/a.md', ['无人机'], undefined),
        node('c', 'P2/c.md', ['无人机']),
      ],
      [edge('e1', 'a', 'c')],
    );

    const file = generateDiscoveries(g, emptyDiscoveryFile(NOW), () => NOW);
    expect(file.discoveries).toHaveLength(0);
  });

  it('重复扫描保持稳定 ID 且不新增重复发现', () => {
    const g = graph(
      [
        node('a', 'P1/a.md', ['无人机']),
        node('b', 'P1/b.md', ['无人机']),
        node('c', 'P2/c.md', ['无人机']),
        node('d', 'P2/d.md', ['无人机']),
      ],
      [edge('e-ab', 'a', 'b'), edge('e-cd', 'c', 'd')],
    );

    const first = generateDiscoveries(g, emptyDiscoveryFile(NOW), () => NOW);
    const second = generateDiscoveries(g, first, () => NOW);
    expect(second.discoveries.length).toBe(first.discoveries.length);
    expect(second.discoveries.map((item) => item.id).sort()).toEqual(
      first.discoveries.map((item) => item.id).sort(),
    );
  });

  it('不同节点对象的实质不同发现不会被错误合并', () => {
    const g = graph(
      [
        node('a', 'P1/a.md', ['无人机']),
        node('c', 'P2/c.md', ['无人机']),
        node('d', 'P2/d.md', ['无人机']),
      ],
      [edge('e1', 'a', 'c'), edge('e2', 'a', 'd')],
    );

    const file = generateDiscoveries(g, emptyDiscoveryFile(NOW), () => NOW);
    const ids = new Set(file.discoveries.map((item) => item.id));
    expect(ids.size).toBe(file.discoveries.length);
  });

  it('重复扫描不清除拒绝反馈', () => {
    const g = graph(
      [
        node('a', 'P1/a.md', ['无人机']),
        node('b', 'P1/b.md', ['无人机']),
        node('c', 'P2/c.md', ['无人机']),
        node('d', 'P2/d.md', ['无人机']),
      ],
      [edge('e-ab', 'a', 'b'), edge('e-cd', 'c', 'd')],
    );

    const first = generateDiscoveries(g, emptyDiscoveryFile(NOW), () => NOW);
    const target = first.discoveries[0];
    if (!target) throw new Error('缺少发现');

    const rejected = applyDiscoveryFeedback(first, target.id, 'rejected', NOW);
    const second = generateDiscoveries(g, rejected, () => NOW);
    const preserved = second.discoveries.find((item) => item.id === target.id);
    expect(preserved?.status).toBe('dismissed');
    expect(preserved?.feedbackStatus).toBe('rejected');
    expect(second.discoveries.filter((item) => item.status === 'active').length).toBeGreaterThan(0);
  });

  it('拒绝后只抑制相同 suppressionKey，不抑制不同证据画像', () => {
    const g = graph(
      [
        node('a', 'P1/a.md', ['无人机']),
        node('b', 'P1/b.md', ['无人机']),
        node('c', 'P2/c.md', ['无人机']),
        node('d', 'P2/d.md', ['无人机']),
      ],
      [edge('e-ab', 'a', 'b'), edge('e-cd', 'c', 'd')],
    );
    const first = generateDiscoveries(g, emptyDiscoveryFile(NOW), () => NOW);
    const target = first.discoveries[0];
    if (!target) throw new Error('缺少发现');
    const rejected = applyDiscoveryFeedback(first, target.id, 'rejected', NOW);

    const second = new DiscoveryEngine(() => NOW, 'cross-project-topic-v2').generate(
      g,
      rejected,
    );
    expect(second.discoveries.some((item) => item.id === target.id)).toBe(true);
    expect(second.discoveries.find((item) => item.id === target.id)?.status).toBe(
      'dismissed',
    );
    expect(
      second.discoveries.some(
        (item) =>
          item.id !== target.id && item.suppressionKey === target.suppressionKey,
      ),
    ).toBe(false);
    expect(second.discoveries.some((item) => item.status === 'active')).toBe(true);
  });

  it('拒绝只按 suppressionKey 生效，不按身份槽无限期屏蔽', () => {
    const g = graph(
      [
        node('a', 'P1/a.md', ['无人机']),
        node('b', 'P1/b.md', ['无人机']),
        node('c', 'P2/c.md', ['无人机']),
        node('d', 'P2/d.md', ['无人机']),
      ],
      [edge('e-ab', 'a', 'b'), edge('e-cd', 'c', 'd')],
    );
    const first = generateDiscoveries(g, emptyDiscoveryFile(NOW), () => NOW);
    const target = first.discoveries[0];
    if (!target) throw new Error('缺少发现');
    const rejected = {
      ...target,
      status: 'dismissed' as const,
      feedbackStatus: 'rejected' as const,
      suppressionKey: 'different-suppression-key',
    };
    const previous = { ...first, discoveries: [rejected] };
    const second = new DiscoveryEngine(
      () => NOW,
      'cross-project-topic-v2',
    ).generate(g, previous);

    expect(second.discoveries.find((item) => item.id === target.id)?.status).toBe(
      'dismissed',
    );
    expect(
      second.discoveries.some(
        (item) =>
          item.id !== target.id &&
          item.status === 'active' &&
          item.nodeIds.every((id) => target.nodeIds.includes(id)),
      ),
    ).toBe(true);
  });

  it('同一身份槽的历史重复 active 记录收敛为一条', () => {
    const g = graph(
      [
        node('a', 'P1/a.md', ['无人机']),
        node('b', 'P1/b.md', ['无人机']),
        node('c', 'P2/c.md', ['无人机']),
        node('d', 'P2/d.md', ['无人机']),
      ],
      [edge('e-ab', 'a', 'b'), edge('e-cd', 'c', 'd')],
    );
    const first = generateDiscoveries(g, emptyDiscoveryFile(NOW), () => NOW);
    const target = first.discoveries[0];
    if (!target) throw new Error('缺少发现');
    const duplicate = { ...target, id: 'discovery_duplicate', createdAt: NOW };
    target.feedbackStatus = 'accepted';
    const previous = {
      ...first,
      discoveries: [target, duplicate],
    };
    const second = generateDiscoveries(g, previous, () => NOW);
    const samePair = second.discoveries.filter(
      (item) =>
        item.nodeIds.length === target.nodeIds.length &&
        item.nodeIds.every((id) => target.nodeIds.includes(id)),
    );
    expect(samePair.filter((item) => item.status === 'active')).toHaveLength(1);
    expect(samePair.some((item) => item.status === 'dismissed')).toBe(true);
    expect(
      samePair.find((item) => item.status === 'dismissed')?.supersededBy,
    ).toBe(target.id);
    expect(
      samePair.find((item) => item.status === 'active')?.feedbackStatus,
    ).toBe('accepted');
  });

  it('同槽重复收敛时刷新写入 canonical 记录，而非被降级记录', () => {
    const g = graph(
      [
        node('a', 'P1/a.md', ['无人机']),
        node('b', 'P1/b.md', ['无人机']),
        node('c', 'P2/c.md', ['无人机']),
        node('d', 'P2/d.md', ['无人机']),
      ],
      [edge('e-ab', 'a', 'b'), edge('e-cd', 'c', 'd')],
    );
    const first = generateDiscoveries(g, emptyDiscoveryFile(NOW), () => NOW);
    const canonicalCandidate = first.discoveries[0];
    if (!canonicalCandidate) throw new Error('缺少发现');
    const legacy = {
      ...canonicalCandidate,
      id: 'discovery_legacy_canonical',
      identityVersion: 1,
      dedupeKey: canonicalCandidate.id,
      feedbackStatus: 'accepted' as const,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const duplicate = {
      ...canonicalCandidate,
      feedbackStatus: 'none' as const,
      createdAt: '2026-01-02T00:00:00.000Z',
    };
    const previous = { ...first, discoveries: [legacy, duplicate] };
    const second = new DiscoveryEngine(
      () => NOW,
      'cross-project-topic-v2',
    ).generate(g, previous);
    const canonical = second.discoveries.find(
      (item) => item.id === 'discovery_legacy_canonical',
    );
    const hidden = second.discoveries.find(
      (item) => item.id === canonicalCandidate.id,
    );

    expect(canonical?.status).toBe('active');
    expect(canonical?.identityVersion).toBe(2);
    expect(canonical?.feedbackStatus).toBe('accepted');
    expect(canonical?.ruleVersion).toBe('cross-project-topic-v2');
    expect(hidden?.status).toBe('dismissed');
  });

  it('规则版本/身份升级时按身份槽承接旧记录，不产生重复 active', () => {
    const g = graph(
      [
        node('a', 'P1/a.md', ['无人机']),
        node('b', 'P1/b.md', ['无人机']),
        node('c', 'P2/c.md', ['无人机']),
        node('d', 'P2/d.md', ['无人机']),
      ],
      [edge('e-ab', 'a', 'b'), edge('e-cd', 'c', 'd')],
    );
    const first = generateDiscoveries(g, emptyDiscoveryFile(NOW), () => NOW);
    const target = first.discoveries[0];
    if (!target) throw new Error('缺少发现');
    const legacy = {
      ...target,
      id: 'discovery_legacy_id',
      identityVersion: 1,
      dedupeKey: target.id,
      feedbackStatus: 'accepted' as const,
      application: {
        state: 'applied' as const,
        edgeId: 'edge_existing',
        sourceNodeId: target.nodeIds[0],
        targetNodeId: target.nodeIds[1],
        relation: 'related-to',
        appliedAt: NOW,
        updatedAt: NOW,
      },
    };
    const previous = { ...first, discoveries: [legacy] };
    const second = new DiscoveryEngine(
      () => NOW,
      'cross-project-topic-v2',
    ).generate(g, previous);
    const samePair = second.discoveries.filter(
      (item) =>
        item.nodeIds.length === target.nodeIds.length &&
        item.nodeIds.every((id) => target.nodeIds.includes(id)),
    );

    expect(samePair).toHaveLength(1);
    expect(samePair[0]?.id).toBe('discovery_legacy_id');
    expect(samePair[0]?.identityVersion).toBe(2);
    expect(samePair[0]?.feedbackStatus).toBe('accepted');
    expect(samePair[0]?.application?.state).toBe('applied');
    expect(samePair[0]?.application?.edgeId).toBe('edge_existing');
  });

  it('重复扫描保留发现应用状态', () => {
    const g = graph(
      [
        node('a', 'P1/a.md', ['无人机']),
        node('b', 'P1/b.md', ['无人机']),
        node('c', 'P2/c.md', ['无人机']),
        node('d', 'P2/d.md', ['无人机']),
      ],
      [edge('e-ab', 'a', 'b'), edge('e-cd', 'c', 'd')],
    );
    const first = generateDiscoveries(g, emptyDiscoveryFile(NOW), () => NOW);
    const target = first.discoveries[0];
    if (!target) throw new Error('缺少发现');
    target.application = {
      state: 'applied',
      edgeId: 'edge_stable',
      sourceNodeId: 'a',
      targetNodeId: 'c',
      relation: 'related-to',
      appliedAt: NOW,
      updatedAt: NOW,
    };

    const second = generateDiscoveries(g, first, () => NOW);
    const preserved = second.discoveries.find((item) => item.id === target.id);
    expect(preserved?.application?.state).toBe('applied');
    expect(preserved?.application?.edgeId).toBe('edge_stable');
  });

  it('两节点之间已有 confirmed 关系时不产生发现', () => {
    const g = graph(
      [node('a', 'P1/a.md', ['无人机']), node('c', 'P2/c.md', ['无人机'])],
      [edge('direct', 'a', 'c', 'confirmed')],
    );

    const file = generateDiscoveries(g, emptyDiscoveryFile(NOW), () => NOW);
    expect(file.discoveries).toHaveLength(0);
  });

  it('反馈只影响展示排序，不改变持久化顺序', () => {
    const g = graph(
      [
        node('a', 'P1/a.md', ['无人机']),
        node('b', 'P1/b.md', ['无人机']),
        node('c', 'P2/c.md', ['无人机']),
        node('d', 'P2/d.md', ['无人机']),
      ],
      [edge('e-ab', 'a', 'b'), edge('e-cd', 'c', 'd')],
    );
    const first = generateDiscoveries(g, emptyDiscoveryFile(NOW), () => NOW);
    const target = first.discoveries[0];
    if (!target) throw new Error('缺少发现');
    const orderBefore = first.discoveries.map((item) => item.id);
    const accepted = applyDiscoveryFeedback(first, target.id, 'accepted', NOW);
    const second = generateDiscoveries(g, accepted, () => NOW);

    expect(second.discoveries.map((item) => item.id)).toEqual(orderBefore);
    expect(second.discoveries.find((item) => item.id === target.id)?.feedbackStatus).toBe(
      'accepted',
    );
  });

  it('接受/拒绝/待验证只改变发现文件，不修改图谱', () => {    const g = graph(
      [
        node('a', 'P1/a.md', ['无人机']),
        node('b', 'P1/b.md', ['无人机']),
        node('c', 'P2/c.md', ['无人机']),
        node('d', 'P2/d.md', ['无人机']),
      ],
      [edge('e-ab', 'a', 'b'), edge('e-cd', 'c', 'd')],
    );
    const before = JSON.stringify(g);
    const file = generateDiscoveries(g, emptyDiscoveryFile(NOW), () => NOW);
    const target = file.discoveries[0];
    if (!target) throw new Error('缺少发现');

    const accepted = applyDiscoveryFeedback(file, target.id, 'accepted', NOW);
    const rejected = applyDiscoveryFeedback(file, target.id, 'rejected', NOW);
    const needs = applyDiscoveryFeedback(file, target.id, 'needs-verification', NOW);

    expect(accepted.discoveries.find((item) => item.id === target.id)?.feedbackStatus).toBe('accepted');
    expect(rejected.discoveries.find((item) => item.id === target.id)?.feedbackStatus).toBe('rejected');
    expect(needs.discoveries.find((item) => item.id === target.id)?.feedbackStatus).toBe('needs-verification');
    expect(JSON.stringify(g)).toBe(before);
  });
});
