import type { InterestSeedEdge, InterestSeedNode } from '../types/graph';
import { edgeIdFor, hash64 } from '../utils/ids';
import { linkTargetToPath, noteTitleFromPath, pathFromUri, stripExtension } from '../utils/paths';
import { clamp01, tagKey } from '../utils/validation';import { compareText } from '../utils/text';

export interface RelationCandidate {
  edge: InterestSeedEdge;
  reasons: string[];
}

export interface RelationEngine {
  suggest(nodes: InterestSeedNode[]): RelationCandidate[];
}

export interface SharedTagPolicy {
  /** 超过该节点数的标签不进入两两组合。 */
  readonly maxTagSupport: number;
  /** 单个标签最多保留的候选 pair 数。 */
  readonly maxPairsPerTag: number;
  /** 全部共享标签候选的总预算；只约束 related-to。 */
  readonly maxTagCandidates: number;
}

/** 首版来自 T2-A 实测的工程安全边界，不声称是推荐质量最优值。 */
export const DEFAULT_SHARED_TAG_POLICY: SharedTagPolicy = {
  maxTagSupport: 500,
  maxPairsPerTag: 50,
  maxTagCandidates: 200,
};

export interface SharedTagReport {
  totalTags: number;
  filteredTags: number;
  pairsBeforeFilter: number;
  pairsSkippedBySupport: number;
  tagCandidates: number;
}

interface SharedPair {
  left: InterestSeedNode;
  right: InterestSeedNode;
  key: string;
  shared: number;
  hash: string;
}

function pairKey(left: string, right: string): string {
  return left <= right ? `${left}\u0000${right}` : `${right}\u0000${left}`;
}

function positiveInteger(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
}

function betterPair(left: SharedPair, right: SharedPair): boolean {
  if (left.shared !== right.shared) return left.shared > right.shared;
  if (left.hash !== right.hash) return left.hash < right.hash;
  return left.key < right.key;
}

/** 有界选择器：只保留当前最优的 limit 条，不保存全部 pair。 */
class BoundedPairSelection {
  private readonly items: SharedPair[] = [];
  private readonly seen = new Map<string, SharedPair>();

  constructor(private readonly limit: number) {}

  consider(pair: SharedPair): void {
    if (this.limit <= 0 || this.seen.has(pair.key)) return;

    if (this.items.length < this.limit) {
      this.insert(pair);
      return;
    }

    const worst = this.items[this.items.length - 1];
    if (!worst || !betterPair(pair, worst)) return;

    this.items.pop();
    this.seen.delete(worst.key);
    this.insert(pair);
  }

  all(): SharedPair[] {
    return [...this.items];
  }

  private insert(pair: SharedPair): void {
    let low = 0;
    let high = this.items.length;

    while (low < high) {
      const middle = (low + high) >> 1;
      const current = this.items[middle];
      if (current && betterPair(current, pair)) low = middle + 1;
      else high = middle;
    }

    this.items.splice(low, 0, pair);
    this.seen.set(pair.key, pair);
  }
}

function sharedTags(
  left: InterestSeedNode,
  right: InterestSeedNode,
  tagSets: Map<string, Set<string>>,
): string[] {
  const leftTags = tagSets.get(left.id);
  const rightTags = tagSets.get(right.id);
  if (!leftTags || !rightTags) return [];

  const shared: string[] = [];
  for (const tag of leftTags) {
    if (rightTags.has(tag)) shared.push(tag);
  }
  return shared.sort(compareText);
}

function sharedTagCount(
  left: InterestSeedNode,
  right: InterestSeedNode,
  tagSets: Map<string, Set<string>>,
): number {
  const leftTags = tagSets.get(left.id);
  const rightTags = tagSets.get(right.id);
  if (!leftTags || !rightTags) return 0;

  let count = 0;
  for (const tag of leftTags) {
    if (rightTags.has(tag)) count += 1;
  }
  return count;
}

/**
 * 候选关系引擎（v1）。
 *
 * 只实现有明确证据的规则：
 * 1. 笔记之间存在显式 Obsidian 链接（单向或双向）；
 * 2. 两篇笔记共享标签；
 * 3. 笔记与用户定义的主题节点（无 sourceUri 的 topic 节点）共享标签。
 *
 * 不做标题相似度推断，避免仅凭相似标题制造大量无意义关系。
 */
export class InterestSeedRelationEngine implements RelationEngine {
  private unresolvedLinks: string[] = [];
  private tagReport: SharedTagReport = {
    totalTags: 0,
    filteredTags: 0,
    pairsBeforeFilter: 0,
    pairsSkippedBySupport: 0,
    tagCandidates: 0,
  };
  private readonly policy: SharedTagPolicy;

  constructor(
    private readonly now: () => string = () => new Date().toISOString(),
    policy: Partial<SharedTagPolicy> = {},
  ) {
    this.policy = {
      maxTagSupport: positiveInteger(
        policy.maxTagSupport ?? DEFAULT_SHARED_TAG_POLICY.maxTagSupport,
        DEFAULT_SHARED_TAG_POLICY.maxTagSupport,
      ),
      maxPairsPerTag: positiveInteger(
        policy.maxPairsPerTag ?? DEFAULT_SHARED_TAG_POLICY.maxPairsPerTag,
        DEFAULT_SHARED_TAG_POLICY.maxPairsPerTag,
      ),
      maxTagCandidates: positiveInteger(
        policy.maxTagCandidates ?? DEFAULT_SHARED_TAG_POLICY.maxTagCandidates,
        DEFAULT_SHARED_TAG_POLICY.maxTagCandidates,
      ),
    };
  }

  /** 最近一次 suggest 中未能解析的链接，供构建报告使用。 */
  get lastUnresolvedLinks(): string[] {
    return [...this.unresolvedLinks];
  }

  /** 最近一次共享标签降噪的测试辅助统计，不进入持久化数据。 */
  get lastTagReport(): SharedTagReport {
    return { ...this.tagReport };
  }

  suggest(nodes: InterestSeedNode[]): RelationCandidate[] {
    this.unresolvedLinks = [];
    this.tagReport = {
      totalTags: 0,
      filteredTags: 0,
      pairsBeforeFilter: 0,
      pairsSkippedBySupport: 0,
      tagCandidates: 0,
    };

    const candidates: RelationCandidate[] = [];
    const connected = new Set<string>();
    const resolver = this.createResolver(nodes);

    const now = this.now();
    const makeEdge = (
      source: string,
      target: string,
      relation: string,
      origin: InterestSeedEdge['origin'],
      confidence: number,
      reasons: string[],
    ): InterestSeedEdge => ({
      id: edgeIdFor(source, target, relation),
      source,
      target,
      relation,
      origin,
      status: 'suggested',
      confidence,
      evidence: [...reasons],
      createdAt: now,
      updatedAt: now,
    });

    // 1. 显式链接（单向即成立；双向会得到两条有向边）。
    for (const node of nodes) {
      const rawLinks = node.metadata.links;
      if (!Array.isArray(rawLinks)) continue;

      for (const rawLink of rawLinks) {
        if (typeof rawLink !== 'string' || !rawLink.trim()) continue;
        const link = rawLink.trim();
        if (/\.(png|jpe?g|gif|webp|svg|pdf|mp3|mp4|webm|canvas)$/i.test(link)) continue;

        const target = resolver(link);
        if (!target) {
          this.unresolvedLinks.push(`${node.title} → [[${link}]]`);
          continue;
        }
        if (target.id === node.id) continue;

        connected.add(pairKey(node.id, target.id));
        const reasons = [`笔记《${node.title}》中存在链接：[[${link}]]`];
        candidates.push({
          edge: makeEdge(node.id, target.id, 'references', 'user', 1, reasons),
          reasons,
        });
      }
    }

    // 2. 共享标签（排除用户定义主题，主题单独匹配）。
    //    先按标签支持度过滤，再用有界选择器控制单标签与全局候选。
    const tagSets = new Map<string, Set<string>>();
    const tagGroups = new Map<string, InterestSeedNode[]>();

    for (const node of nodes) {
      if (node.type === 'topic') continue;

      const nodeTags = new Set<string>();
      for (const tag of node.tags) {
        const key = tagKey(tag);
        if (key) nodeTags.add(key);
      }
      if (nodeTags.size === 0) continue;
      tagSets.set(node.id, nodeTags);

      for (const tag of nodeTags) {
        const members = tagGroups.get(tag);
        if (members) members.push(node);
        else tagGroups.set(tag, [node]);
      }
    }

    const tagEntries = [...tagGroups.entries()];
    this.tagReport.totalTags = tagEntries.length;

    for (const [, members] of tagEntries) {
      this.tagReport.pairsBeforeFilter += (members.length * (members.length - 1)) / 2;
    }

    const eligibleTags: Array<[string, InterestSeedNode[]]> = [];

    for (const entry of tagEntries) {
      const members = entry[1];
      if (members.length < 2) continue;
      if (members.length > this.policy.maxTagSupport) {
        this.tagReport.filteredTags += 1;
        this.tagReport.pairsSkippedBySupport +=
          (members.length * (members.length - 1)) / 2;
        continue;
      }
      eligibleTags.push(entry);
    }

    // 标签顺序固定，避免处理顺序影响全局预算竞争。
    eligibleTags.sort(([left], [right]) => compareText(left, right));

    const globalSelection = new BoundedPairSelection(this.policy.maxTagCandidates);

    for (const [, members] of eligibleTags) {
      const tagSelection = new BoundedPairSelection(this.policy.maxPairsPerTag);

      for (let left = 0; left < members.length; left += 1) {
        const first = members[left];
        if (!first) continue;

        for (let right = left + 1; right < members.length; right += 1) {
          const second = members[right];
          if (!second) continue;

          const key = pairKey(first.id, second.id);
          if (connected.has(key)) continue;

          tagSelection.consider({
            left: first,
            right: second,
            key,
            shared: sharedTagCount(first, second, tagSets),
            hash: hash64(key),
          });
        }
      }

      for (const pair of tagSelection.all()) globalSelection.consider(pair);
    }

    const selectedPairs = globalSelection.all();
    this.tagReport.tagCandidates = selectedPairs.length;

    for (const pair of selectedPairs) {
      const shared = sharedTags(pair.left, pair.right, tagSets);
      if (shared.length === 0) continue;

      const confidence = clamp01(0.45 + 0.1 * Math.min(shared.length, 3));
      const reasons = [`两个笔记具有相同标签：${shared.join('、')}`];
      candidates.push({
        edge: makeEdge(
          pair.left.id,
          pair.right.id,
          'related-to',
          'rule',
          confidence,
          reasons,
        ),
        reasons,
      });
    }

    // 3. 笔记匹配用户定义的主题节点。
    const topics = nodes.filter((node) => node.type === 'topic' && !node.sourceUri);

    if (topics.length > 0) {
      for (const node of nodes) {
        if (node.type === 'topic') continue;
        if (node.tags.length === 0) continue;

        for (const topic of topics) {
          if (connected.has(pairKey(node.id, topic.id))) continue;

          const noteTags = new Set(node.tags.map((tag) => tagKey(tag)));
          const shared = topic.tags
            .map((tag) => tagKey(tag))
            .filter((tag) => noteTags.has(tag))
            .sort(compareText);

          if (shared.length === 0) continue;

          const confidence = clamp01(0.55 + 0.1 * Math.min(shared.length, 3));
          const reasons = [
            `匹配用户定义主题《${topic.title}》：共享标签 ${shared
              .map((tag) => `#${tag}`)
              .join('、')}`,
          ];

          candidates.push({
            edge: makeEdge(node.id, topic.id, 'about', 'rule', confidence, reasons),
            reasons,
          });
        }
      }
    }

    candidates.sort(
      (left, right) =>
        compareText(left.edge.source, right.edge.source) ||
        compareText(left.edge.target, right.edge.target) ||
        compareText(left.edge.relation, right.edge.relation),
    );

    return candidates;
  }

  private createResolver(
    nodes: InterestSeedNode[],
  ): (target: string) => InterestSeedNode | null {
    const byPath = new Map<string, InterestSeedNode>();
    const byTitle = new Map<string, InterestSeedNode>();

    for (const node of nodes) {
      if (!node.sourceUri) continue;
      const path = pathFromUri(node.sourceUri);
      byPath.set(path.toLowerCase(), node);
      byPath.set(stripExtension(path).toLowerCase(), node);
      const title = noteTitleFromPath(path).toLowerCase();
      if (!byTitle.has(title)) byTitle.set(title, node);
    }

    return (target: string) => {
      const path = linkTargetToPath(target);
      if (!path) return null;

      return (
        byPath.get(path.toLowerCase()) ??
        byPath.get(stripExtension(path).toLowerCase()) ??
        byTitle.get(noteTitleFromPath(path).toLowerCase()) ??
        null
      );
    };
  }
}
