import { describe, expect, it } from 'vitest';

import { generateDiscoveries } from '../src/discovery/DiscoveryEngine';
import { applyDiscoveryFeedback } from '../src/discovery/feedback';
import { emptyDiscoveryFile } from '../src/discovery/types';
import {
  activeThemePeerCounts,
  discoveryDisplayMetrics,
  discoveryThemeKey,
  groupDiscoveriesByTheme,
  isValidSourceUri,
} from '../src/ui/discoveryPresentation';
import { qualityFixture } from './discoveryQuality';
import { eightThemeFixture } from './discoveryQuality';

const NOW = '2026-01-01T00:00:00.000Z';

describe('Discovery presentation metrics', () => {
  it('同主题候选保留为多个独立卡片，不合并身份', () => {
    const { graph } = qualityFixture();
    const file = generateDiscoveries(graph, emptyDiscoveryFile(NOW));
    const groups = groupDiscoveriesByTheme(file.discoveries);

    expect(file.discoveries).toHaveLength(4);
    expect(groups.size).toBe(1);
    const group = [...groups.values()][0]!;
    expect(group).toHaveLength(4);
    expect(new Set(group.map((item) => item.id)).size).toBe(4);
    expect(new Set(group.map(discoveryThemeKey)).size).toBe(1);
  });

  it('展示指标与实际证据计数一致', () => {
    const { graph } = qualityFixture();
    const file = generateDiscoveries(graph, emptyDiscoveryFile(NOW));
    const metrics = discoveryDisplayMetrics(file.discoveries[0]!);

    expect(metrics.nodeCount).toBe(2);
    expect(metrics.evidenceCount).toBe(5);
    expect(metrics.sourceEvidenceCount).toBe(2);
    expect(metrics.sharedTagEvidenceCount).toBe(1);
    expect(metrics.confirmedEvidenceCount).toBe(2);
    expect(metrics.sourceComplete).toBe(true);
    expect(metrics.traceableEvidenceCount).toBe(5);
  });

  it('分组不改变反馈归属和单条发现状态', () => {
    const { graph } = qualityFixture();
    const first = generateDiscoveries(graph, emptyDiscoveryFile(NOW));
    const target = first.discoveries[0]!;
    const accepted = applyDiscoveryFeedback(first, target.id, 'accepted', NOW);
    const groups = groupDiscoveriesByTheme(accepted.discoveries);
    const values = [...groups.values()][0]!;

    expect(values.find((item) => item.id === target.id)?.feedbackStatus).toBe(
      'accepted',
    );
    expect(values.filter((item) => item.feedbackStatus === 'accepted')).toHaveLength(1);
  });

  it('空主题分组不会合成新发现', () => {
    const { graph } = qualityFixture();
    const file = generateDiscoveries(graph, emptyDiscoveryFile(NOW));
    const groups = groupDiscoveriesByTheme([]);

    expect(groups.size).toBe(0);
    expect(file.discoveries).toHaveLength(4);
  });

  it('同主题活动计数只统计 active，不把 dismissed 算入', () => {
    const { graph } = qualityFixture();
    const first = generateDiscoveries(graph, emptyDiscoveryFile(NOW));
    const items = first.discoveries.map((item, index) => ({
      ...item,
      status: index === 0 ? ('active' as const) : ('dismissed' as const),
      feedbackStatus:
        index === 0
          ? ('accepted' as const)
          : index === 1
            ? ('rejected' as const)
            : ('needs-verification' as const),
    }));
    const counts = activeThemePeerCounts(items);

    expect(counts.get(discoveryThemeKey(items[0]!))).toBe(1);
    expect([...counts.values()]).toEqual([1]);
  });

  it('feedback 和 application 状态不改变活动候选计数', () => {
    const { graph } = qualityFixture();
    const first = generateDiscoveries(graph, emptyDiscoveryFile(NOW));
    const items = first.discoveries.map((item, index) => ({
      ...item,
      feedbackStatus:
        index === 0
          ? ('accepted' as const)
          : index === 1
            ? ('rejected' as const)
            : ('needs-verification' as const),
      application:
        index === 0
          ? { state: 'applied' as const, edgeId: 'edge-1' }
          : index === 1
            ? { state: 'stale' as const, edgeId: 'edge-2' }
            : { state: 'none' as const },
    }));
    const counts = activeThemePeerCounts(items);

    expect([...counts.values()]).toEqual([4]);
  });

  it('全部 dismissed 时同主题活动计数为空', () => {
    const { graph } = qualityFixture();
    const first = generateDiscoveries(graph, emptyDiscoveryFile(NOW));
    const items = first.discoveries.map((item) => ({
      ...item,
      status: 'dismissed' as const,
    }));

    expect(activeThemePeerCounts(items).size).toBe(0);
  });

  it('sourceComplete 要求每个节点都有带有效 sourceUri 的 source 证据', () => {
    const { graph } = qualityFixture();
    const base = generateDiscoveries(graph, emptyDiscoveryFile(NOW)).discoveries[0]!;
    const withSources = (sources: typeof base.evidence) => ({
      ...base,
      evidence: [...sources, ...base.evidence.filter((item) => item.kind !== 'source')],
    });
    const validSources = base.evidence.filter((item) => item.kind === 'source');
    const sourceNodeId = validSources[0]?.nodeId;
    if (!sourceNodeId) throw new Error('fixture 缺少 source 证据');

    expect(discoveryDisplayMetrics(base).sourceComplete).toBe(true);
    expect(
      discoveryDisplayMetrics(withSources(validSources)).sourceComplete,
    ).toBe(true);
    expect(
      discoveryDisplayMetrics(
        withSources(validSources.filter((item) => item.nodeId !== sourceNodeId)),
      ).sourceComplete,
    ).toBe(false);
    expect(
      discoveryDisplayMetrics(
        withSources(
          validSources.map((item) =>
            item.nodeId === sourceNodeId ? { ...item, sourceUri: undefined } : item,
          ),
        ),
      ).sourceComplete,
    ).toBe(false);
    expect(
      discoveryDisplayMetrics(
        withSources(
          validSources.map((item) =>
            item.nodeId === sourceNodeId ? { ...item, sourceUri: '' } : item,
          ),
        ),
      ).sourceComplete,
    ).toBe(false);
    expect(
      discoveryDisplayMetrics(
        withSources(
          validSources.map((item) =>
            item.nodeId === sourceNodeId
              ? { ...item, sourceUri: 'https://example.com/a' }
              : item,
          ),
        ),
      ).sourceComplete,
    ).toBe(false);
    expect(isValidSourceUri('vault:P1/a.md')).toBe(true);
    expect(isValidSourceUri('P1/a.md')).toBe(true);
    expect(isValidSourceUri('')).toBe(false);
    expect(isValidSourceUri(undefined)).toBe(false);
    expect(isValidSourceUri('vault:')).toBe(false);
    expect(isValidSourceUri('https://example.com/a')).toBe(false);
  });

  it('多条 source 证据中只要每个节点有一条有效来源，仍判定完整', () => {
    const { graph } = qualityFixture();
    const base = generateDiscoveries(graph, emptyDiscoveryFile(NOW)).discoveries[0]!;
    const sources = base.evidence.filter((item) => item.kind === 'source');
    const withExtra = {
      ...base,
      evidence: [
        ...base.evidence,
        {
          kind: 'source' as const,
          nodeId: 'a1',
          sourceUri: undefined,
          text: '来源：',
        },
        ...sources,
      ],
    };

    expect(discoveryDisplayMetrics(withExtra).sourceComplete).toBe(true);
  });

  it('结构可追溯不因测试图谱关系删除而改变', () => {
    const { graph } = qualityFixture();
    const base = generateDiscoveries(graph, emptyDiscoveryFile(NOW)).discoveries[0]!;
    const before = discoveryDisplayMetrics(base);
    graph.edges = graph.edges.filter((edge) => edge.id !== 'e-a1-a2');
    const after = discoveryDisplayMetrics(base);

    expect(after.confirmedEvidenceCount).toBe(before.confirmedEvidenceCount);
    expect(after.traceableEvidenceCount).toBe(before.traceableEvidenceCount);
  });

  it('active 状态下应用状态组合不改变活动候选计数', () => {
    const { graph } = qualityFixture();
    const base = generateDiscoveries(graph, emptyDiscoveryFile(NOW)).discoveries[0]!;
    const states = [
      'none',
      'applying',
      'applied',
      'existing',
      'failed',
      'stale',
      'recovery-required',
    ] as const;
    const items = states.map((state, index) => ({
      ...base,
      id: `state-${state}`,
      status: 'active' as const,
      feedbackStatus:
        index === 0 ? ('none' as const) : index === 1 ? ('accepted' as const) : ('needs-verification' as const),
      application: { state },
    }));

    expect([...activeThemePeerCounts(items).values()]).toEqual([states.length]);
  });

  it('8 条同主题候选仍保留 8 个独立节点对，活动计数只含 active', () => {
    const { graph, expectedPairs } = eightThemeFixture();
    const file = generateDiscoveries(graph, emptyDiscoveryFile(NOW));
    const items = file.discoveries.map((item, index) => ({
      ...item,
      status: index < 6 ? ('active' as const) : ('dismissed' as const),
      feedbackStatus:
        index === 0
          ? ('accepted' as const)
          : index === 1
            ? ('rejected' as const)
            : ('needs-verification' as const),
      application: {
        state:
          index === 0
            ? ('applied' as const)
            : index === 1
              ? ('stale' as const)
              : ('none' as const),
      },
    }));
    const groups = groupDiscoveriesByTheme(items);
    const group = [...groups.values()][0]!;

    expect(expectedPairs).toHaveLength(8);
    expect(file.discoveries).toHaveLength(8);
    expect(group).toHaveLength(8);
    expect(new Set(group.map((item) => item.nodeIds.join('|'))).size).toBe(8);
    expect(activeThemePeerCounts(items).get(discoveryThemeKey(group[0]!))).toBe(6);
  });
});
