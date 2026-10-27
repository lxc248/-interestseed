import { describe, expect, it } from 'vitest';

import {
  compareDiscoveries,
  discoveryPriority,
  discoveryPriorityLabel,
  sortDiscoveries,
} from '../src/discovery/ranking';
import type { Discovery } from '../src/discovery/types';

const NOW = '2026-01-01T00:00:00.000Z';

function discovery(
  id: string,
  overrides: Partial<Discovery> = {},
): Discovery {
  return {
    id,
    kind: 'cross-project-topic',
    title: '共同主题',
    description: '说明',
    nodeIds: ['a', 'b'],
    projectKeys: ['P1', 'P2'],
    subjectKeys: ['theme'],
    evidence: [
      {
        kind: 'source',
        nodeId: 'a',
        sourceUri: 'vault:P1/a.md',
        text: '来源',
      },
    ],
    ruleVersion: 'v1',
    strength: 'moderate',
    dedupeKey: id,
    status: 'active',
    feedbackStatus: 'none',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe('feedback-aware discovery ranking', () => {
  it('uses base strength and stable id ordering when there is no feedback', () => {
    const weak = discovery('d-weak', { strength: 'weak' });
    const strongB = discovery('d-strong-b', { strength: 'strong' });
    const strongA = discovery('d-strong-a', { strength: 'strong' });

    const result = sortDiscoveries([weak, strongB, strongA]);

    expect(result.map((item) => item.id)).toEqual([
      'd-strong-a',
      'd-strong-b',
      'd-weak',
    ]);
  });

  it('keeps accepted above unreviewed and needs-verification between them', () => {
    const accepted = discovery('d-accepted', {
      strength: 'weak',
      feedbackStatus: 'accepted',
    });
    const needs = discovery('d-needs', {
      strength: 'weak',
      feedbackStatus: 'needs-verification',
    });
    const fresh = discovery('d-fresh', { strength: 'strong' });

    const result = sortDiscoveries([fresh, needs, accepted]);

    expect(result.map((item) => item.id)).toEqual([
      'd-accepted',
      'd-needs',
      'd-fresh',
    ]);
  });

  it('does not promote already applied work above unhandled candidates', () => {
    const applied = discovery('d-applied', {
      feedbackStatus: 'accepted',
      application: { state: 'applied' },
    });
    const fresh = discovery('d-fresh', { strength: 'weak' });

    expect(sortDiscoveries([applied, fresh]).map((item) => item.id)).toEqual([
      'd-fresh',
      'd-applied',
    ]);
  });

  it('sorts rejected and dismissed records last without hiding unrelated candidates', () => {
    const rejected = discovery('d-rejected', {
      feedbackStatus: 'rejected',
      status: 'dismissed',
    });
    const sameTheme = discovery('d-same-theme', { subjectKeys: ['theme'] });
    const fresh = discovery('d-fresh');

    const result = sortDiscoveries([rejected, sameTheme, fresh]);

    expect(result.map((item) => item.id)).toEqual([
      'd-fresh',
      'd-same-theme',
      'd-rejected',
    ]);
    expect(result.filter((item) => item.status === 'active')).toHaveLength(2);
  });

  it('does not treat missing or malformed feedback as negative feedback', () => {
    const malformed = discovery('d-malformed', {
      feedbackStatus: 'not-a-real-status' as Discovery['feedbackStatus'],
    });
    const fresh = discovery('d-fresh');

    expect(discoveryPriority(malformed)).toBe(2);
    expect(sortDiscoveries([malformed, fresh]).map((item) => item.id)).toEqual([
      'd-fresh',
      'd-malformed',
    ]);
  });

  it('is deterministic and does not mutate the input array', () => {
    const items = [
      discovery('d-b', { strength: 'weak' }),
      discovery('d-a', { strength: 'strong' }),
    ];
    const before = items.map((item) => item.id);

    const first = sortDiscoveries(items);
    const second = sortDiscoveries(items);

    expect(items.map((item) => item.id)).toEqual(before);
    expect(first.map((item) => item.id)).toEqual(second.map((item) => item.id));
    expect(compareDiscoveries(first[0]!, first[1]!)).toBeLessThan(0);
  });

  it('uses explicit labels for ranking explanation', () => {
    expect(discoveryPriorityLabel(discovery('a'))).toBe('新发现');
    expect(
      discoveryPriorityLabel(discovery('b', { feedbackStatus: 'accepted' })),
    ).toBe('已接受，待处理');
    expect(
      discoveryPriorityLabel(
        discovery('c', { feedbackStatus: 'accepted', application: { state: 'applied' } }),
      ),
    ).toBe('已应用/已存在关系');
  });
});
