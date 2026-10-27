import type { InterestSeedEdge, InterestSeedGraph, InterestSeedNode, NodeType } from '../types/graph';
import { isNodeType } from '../types/graph';
import { InterestSeedGraphStore, type EdgeInput } from './GraphStore';
import { InterestSeedRelationEngine, type RelationEngine } from './RelationEngine';
import { edgeIdFor, nodeIdForUri } from '../utils/ids';
import { extensionOf, isInsideFolder, noteTitleFromPath, pathFromUri } from '../utils/paths';
import { sanitizeTags, tagKey } from '../utils/validation';

export type FrontmatterValue = string | number | boolean | string[];
export interface ParsedFrontmatter {
  data: Record<string, FrontmatterValue>;
  body: string;
}

export interface WikiLink {
  target: string;
  alias: string | null;
  heading: string | null;
}

/** 构建地图时用户可配置的维度。 */
export interface GraphBuildOptions {
  includeFolders: string[];
  includeTags: string[];
  includeOutgoingLinks: boolean;
}

export interface GraphBuilder {
  build(nodes: InterestSeedNode[], options: GraphBuildOptions): InterestSeedGraph;
}

export interface BuildConflict {
  edgeId: string;
  keptRelation: string;
  candidateRelation: string;
  source: string;
  target: string;
}

export interface BuildReport {
  nodes: number;
  edges: number;
  byType: Record<NodeType, number>;
  unresolvedLinks: string[];
  warnings: string[];
  conflicts: BuildConflict[];
  durationMs: number;
}

export interface BuildResult {
  graph: InterestSeedGraph;
  report: BuildReport;
}

export interface RuleOptions {
  enableRuleSuggestions?: boolean;
  minConfidence?: number;
}

const MEDIA_TYPES: Record<string, NodeType> = {
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
  svg: 'image',
  bmp: 'image',
  mp3: 'audio',
  wav: 'audio',
  m4a: 'audio',
  ogg: 'audio',
  flac: 'audio',
  mp4: 'video',
  mov: 'video',
  webm: 'video',
  mkv: 'video',
  avi: 'video',
};

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function coerceScalar(value: string): string | number | boolean {
  const unquoted = stripQuotes(value);
  if (unquoted === 'true') return true;
  if (unquoted === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(unquoted)) return Number(unquoted);
  return unquoted;
}

/** 解析 Obsidian 常见的最小 YAML 子集（标量、行内数组、块数组）。 */
export function parseFrontmatter(content: string): ParsedFrontmatter {
  const normalized = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) return { data: {}, body: normalized };

  const end = normalized.indexOf('\n---', 3);
  if (end === -1) return { data: {}, body: normalized };

  const raw = normalized.slice(4, end);
  let body = normalized.slice(end + 4);
  if (body.startsWith('\n')) body = body.slice(1);

  const data: Record<string, FrontmatterValue> = {};
  let currentKey: string | null = null;

  for (const line of raw.split('\n')) {
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue;

    const listItem = /^\s*-\s*(.*)$/.exec(line);
    if (listItem && currentKey) {
      const value = stripQuotes((listItem[1] ?? '').trim());
      const existing = data[currentKey];
      if (Array.isArray(existing)) {
        if (value) existing.push(value);
      } else {
        data[currentKey] = value ? [value] : [];
      }
      continue;
    }

    const pair = /^([A-Za-z0-9_\u4e00-\u9fff-]+)\s*:\s*(.*)$/.exec(line);
    if (!pair) continue;

    const key = pair[1] ?? '';
    if (!key) continue;
    const rest = (pair[2] ?? '').trim();
    currentKey = key;

    if (rest === '') {
      data[key] = '';
    } else if (rest.startsWith('[') && rest.endsWith(']')) {
      data[key] = rest
        .slice(1, -1)
        .split(',')
        .map((item) => stripQuotes(item.trim()))
        .filter(Boolean);
    } else {
      data[key] = coerceScalar(rest);
    }
  }

  return { data, body };
}

/** 提取 frontmatter 标签与正文内联 #标签，去重后保持出现顺序。 */
export function extractTags(data: Record<string, FrontmatterValue>, body: string): string[] {
  const raw: string[] = [];

  for (const key of ['tags', 'tag', 'topics']) {
    const value = data[key];
    if (typeof value === 'string') raw.push(...value.split(/[,，;；\s]+/));
    else if (Array.isArray(value)) raw.push(...value);
  }

  const withoutCode = body.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`\n]*`/g, ' ');

  for (const match of withoutCode.matchAll(/(^|[\s(])#([\p{L}\p{N}_/-]{1,64})/gmu)) {
    const tag = match[2];
    if (tag) raw.push(tag);
  }

  return sanitizeTags(raw);
}

export function extractWikilinks(body: string): WikiLink[] {
  const withoutCode = body.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`\n]*`/g, ' ');

  const links: WikiLink[] = [];
  const seen = new Set<string>();
  const pattern = /\[\[([^\]|#]+)(?:#([^\]|]*))?(?:\|([^\]]*))?\]\]/g;

  for (const match of withoutCode.matchAll(pattern)) {
    const target = (match[1] ?? '').trim();
    if (!target) continue;
    const key = target.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({
      target,
      heading: match[2]?.trim() ?? null,
      alias: match[3]?.trim() ?? null,
    });
  }

  return links;
}

export function extractTitle(
  data: Record<string, FrontmatterValue>,
  body: string,
  path: string,
): string {
  const title = data.title;
  if (typeof title === 'string' && title.trim()) return title.trim();

  const heading = /^#\s+(.+)$/m.exec(body.replace(/```[\s\S]*?```/g, ''));
  if (heading?.[1]) return heading[1].replace(/\s+#+\s*$/, '').trim();

  return noteTitleFromPath(path);
}

/** 取正文第一段作为摘要，去掉 Markdown 噪音。 */
export function extractSummary(body: string, maxLength = 240): string {
  const cleaned = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^#{1,6}\s+.*$/gm, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g, '$1')
    .replace(/[`*_>~]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();

  const paragraph = cleaned
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0) ?? '';

  return paragraph.length > maxLength
    ? `${paragraph.slice(0, maxLength - 1)}…`
    : paragraph;
}

/**
 * 节点类型判定（用于“从当前文件创建节点”等场景）：
 * frontmatter type → project / activity → 扩展名 → document。
 * 常规扫描只处理 Markdown，类型来自 MetadataCache。
 */
export function detectNodeType(
  file: { path: string; extension: string },
  data: Record<string, FrontmatterValue> = {},
): NodeType {
  const declared = data.type;
  if (isNodeType(declared)) return declared;
  if (data.project === true || data.project === 'true') return 'project';
  if (data.activity === true || data.activity === 'true') return 'activity';

  const extension = file.extension || extensionOf(file.path);
  return MEDIA_TYPES[extension] ?? 'document';
}

function edgeKey(source: string, target: string, relation: string): string {
  return `${source}\u0000${target}\u0000${relation}`;
}

function undirectedPairKey(source: string, target: string): string {
  return source <= target ? `${source}\u0000${target}` : `${target}\u0000${source}`;
}

function metadataWithoutPosition(metadata: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...metadata };
  delete copy.position;
  return copy;
}

function sameNodeContent(left: InterestSeedNode, right: InterestSeedNode): boolean {
  return (
    left.title === right.title &&
    left.type === right.type &&
    left.tags.length === right.tags.length &&
    left.tags.every((tag, index) => tag === right.tags[index]) &&
    JSON.stringify(metadataWithoutPosition(left.metadata)) ===
      JSON.stringify(metadataWithoutPosition(right.metadata))
  );
}

function sameEdgeContent(
  left: Pick<InterestSeedEdge, 'origin' | 'status' | 'confidence' | 'evidence'>,
  right: Pick<InterestSeedEdge, 'origin' | 'status' | 'confidence' | 'evidence'>,
): boolean {
  if (
    left.origin !== right.origin ||
    left.status !== right.status ||
    left.confidence !== right.confidence
  ) {
    return false;
  }
  const leftEvidence = left.evidence ?? [];
  const rightEvidence = right.evidence ?? [];
  if (leftEvidence.length !== rightEvidence.length) return false;
  return leftEvidence.every((item, index) => item === rightEvidence[index]);
}

/**
 * 构建地图。
 *
 * - 节点 id 由 `sourceUri` 稳定派生，重复扫描不会产生新节点；
 * - 出链来自 MetadataCache，解析为 references（user / suggested）；
 * - 只根据链接、共享标签与用户主题建立关系，绝不因为同目录就直接断言相关；
 * - 以当前图谱为基线复用节点/关系的时间戳，并保留用户手动节点与
 *   已确认 / 已拒绝 / AI 关系；
 * - 扫描结果中消失的笔记节点会被移除，但手动节点始终保留。
 */
export class InterestSeedGraphBuilder implements GraphBuilder {
  private report: BuildReport = {
    nodes: 0,
    edges: 0,
    byType: {
      project: 0,
      document: 0,
      topic: 0,
      image: 0,
      audio: 0,
      video: 0,
      activity: 0,
    },
    unresolvedLinks: [],
    warnings: [],
    conflicts: [],
    durationMs: 0,
  };

  private ruleSuggestions = true;
  private minConfidence = 0.35;

  constructor(
    private readonly currentGraph: () => InterestSeedGraph,
    private readonly relations: RelationEngine = new InterestSeedRelationEngine(),
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  get lastReport(): BuildReport {
    return this.report;
  }

  /** 规则建议开关来自插件设置，不属于 GraphBuildOptions。 */
  configure(ruleOptions: RuleOptions): void {
    if (ruleOptions.enableRuleSuggestions !== undefined) {
      this.ruleSuggestions = ruleOptions.enableRuleSuggestions;
    }
    if (ruleOptions.minConfidence !== undefined) {
      this.minConfidence = ruleOptions.minConfidence;
    }
  }

  build(nodes: InterestSeedNode[], options: GraphBuildOptions): InterestSeedGraph {
    return this.buildWithReport(nodes, options).graph;
  }

  buildWithReport(nodes: InterestSeedNode[], options: GraphBuildOptions): BuildResult {
    const startedAt = Date.now();
    const current = this.currentGraph();
    const warnings: string[] = [];
    const unresolvedLinks: string[] = [];
    const conflicts: BuildConflict[] = [];
    const conflictProtectedIds = new Set<string>();

    const currentNodeById = new Map<string, InterestSeedNode>();
    const currentNodeByUri = new Map<string, InterestSeedNode>();
    const currentEdgeByKey = new Map<string, InterestSeedEdge>();
    const currentEdgeById = new Map<string, InterestSeedEdge>();
    const currentRelatedPair = new Map<string, InterestSeedEdge>();

    for (const node of current.nodes) {
      currentNodeById.set(node.id, node);
      if (node.sourceUri) currentNodeByUri.set(node.sourceUri.toLowerCase(), node);
    }
    for (const edge of current.edges) {
      currentEdgeByKey.set(edgeKey(edge.source, edge.target, edge.relation), edge);
      currentEdgeById.set(edge.id, edge);
      if (edge.relation === 'related-to') {
        const pair = undirectedPairKey(edge.source, edge.target);
        const existing = currentRelatedPair.get(pair);
        if (!existing || (existing.status === 'suggested' && edge.status !== 'suggested')) {
          currentRelatedPair.set(pair, edge);
        }
      }
    }

    const store = new InterestSeedGraphStore(undefined, { now: this.now });

    // 1. 用户手动创建的节点（没有来源文件）始终保留。
    for (const node of current.nodes) {
      if (node.sourceUri) continue;
      try {
        store.addNode(node);
      } catch (error) {
        warnings.push(
          `手动节点「${node.title}」无法保留：${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // 2. 扫描节点：稳定 id + 过滤 + 复用 createdAt / updatedAt。
    const seenIds = new Set<string>();

    for (const node of nodes) {
      const path = node.sourceUri ? pathFromUri(node.sourceUri) : '';
      if (node.sourceUri && !this.inScope(path, options)) continue;
      if (!this.tagsAllowed(node.tags, options)) continue;

      const id = node.sourceUri ? nodeIdForUri(node.sourceUri) : node.id;
      if (seenIds.has(id)) {
        warnings.push(`重复的节点来源被忽略：${node.sourceUri ?? node.title}`);
        continue;
      }
      seenIds.add(id);

      const existing =
        (node.sourceUri ? currentNodeByUri.get(node.sourceUri.toLowerCase()) : undefined) ??
        currentNodeById.get(id);

      const createdAt = existing?.createdAt ?? node.createdAt;
      const updatedAt =
        existing && sameNodeContent(existing, node) ? existing.updatedAt : node.updatedAt;

      // 画布上的节点位置属于用户布局，重新扫描时保留。
      const metadata: Record<string, unknown> = { ...node.metadata };
      const savedPosition = existing?.metadata.position;
      if (savedPosition !== undefined) metadata.position = savedPosition;

      try {
        store.addNode({ ...node, id, createdAt, updatedAt, metadata });
      } catch (error) {
        warnings.push(
          `节点「${node.title}」无法加入：${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // 3. 候选关系：显式链接 / 共享标签 / 用户定义主题匹配。
    const candidates = this.relations.suggest(store.listNodes());
    if (this.relations instanceof InterestSeedRelationEngine && options.includeOutgoingLinks) {
      unresolvedLinks.push(...this.relations.lastUnresolvedLinks);
    }

    for (const candidate of candidates) {
      const edge = candidate.edge;
      if (edge.relation === 'references' && !options.includeOutgoingLinks) continue;
      if (edge.origin === 'rule') {
        if (!this.ruleSuggestions) continue;
        if ((edge.confidence ?? 0) < this.minConfidence) continue;
      }
      if (edge.relation === 'related-to') {
        const existing = currentRelatedPair.get(
          undirectedPairKey(edge.source, edge.target),
        );
        // 共享标签关系语义无向；已有确认/拒绝关系时不允许反向候选重复。
        if (existing && existing.status !== 'suggested') continue;

        // 已有 suggested 关系时保留其既有方向与 ID，避免标题排序变化导致 ID 漂移。
        if (
          existing &&
          (existing.source !== edge.source || existing.target !== edge.target)
        ) {
          edge.source = existing.source;
          edge.target = existing.target;
          edge.id = edgeIdFor(existing.source, existing.target, edge.relation);
        }
      }

      // 用户改过名称的规则关系仍保留原 edge.id；用原 id 识别同一逻辑候选，
      // 避免把改名后的关系当作新关系重复写入，也避免把名称改回规则值。
      const existingById = currentEdgeById.get(edge.id);
      if (existingById && existingById.relation !== edge.relation) {
        conflictProtectedIds.add(existingById.id);
        conflicts.push({
          edgeId: existingById.id,
          keptRelation: existingById.relation,
          candidateRelation: edge.relation,
          source: existingById.source,
          target: existingById.target,
        });
        continue;
      }

      this.addRegenerableEdge(
        store,
        { ...edge, evidence: candidate.reasons },
        currentEdgeByKey,
        warnings,
      );
    }

    // 4. 保留用户的决定：已确认 / 已拒绝 / AI 关系，以及用户改名的规则关系。
    for (const edge of current.edges) {
      const protectedRename =
        edge.userRenamed === true || conflictProtectedIds.has(edge.id);
      if (edge.status === 'suggested' && edge.origin !== 'ai' && !protectedRename) continue;
      if (!store.getNode(edge.source) || !store.getNode(edge.target)) continue;

      try {
        store.addEdge({ ...edge });
      } catch (error) {
        warnings.push(
          `关系 ${edge.id} 无法保留：${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    const graph = store.toJSON();
    graph.updatedAt = this.now();

    const byType: Record<NodeType, number> = {
      project: 0,
      document: 0,
      topic: 0,
      image: 0,
      audio: 0,
      video: 0,
      activity: 0,
    };
    for (const node of graph.nodes) byType[node.type] += 1;

    this.report = {
      nodes: graph.nodes.length,
      edges: graph.edges.length,
      byType,
      unresolvedLinks: unresolvedLinks.slice(0, 50),
      warnings: warnings.slice(0, 50),
      conflicts: conflicts.slice(0, 50),
      durationMs: Math.max(0, Date.now() - startedAt),
    };

    return { graph, report: this.report };
  }

  private addRegenerableEdge(
    store: InterestSeedGraphStore,
    input: EdgeInput,
    currentEdgeByKey: Map<string, InterestSeedEdge>,
    warnings: string[],
  ): void {
    const key = edgeKey(input.source, input.target, input.relation);
    const existing = currentEdgeByKey.get(key);

    // 用户已确认 / 已拒绝的关系会原样保留，不再重新生成。
    if (existing && existing.status !== 'suggested') return;

    const next: EdgeInput = { ...input };
    if (existing) {
      next.createdAt = existing.createdAt;
      const comparable = {
        origin: input.origin ?? 'user',
        status: input.status ?? 'confirmed',
        confidence: input.confidence,
        evidence: input.evidence ? [...input.evidence] : undefined,
      };
      if (sameEdgeContent(existing, comparable)) {
        next.updatedAt = existing.updatedAt;
      }
    }

    try {
      store.addEdge(next);
    } catch (error) {
      warnings.push(
        `关系 ${input.source} → ${input.target} 无法创建：${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private inScope(path: string, options: GraphBuildOptions): boolean {
    if (options.includeFolders.length === 0) return true;
    return options.includeFolders.some((folder) => isInsideFolder(path, folder));
  }

  private tagsAllowed(tags: string[], options: GraphBuildOptions): boolean {
    if (options.includeTags.length === 0) return true;
    const wanted = new Set(options.includeTags.map((tag) => tagKey(tag)));
    return tags.some((tag) => wanted.has(tagKey(tag)));
  }
}
