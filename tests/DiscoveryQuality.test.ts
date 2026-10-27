import { describe, expect, it } from 'vitest';

import { generateDiscoveries } from '../src/discovery/DiscoveryEngine';
import { applyDiscoveryFeedback } from '../src/discovery/feedback';
import { discoveryIdFor, evidenceProfile } from '../src/discovery/identity';
import { emptyDiscoveryFile } from '../src/discovery/types';
import {
  bulkQualityFixture,
  equalTwentyQualityFixture,
  fixtureDiscoveryId,
  discoveryPairKey,
  pairKey,
  qualityFixture,
  qualityStats,
} from './discoveryQuality';

describe('Discovery quality baseline', () => {
  it('固定夹具产生 4 个预期跨目录候选，无误报/漏报', () => {
    const { graph, expectedPairs } = qualityFixture();
    const file = generateDiscoveries(graph, emptyDiscoveryFile('2026-01-01T00:00:00.000Z'));
    const stats = qualityStats(file, graph, expectedPairs);

    expect(stats.expectedCount).toBe(4);
    expect(stats.actualCount).toBe(4);
    expect(stats.falsePositives).toEqual([]);
    expect(stats.falseNegatives).toEqual([]);
    expect(stats.missingEvidence).toEqual([]);
    expect(stats.untraceableEvidence).toEqual([]);
    expect(stats.samePairDifferentIds).toEqual([]);
  });

  it('无共享标签、无确认关系、无来源、直接确认、仅 suggested 的节点不进入候选', () => {
    const { graph, expectedPairs } = qualityFixture();
    const file = generateDiscoveries(graph, emptyDiscoveryFile('2026-01-01T00:00:00.000Z'));
    const actual = new Set(file.discoveries.map(discoveryPairKey));

    expect(actual).toEqual(new Set(expectedPairs));
    expect(actual.has(pairKey('no-tag1', 'no-tag2'))).toBe(false);
    expect(actual.has(pairKey('no-confirmed1', 'no-confirmed2'))).toBe(false);
    expect(actual.has(pairKey('direct1', 'direct2'))).toBe(false);
    expect(actual.has(pairKey('sugg1', 'sugg2'))).toBe(false);
    expect(file.discoveries.some((item) => item.nodeIds.includes('no-source'))).toBe(false);
  });

  it('跨目录项保留推定项目键，不把目录写成已确认项目实体', () => {
    const { graph } = qualityFixture();
    const file = generateDiscoveries(graph, emptyDiscoveryFile('2026-01-01T00:00:00.000Z'));

    for (const discovery of file.discoveries) {
      expect(discovery.projectKeys).toEqual(['P1', 'P2']);
      expect(discovery.subjectKeys).toEqual(['shared', 'topic2']);
      expect(discovery.title).toContain('#shared');
    }
  });

  it('证据可追溯到固定夹具中的来源、标签和确认关系', () => {
    const { graph } = qualityFixture();
    const file = generateDiscoveries(graph, emptyDiscoveryFile('2026-01-01T00:00:00.000Z'));
    const nodes = new Map(graph.nodes.map((node) => [node.id, node]));

    for (const discovery of file.discoveries) {
      const sources = discovery.evidence.filter((item) => item.kind === 'source');
      const shared = discovery.evidence.filter((item) => item.kind === 'shared-tag');
      const confirmed = discovery.evidence.filter(
        (item) => item.kind === 'confirmed-edge',
      );

      expect(sources).toHaveLength(2);
      for (const source of sources) {
        expect(source.sourceUri).toBe(nodes.get(source.nodeId)?.sourceUri);
        expect(source.text).toContain(source.sourceUri ?? '');
      }
      expect(shared.some((item) => item.text.includes('#shared'))).toBe(true);
      for (const nodeId of discovery.nodeIds) {
        expect(
          confirmed.some((item) => item.nodeId === nodeId && item.text.startsWith('已确认关系：')),
        ).toBe(true);
      }
      expect(discovery.evidence.some((item) => item.text.includes('node_'))).toBe(false);
    }
  });

  it('同主题 4 个节点对记录为 1 个重复主题组、4 个节点对', () => {
    const { graph, expectedPairs } = qualityFixture();
    const file = generateDiscoveries(graph, emptyDiscoveryFile('2026-01-01T00:00:00.000Z'));
    const stats = qualityStats(file, graph, expectedPairs);

    expect(stats.duplicateThemeGroups).toBe(1);
    expect(stats.duplicateThemeNodePairs).toBe(4);
    expect(stats.actualCount).toBe(4);
  });

  it('重复扫描保持候选 ID 与节点对稳定，不产生重复', () => {
    const { graph, expectedPairs } = qualityFixture();
    const first = generateDiscoveries(graph, emptyDiscoveryFile('2026-01-01T00:00:00.000Z'));
    const second = generateDiscoveries(graph, first);

    const firstIds = new Map(
      first.discoveries.map((item) => [discoveryPairKey(item), item.id]),
    );
    const secondIds = new Map(
      second.discoveries.map((item) => [discoveryPairKey(item), item.id]),
    );
    expect(secondIds).toEqual(firstIds);
    expect(second.discoveries).toHaveLength(first.discoveries.length);
    expect(qualityStats(second, graph, expectedPairs).samePairDifferentIds).toEqual([]);
  });

  it('刷新后接受、拒绝、待验证反馈全部保留', () => {
    const { graph } = qualityFixture();
    const first = generateDiscoveries(graph, emptyDiscoveryFile('2026-01-01T00:00:00.000Z'));
    const ids = first.discoveries.map((item) => item.id);
    expect(ids).toHaveLength(4);

    let file = applyDiscoveryFeedback(first, ids[0]!, 'accepted', '2026-01-02T00:00:00.000Z');
    file = applyDiscoveryFeedback(file, ids[1]!, 'rejected', '2026-01-02T00:00:00.000Z');
    file = applyDiscoveryFeedback(file, ids[2]!, 'needs-verification', '2026-01-02T00:00:00.000Z');

    const refreshed = generateDiscoveries(graph, file);
    const statuses = new Map(
      refreshed.discoveries.map((item) => [item.id, [item.feedbackStatus, item.status]]),
    );

    expect(statuses.get(ids[0]!)).toEqual(['accepted', 'active']);
    expect(statuses.get(ids[1]!)).toEqual(['rejected', 'dismissed']);
    expect(statuses.get(ids[2]!)).toEqual(['needs-verification', 'active']);
    expect(statuses.get(ids[3]!)).toEqual(['none', 'active']);
  });

  it('超过 20 个候选时截断为 20，重复扫描保持相同 ID 集合', () => {
    const { graph, expectedPairs } = bulkQualityFixture();
    const first = generateDiscoveries(graph, emptyDiscoveryFile('2026-01-01T00:00:00.000Z'));
    const second = generateDiscoveries(graph, first);

    expect(expectedPairs).toHaveLength(36);
    expect(first.discoveries).toHaveLength(20);
    expect(second.discoveries).toHaveLength(20);
    expect(second.discoveries.map((item) => item.id)).toEqual(
      first.discoveries.map((item) => item.id),
    );
    expect(new Set(first.discoveries.map(discoveryPairKey)).size).toBe(20);
  });

  it('输入节点顺序变化后，稳定 ID 排序保留相同候选集合', () => {
    const { graph } = bulkQualityFixture();
    const reversed = { ...graph, nodes: [...graph.nodes].reverse() };
    const originalFile = generateDiscoveries(
      graph,
      emptyDiscoveryFile('2026-01-01T00:00:00.000Z'),
    );
    const reversedFile = generateDiscoveries(
      reversed,
      emptyDiscoveryFile('2026-01-01T00:00:00.000Z'),
    );

    expect(originalFile.discoveries).toHaveLength(20);
    expect(reversedFile.discoveries).toHaveLength(20);
    expect(new Set(reversedFile.discoveries.map(discoveryPairKey))).toEqual(
      new Set(originalFile.discoveries.map(discoveryPairKey)),
    );
    expect(reversedFile.discoveries.map((item) => item.id)).toEqual(
      originalFile.discoveries.map((item) => item.id),
    );
  });

  it('任意重排 graph.nodes 后保留集合仍一致', () => {
    const { graph } = bulkQualityFixture();
    const permutation = [
      ...graph.nodes.filter((_, index) => index % 2 === 1),
      ...graph.nodes.filter((_, index) => index % 2 === 0),
    ];
    const originalFile = generateDiscoveries(
      graph,
      emptyDiscoveryFile('2026-01-01T00:00:00.000Z'),
    );
    const permutedFile = generateDiscoveries(
      { ...graph, nodes: permutation },
      emptyDiscoveryFile('2026-01-01T00:00:00.000Z'),
    );

    expect(new Set(permutedFile.discoveries.map(discoveryPairKey))).toEqual(
      new Set(originalFile.discoveries.map(discoveryPairKey)),
    );
  });

  it('等于 20 个候选时全部保留，低于 20 保持原数量', () => {
    const equal = equalTwentyQualityFixture();
    const equalFile = generateDiscoveries(
      equal.graph,
      emptyDiscoveryFile('2026-01-01T00:00:00.000Z'),
    );
    const below = qualityFixture();
    const belowFile = generateDiscoveries(
      below.graph,
      emptyDiscoveryFile('2026-01-01T00:00:00.000Z'),
    );

    expect(equal.expectedPairs).toHaveLength(20);
    expect(equalFile.discoveries).toHaveLength(20);
    expect(belowFile.discoveries).toHaveLength(4);
  });

  it('方案 A/B 对输入顺序稳定，方案 C 当前先到先得顺序敏感', () => {
    const { expectedPairs } = bulkQualityFixture();
    const ids = new Map(
      expectedPairs.map((key) => [key, fixtureDiscoveryId(...(key.split('\u0000') as [string, string]))]),
    );
    const select = (
      items: string[],
      compare: (left: string, right: string) => number,
    ) => [...items].sort(compare).slice(0, 20);

    const originalA = select(expectedPairs, (left, right) =>
      (ids.get(left) ?? '').localeCompare(ids.get(right) ?? ''),
    );
    const reversedA = select([...expectedPairs].reverse(), (left, right) =>
      (ids.get(left) ?? '').localeCompare(ids.get(right) ?? ''),
    );
    const originalB = select(expectedPairs, (left, right) =>
      left.localeCompare(right),
    );
    const reversedB = select([...expectedPairs].reverse(), (left, right) =>
      left.localeCompare(right),
    );
    const originalC = expectedPairs.slice(0, 20);
    const reversedC = [...expectedPairs].reverse().slice(0, 20);

    expect(new Set(originalA)).toEqual(new Set(reversedA));
    expect(new Set(originalB)).toEqual(new Set(reversedB));
    expect(new Set(originalC)).not.toEqual(new Set(reversedC));
    expect(new Set(originalA).size).toBe(20);
    expect(new Set(originalB).size).toBe(20);
  });

  it('20 条上限内的候选 ID 与 fixture 公式一致', () => {
    const { graph } = bulkQualityFixture();
    const file = generateDiscoveries(graph, emptyDiscoveryFile('2026-01-01T00:00:00.000Z'));
    const first = file.discoveries[0]!;
    expect(first.id).toBe(
      discoveryIdFor(
        first.dedupeKey,
        evidenceProfile(first.evidence),
        first.ruleVersion,
      ),
    );
  });

  it('被截断或旧身份候选若已存在于 previous，会保留且不产生重复身份', () => {
    const { graph, expectedPairs } = bulkQualityFixture();
    const idByPair = new Map(
      expectedPairs.map((key) => [
        key,
        fixtureDiscoveryId(...(key.split('\u0000') as [string, string])),
      ]),
    );
    const selectedIds = new Set(
      [...idByPair.values()].sort().slice(0, 20),
    );
    const missingPair = expectedPairs.find((key) => !selectedIds.has(idByPair.get(key)!));
    if (!missingPair) throw new Error('测试夹具没有截断候选');
    const previous = emptyDiscoveryFile('2026-01-01T00:00:00.000Z');
    const previousId = idByPair.get(missingPair)!;
    const [left, right] = missingPair.split('\u0000');
    previous.discoveries.push({
      id: previousId,
      kind: 'cross-project-topic',
      title: 'previous truncated',
      description: '',
      nodeIds: [left!, right!],
      projectKeys: ['P1', 'P2'],
      subjectKeys: ['bulk'],
      evidence: [],
      ruleVersion: 'test',
      strength: 'moderate',
      dedupeKey: previousId,
      status: 'active',
      feedbackStatus: 'none',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    const file = generateDiscoveries(graph, previous);
    expect(file.discoveries.some((item) => item.id === previousId)).toBe(true);
    expect(new Set(file.discoveries.map((item) => item.id)).size).toBe(
      file.discoveries.length,
    );
    expect(file.discoveries.length).toBeGreaterThanOrEqual(20);
  });
});
