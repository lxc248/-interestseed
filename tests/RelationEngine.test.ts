import { describe, expect, it } from 'vitest';
import {
  InterestSeedRelationEngine,
  type RelationCandidate,
} from '../src/core/RelationEngine';
import type { InterestSeedNode } from '../src/types/graph';
import { edgeIdFor } from '../src/utils/ids';

const NOW = '2026-01-01T00:00:00.000Z';

function node(
  id: string,
  title: string,
  options: {
    path?: string;
    tags?: string[];
    type?: InterestSeedNode['type'];
    links?: string[];
    manual?: boolean;
  } = {},
): InterestSeedNode {
  const path = options.path ?? `${title}.md`;
  const metadata: Record<string, unknown> = { links: options.links ?? [] };
  if (!options.manual) metadata.path = path;

  const result: InterestSeedNode = {
    id,
    type: options.type ?? 'document',
    title,
    tags: options.tags ?? [],
    createdAt: NOW,
    updatedAt: NOW,
    metadata,
  };
  if (!options.manual) result.sourceUri = `vault:${path}`;
  return result;
}

function engine(): InterestSeedRelationEngine {
  return new InterestSeedRelationEngine(() => NOW);
}

function relations(candidates: RelationCandidate[]): string[] {
  return candidates.map((candidate) => candidate.edge.relation);
}

describe('RelationEngine.suggest / 显式链接', () => {
  it('单向链接生成 references 候选，并带来源证据', () => {
    const a = node('a', 'Alpha', { links: ['Beta'] });
    const b = node('b', 'Beta');

    const candidates = engine().suggest([a, b]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.edge.relation).toBe('references');
    expect(candidates[0]?.edge.origin).toBe('user');
    expect(candidates[0]?.edge.status).toBe('suggested');
    expect(candidates[0]?.edge.source).toBe('a');
    expect(candidates[0]?.edge.target).toBe('b');
    expect(candidates[0]?.edge.id).toBe(edgeIdFor('a', 'b', 'references'));
    expect(candidates[0]?.reasons[0]).toContain('Alpha');
    expect(candidates[0]?.reasons[0]).toContain('Beta');
    expect(candidates[0]?.edge.evidence).toEqual(candidates[0]?.reasons);
  });

  it('双向链接生成两条有向候选', () => {
    const a = node('a', 'Alpha', { links: ['Beta'] });
    const b = node('b', 'Beta', { links: ['Alpha'] });

    const candidates = engine().suggest([a, b]);
    expect(candidates).toHaveLength(2);
    expect(candidates.map((item) => `${item.edge.source}->${item.edge.target}`).sort()).toEqual(
      ['a->b', 'b->a'],
    );
  });

  it('自链接被忽略，未解析链接进入 lastUnresolvedLinks', () => {
    const a = node('a', 'Alpha', { links: ['Alpha', 'Missing'] });
    const engineInstance = engine();

    const candidates = engineInstance.suggest([a]);
    expect(candidates).toHaveLength(0);
    expect(engineInstance.lastUnresolvedLinks).toHaveLength(1);
    expect(engineInstance.lastUnresolvedLinks[0]).toContain('Missing');
  });
});

describe('RelationEngine.suggest / 共享标签', () => {
  it('共享标签生成 related-to，并在 reasons 中说明', () => {
    const a = node('a', 'Alpha', { tags: ['focus'] });
    const b = node('b', 'Beta', { tags: ['focus'] });

    const candidates = engine().suggest([a, b]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.edge.relation).toBe('related-to');
    expect(candidates[0]?.edge.origin).toBe('rule');
    expect(candidates[0]?.reasons[0]).toContain('focus');
    expect(candidates[0]?.edge.confidence).toBeGreaterThan(0);
  });

  it('已有显式链接时不再生成标签候选', () => {
    const a = node('a', 'Alpha', { tags: ['focus'], links: ['Beta'] });
    const b = node('b', 'Beta', { tags: ['focus'] });

    const candidates = engine().suggest([a, b]);
    expect(relations(candidates)).toEqual(['references']);
  });
});

describe('RelationEngine.suggest / 用户主题匹配', () => {
  it('笔记与用户定义主题共享标签时生成 about 候选', () => {
    const note = node('a', 'Alpha', { tags: ['focus'] });
    const topic = node('topic', 'Focus', { type: 'topic', tags: ['focus'], manual: true });

    const candidates = engine().suggest([note, topic]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.edge.relation).toBe('about');
    expect(candidates[0]?.edge.target).toBe('topic');
    expect(candidates[0]?.reasons[0]).toContain('Focus');
  });

  it('带来源文件的 topic 节点不算用户定义主题', () => {
    const note = node('a', 'Alpha', { tags: ['focus'] });
    const scannedTopic = node('t', 'Focus', { type: 'topic', tags: ['focus'] });

    const candidates = engine().suggest([note, scannedTopic]);
    expect(candidates).toHaveLength(0);
  });
});

describe('RelationEngine.suggest / 共享标签降噪', () => {
  function many(
    count: number,
    tagsFor: (index: number) => string[],
    linksFor?: (index: number) => string[],
  ): InterestSeedNode[] {
    return Array.from({ length: count }, (_, index) =>
      node(`n${index}`, `Node ${index}`, {
        tags: tagsFor(index),
        links: linksFor?.(index) ?? [],
      }),
    );
  }

  function unorderedPairs(candidates: RelationCandidate[]): string[] {
    return candidates
      .filter((candidate) => candidate.edge.relation === 'related-to')
      .map((candidate) =>
        [candidate.edge.source, candidate.edge.target].sort().join('|'),
      )
      .sort();
  }

  it('超过支持度上限的标签在组合前被过滤', () => {
    const engineInstance = engine();
    const candidates = engineInstance.suggest(many(600, () => ['broad']));

    expect(candidates).toHaveLength(0);
    expect(engineInstance.lastTagReport.filteredTags).toBe(1);
    expect(engineInstance.lastTagReport.pairsSkippedBySupport).toBe(
      (600 * 599) / 2,
    );
    expect(engineInstance.lastTagReport.tagCandidates).toBe(0);
  });

  it('单标签预算限制候选数量', () => {
    const engineInstance = engine();
    const candidates = engineInstance.suggest(many(100, () => ['broad']));

    expect(candidates).toHaveLength(50);
    expect(candidates.every((candidate) => candidate.edge.relation === 'related-to')).toBe(
      true,
    );
    expect(engineInstance.lastTagReport.pairsBeforeFilter).toBe(4_950);
    expect(engineInstance.lastTagReport.tagCandidates).toBe(50);
  });

  it('全局预算限制多个标签的总候选', () => {
    const nodes: InterestSeedNode[] = [];
    for (let group = 0; group < 10; group += 1) {
      for (let index = 0; index < 100; index += 1) {
        nodes.push(
          node(`g${group}-${index}`, `G${group} N${index}`, {
            tags: [`group-${group}`],
          }),
        );
      }
    }

    const candidates = engine().suggest(nodes);
    expect(candidates).toHaveLength(200);
    expect(
      candidates.every((candidate) => candidate.edge.relation === 'related-to'),
    ).toBe(true);
  });

  it('全部唯一标签时不产生共享标签关系', () => {
    const engineInstance = engine();
    const candidates = engineInstance.suggest(
      many(100, (index) => [`unique-${index}`]),
    );

    expect(candidates).toHaveLength(0);
    expect(engineInstance.lastTagReport.totalTags).toBe(100);
    expect(engineInstance.lastTagReport.tagCandidates).toBe(0);
  });

  it('高频标签与低频具体标签混合时保留低频候选', () => {
    const broad = many(600, () => ['broad']);
    const specific = [
      node('s1', 'Specific 1', { tags: ['specific'] }),
      node('s2', 'Specific 2', { tags: ['specific'] }),
      node('s3', 'Specific 3', { tags: ['specific'] }),
    ];

    const engineInstance = engine();
    const candidates = engineInstance.suggest([...broad, ...specific]);

    expect(candidates).toHaveLength(3);
    expect(candidates.every((candidate) => candidate.edge.relation === 'related-to')).toBe(
      true,
    );
    expect(engineInstance.lastTagReport.filteredTags).toBe(1);
  });

  it('多标签 pair 只生成一条关系并合并全部共享标签证据', () => {
    const candidates = engine().suggest([
      node('a', 'A', { tags: ['alpha', 'beta', 'gamma'] }),
      node('b', 'B', { tags: ['alpha', 'beta', 'gamma'] }),
    ]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.edge.relation).toBe('related-to');
    expect(candidates[0]?.edge.confidence).toBeCloseTo(0.75);
    expect(candidates[0]?.edge.evidence?.[0]).toContain('alpha');
    expect(candidates[0]?.edge.evidence?.[0]).toContain('beta');
    expect(candidates[0]?.edge.evidence?.[0]).toContain('gamma');
  });

  it('显式链接不受全局标签预算影响', () => {
    const nodes = many(
      300,
      () => ['broad'],
      (index) => (index + 1 < 300 ? [`Node ${index + 1}.md`] : []),
    );
    const candidates = engine().suggest(nodes);
    const references = candidates.filter(
      (candidate) => candidate.edge.relation === 'references',
    );
    const related = candidates.filter(
      (candidate) => candidate.edge.relation === 'related-to',
    );

    expect(references).toHaveLength(299);
    expect(related).toHaveLength(50);
    expect(candidates).toHaveLength(349);
  });

  it('用户主题匹配不受共享标签降噪影响', () => {
    const broad = many(600, () => ['broad']);
    const focusNote = node('focus-note', 'Focus Note', { tags: ['focus'] });
    const topic = node('topic', 'Focus Topic', {
      type: 'topic',
      tags: ['focus'],
      manual: true,
    });

    const candidates = engine().suggest([...broad, focusNote, topic]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.edge.relation).toBe('about');
    expect(candidates[0]?.edge.target).toBe('topic');
  });

  it('相同输入重复运行结果完全一致', () => {
    const nodes = many(100, () => ['shared']);
    const first = engine().suggest(nodes);
    const second = engine().suggest(nodes);

    expect(second).toEqual(first);
  });

  it('改变输入顺序不改变被选 pair 集合', () => {
    const forward = many(20, () => ['shared']);
    const reversed = [...forward].reverse();

    const firstPairs = unorderedPairs(engine().suggest(forward));
    const secondPairs = unorderedPairs(engine().suggest(reversed));

    expect(firstPairs).toHaveLength(50);
    expect(secondPairs).toEqual(firstPairs);
  });

  it('500 与 1,000 节点单标签仍受支持度/预算边界约束', () => {
    const fiveHundred = engine();
    expect(fiveHundred.suggest(many(500, () => ['broad']))).toHaveLength(50);
    expect(fiveHundred.lastTagReport.tagCandidates).toBe(50);

    const oneThousand = engine();
    expect(oneThousand.suggest(many(1_000, () => ['broad']))).toHaveLength(0);
    expect(oneThousand.lastTagReport.filteredTags).toBe(1);
    expect(oneThousand.lastTagReport.pairsSkippedBySupport).toBe(
      (1_000 * 999) / 2,
    );
  });

  it('5,000 节点单一共享标签被支持度边界拦截', () => {
    const engineInstance = engine();
    const candidates = engineInstance.suggest(many(5_000, () => ['broad']));

    expect(candidates).toHaveLength(0);
    expect(engineInstance.lastTagReport.pairsSkippedBySupport).toBe(
      (5_000 * 4_999) / 2,
    );
    expect(engineInstance.lastTagReport.filteredTags).toBe(1);
  });

  it('5,000 节点混合高频与低频标签仍受全局预算限制', () => {
    const nodes: InterestSeedNode[] = [];
    for (let index = 0; index < 1_000; index += 1) {
      nodes.push(node(`broad-${index}`, `Broad ${index}`, { tags: ['broad'] }));
    }
    for (let index = 0; index < 250; index += 1) {
      nodes.push(node(`medium-a-${index}`, `Medium A ${index}`, { tags: ['medium-a'] }));
      nodes.push(node(`medium-b-${index}`, `Medium B ${index}`, { tags: ['medium-b'] }));
    }
    for (let index = 0; index < 3_500; index += 1) {
      nodes.push(node(`specific-${index}`, `Specific ${index}`, { tags: [`specific-${index}`] }));
    }

    const engineInstance = engine();
    const candidates = engineInstance.suggest(nodes);

    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.length).toBeLessThanOrEqual(200);
    expect(engineInstance.lastTagReport.filteredTags).toBe(1);
    expect(engineInstance.lastTagReport.tagCandidates).toBe(
      candidates.length,
    );
  });
});

describe('RelationEngine.suggest / 证据约束', () => {
  it('只有相似标题、没有标签或链接时不产生关系', () => {
    const a = node('a', '项目计划');
    const b = node('b', '项目计划 2');

    expect(engine().suggest([a, b])).toHaveLength(0);
  });

  it('没有证据时不产生任何候选', () => {
    const nodes = [node('a', 'A'), node('b', 'B'), node('c', 'C')];
    expect(engine().suggest(nodes)).toHaveLength(0);
  });

  it('结果稳定可重复', () => {
    const nodes = [
      node('a', 'Alpha', { tags: ['focus'], links: ['Beta'] }),
      node('b', 'Beta', { tags: ['focus'] }),
    ];
    const first = engine().suggest(nodes);
    const second = engine().suggest(nodes);
    expect(second).toEqual(first);
  });
});
