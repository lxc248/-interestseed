import { describe, expect, it } from 'vitest';
import { renderInterestRoute } from '../src/services/interestRoute';
import type { InterestSeedNode } from '../src/types/graph';

function node(overrides: Partial<InterestSeedNode> & Pick<InterestSeedNode, 'id' | 'title'>): InterestSeedNode {
  return {
    type: 'topic',
    tags: [],
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
    metadata: overrides.metadata ?? {},
  };
}

describe('Interest route MOC', () => {
  it('renders source links, experiment and observations', () => {
    const markdown = renderInterestRoute({
      theme: '设计',
      generatedAt: '2026-10-29T00:00:00.000Z',
      connectedIds: new Set(['connected']),
      experiment: { title: '3 天试跑', day: 1, targetDays: 3, status: 'active' },
      nodes: [
        node({
          id: 'connected',
          title: '观察用户',
          sourceUri: 'vault:设计/观察用户.md',
          tags: ['设计'],
          metadata: {
            taskState: 'connected',
            observations: [
              {
                id: 'o1',
                at: '2026-10-28T00:00:00.000Z',
                source: 'note',
                evidence: '今天真的观察了一次',
                belief: 'stronger',
              },
            ],
          },
        }),
        node({
          id: 'next',
          title: '3 天试跑',
          tags: ['设计'],
          metadata: { nextStep: true, taskState: 'experimenting' },
        }),
      ],
    });
    expect(markdown).toContain('# 兴趣路线 · 设计');
    expect(markdown).toContain('[[设计/观察用户|观察用户]]');
    expect(markdown).toContain('Day 1 / 3');
    expect(markdown).toContain('今天真的观察了一次');
    expect(markdown).toContain('不会自动修改你的笔记');
  });
});
