import {
  GRAPH_SCHEMA_VERSION,
  isNodeType,
  isRelationOrigin,
  isRelationStatus,
} from '../types/graph';
import type {
  GraphViewport,
  InterestSeedEdge,
  InterestSeedGraph,
  InterestSeedNode,
} from '../types/graph';
import { normalizePath } from './paths';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function toFiniteNumber(value: unknown, fallback: number): number {
  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function clamp01(value: unknown, fallback = 0): number {
  const numeric = toFiniteNumber(value, fallback);
  if (numeric <= 0) return 0;
  if (numeric >= 1) return 1;
  return numeric;
}

export function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** 接受 `"a, b"`、`['a', '#b']` 等输入，去重并去掉前导 #。 */
export function sanitizeTags(input: unknown): string[] {
  const source = Array.isArray(input)
    ? input
    : typeof input === 'string'
      ? input.split(/[,，;；\s]+/)
      : [];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const entry of source) {
    if (typeof entry !== 'string') continue;
    const tag = entry.replace(/^#+/, '').trim();
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }
  return tags;
}

export function tagKey(tag: string): string {
  return tag.replace(/^#+/, '').trim().toLowerCase();
}

/** 把未知输入转成 ISO 字符串；无法解析时使用 fallback。 */
export function toIsoString(value: unknown, fallback: string): string {
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? fallback : new Date(parsed).toISOString();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  return fallback;
}

const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

export function isIsoTimestamp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    ISO_PATTERN.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

/**
 * 严格的结构校验：用于保存前检查，不修正数据，只报告问题。
 * 与 validateGraph（读入时的宽松清洗）互补。
 */
export function validateGraphStructure(graph: InterestSeedGraph): string[] {
  const errors: string[] = [];

  if (!isRecord(graph)) return ['图谱根对象不是对象'];

  if (!Number.isInteger(graph.schemaVersion) || graph.schemaVersion < 1) {
    errors.push('schemaVersion 必须是正整数');
  }
  if (!isIsoTimestamp(graph.updatedAt)) {
    errors.push('updatedAt 必须是 ISO 8601 字符串');
  }
  if (!Array.isArray(graph.nodes)) errors.push('nodes 必须是数组');
  if (!Array.isArray(graph.edges)) errors.push('edges 必须是数组');
  if (errors.length > 0) return errors;

  const nodeIds = new Set<string>();
  const sourceUris = new Set<string>();

  for (const node of graph.nodes) {
    if (!isRecord(node)) {
      errors.push('nodes 中存在非对象项');
      continue;
    }
    if (typeof node.id !== 'string' || !node.id.trim()) {
      errors.push('节点缺少 id');
      continue;
    }
    if (nodeIds.has(node.id)) errors.push(`节点 id 重复：${node.id}`);
    nodeIds.add(node.id);

    if (typeof node.sourceUri === 'string' && node.sourceUri.trim()) {
      const key = node.sourceUri.toLowerCase();
      if (sourceUris.has(key)) {
        errors.push(`节点 sourceUri 重复：${node.sourceUri}`);
      }
      sourceUris.add(key);
    }

    if (!isNodeType(node.type)) errors.push(`节点 ${node.id} 的 type 无效`);
    if (typeof node.title !== 'string' || !node.title.trim()) {
      errors.push(`节点 ${node.id} 缺少 title`);
    }
    if (!Array.isArray(node.tags) || !node.tags.every((tag) => typeof tag === 'string')) {
      errors.push(`节点 ${node.id} 的 tags 必须是字符串数组`);
    }
    if (!isRecord(node.metadata)) errors.push(`节点 ${node.id} 的 metadata 必须是对象`);
    if (!isIsoTimestamp(node.createdAt)) errors.push(`节点 ${node.id} 的 createdAt 不是 ISO 时间`);
    if (!isIsoTimestamp(node.updatedAt)) errors.push(`节点 ${node.id} 的 updatedAt 不是 ISO 时间`);
    if (node.sourceUri !== undefined && typeof node.sourceUri !== 'string') {
      errors.push(`节点 ${node.id} 的 sourceUri 必须是字符串`);
    }
  }

  const edgeIds = new Set<string>();
  const edgeKeys = new Set<string>();

  for (const edge of graph.edges) {
    if (!isRecord(edge)) {
      errors.push('edges 中存在非对象项');
      continue;
    }
    if (typeof edge.id !== 'string' || !edge.id.trim()) {
      errors.push('关系缺少 id');
      continue;
    }
    if (edgeIds.has(edge.id)) errors.push(`关系 id 重复：${edge.id}`);
    edgeIds.add(edge.id);

    if (typeof edge.source === 'string' && typeof edge.target === 'string' && typeof edge.relation === 'string') {
      const key = `${edge.source}\u0000${edge.target}\u0000${edge.relation}`;
      if (edgeKeys.has(key)) {
        errors.push(`关系重复：${edge.source} → ${edge.target}（${edge.relation}）`);
      }
      edgeKeys.add(key);
    }

    if (typeof edge.source !== 'string' || !nodeIds.has(edge.source)) {
      errors.push(`关系 ${edge.id} 的 source 不存在`);
    }
    if (typeof edge.target !== 'string' || !nodeIds.has(edge.target)) {
      errors.push(`关系 ${edge.id} 的 target 不存在`);
    }
    if (edge.source === edge.target) errors.push(`关系 ${edge.id} 是自环`);
    if (typeof edge.relation !== 'string' || !edge.relation.trim()) {
      errors.push(`关系 ${edge.id} 缺少 relation`);
    }
    if (!isRelationOrigin(edge.origin)) errors.push(`关系 ${edge.id} 的 origin 无效`);
    if (!isRelationStatus(edge.status)) errors.push(`关系 ${edge.id} 的 status 无效`);
    if (
      edge.confidence !== undefined &&
      (typeof edge.confidence !== 'number' || edge.confidence < 0 || edge.confidence > 1)
    ) {
      errors.push(`关系 ${edge.id} 的 confidence 必须在 0–1 之间`);
    }
    if (
      edge.evidence !== undefined &&
      (!Array.isArray(edge.evidence) ||
        !edge.evidence.every((item) => typeof item === 'string' && item.trim()))
    ) {
      errors.push(`关系 ${edge.id} 的 evidence 必须是非空字符串数组`);
    }
    if (edge.userRenamed !== undefined && typeof edge.userRenamed !== 'boolean') {
      errors.push(`关系 ${edge.id} 的 userRenamed 必须是布尔值`);
    }
    if (
      (edge.origin === 'rule' || edge.origin === 'ai') &&
      (!Array.isArray(edge.evidence) || edge.evidence.length === 0)
    ) {
      errors.push(`关系 ${edge.id} 来源为 ${edge.origin} 但缺少 evidence`);
    }
    if (!isIsoTimestamp(edge.createdAt)) errors.push(`关系 ${edge.id} 的 createdAt 不是 ISO 时间`);
    if (!isIsoTimestamp(edge.updatedAt)) errors.push(`关系 ${edge.id} 的 updatedAt 不是 ISO 时间`);
  }

  if (graph.viewport !== undefined) {
    const viewport = graph.viewport;
    if (
      !isRecord(viewport) ||
      typeof viewport.zoom !== 'number' ||
      !Number.isFinite(viewport.zoom) ||
      viewport.zoom <= 0 ||
      typeof viewport.panX !== 'number' ||
      !Number.isFinite(viewport.panX) ||
      typeof viewport.panY !== 'number' ||
      !Number.isFinite(viewport.panY)
    ) {
      errors.push('viewport 必须是合法的 zoom / panX / panY');
    }
  }

  return errors;
}

export interface GraphValidationResult {
  graph: InterestSeedGraph;
  issues: string[];
}

/**
 * 把来路不明的数据清洗成合法图谱：丢弃无效节点 / 边并记录问题。
 * 永远返回可用的图谱，便于“损坏即降级”而不是直接崩溃。
 */
export function validateGraph(raw: unknown, now: string): GraphValidationResult {
  const issues: string[] = [];
  const graph: InterestSeedGraph = {
    schemaVersion: GRAPH_SCHEMA_VERSION,
    updatedAt: now,
    nodes: [],
    edges: [],
  };

  if (!isRecord(raw)) {
    issues.push('图谱数据不是对象，已返回空图谱');
    return { graph, issues };
  }

  graph.schemaVersion = Math.max(
    1,
    Math.floor(toFiniteNumber(raw.schemaVersion ?? raw.version, GRAPH_SCHEMA_VERSION)),
  );
  graph.updatedAt = toIsoString(raw.updatedAt, now);

  const rawNodes: unknown[] = Array.isArray(raw.nodes)
    ? raw.nodes
    : isRecord(raw.nodes)
      ? Object.values(raw.nodes)
      : [];

  const nodesById = new Map<string, InterestSeedNode>();
  const sourceUris = new Set<string>();

  for (const value of rawNodes) {
    if (!isRecord(value)) {
      issues.push('节点不是对象，已跳过');
      continue;
    }
    const id = typeof value.id === 'string' ? value.id.trim() : '';
    const title = typeof value.title === 'string' ? value.title.trim() : '';
    if (!id || !title) {
      issues.push(`节点缺少 id 或标题，已跳过：${id || '(无 id)'}`);
      continue;
    }
    if (nodesById.has(id)) {
      issues.push(`节点 id 重复：${id}`);
      continue;
    }

    if (value.type !== undefined && !isNodeType(value.type)) {
      issues.push(`节点 ${id} 的 type 无效（${String(value.type)}），已回退为 document`);
    }

    const sourceKey =
      typeof value.sourceUri === 'string' && value.sourceUri.trim()
        ? normalizePath(value.sourceUri).toLowerCase()
        : '';
    if (sourceKey) {
      if (sourceUris.has(sourceKey)) {
        issues.push(`节点 sourceUri 重复：${String(value.sourceUri)}，已跳过`);
        continue;
      }
      sourceUris.add(sourceKey);
    }

    const node: InterestSeedNode = {
      id,
      type: isNodeType(value.type) ? value.type : 'document',
      title,
      tags: sanitizeTags(value.tags),
      createdAt: toIsoString(value.createdAt, now),
      updatedAt: toIsoString(value.updatedAt, now),
      metadata: isRecord(value.metadata) ? { ...value.metadata } : {},
    };

    if (typeof value.sourceUri === 'string' && value.sourceUri.trim()) {
      node.sourceUri = normalizePath(value.sourceUri);
    }

    nodesById.set(id, node);
    graph.nodes.push(node);
  }

  const rawEdges: unknown[] = Array.isArray(raw.edges)
    ? raw.edges
    : isRecord(raw.edges)
      ? Object.values(raw.edges)
      : [];

  const edgeIds = new Set<string>();
  const edgeKeys = new Set<string>();

  for (const value of rawEdges) {
    if (!isRecord(value)) {
      issues.push('关系不是对象，已跳过');
      continue;
    }
    const source = typeof value.source === 'string' ? value.source.trim() : '';
    const target = typeof value.target === 'string' ? value.target.trim() : '';
    const relation = typeof value.relation === 'string' ? value.relation.trim() : '';

    if (!source || !target || !relation) {
      issues.push('关系缺少端点或 relation，已跳过');
      continue;
    }
    if (source === target) {
      issues.push(`关系 ${source} → ${target} 是自环，已跳过`);
      continue;
    }
    if (!nodesById.has(source) || !nodesById.has(target)) {
      issues.push(`关系 ${source} → ${target} 指向不存在的节点，已跳过`);
      continue;
    }

    const id =
      typeof value.id === 'string' && value.id.trim()
        ? value.id.trim()
        : `${source}->${target}:${relation}`;
    if (edgeIds.has(id)) {
      issues.push(`关系 id 重复：${id}`);
      continue;
    }

    const relationKey = `${source}\u0000${target}\u0000${relation}`;
    if (edgeKeys.has(relationKey)) {
      issues.push(`关系重复：${source} → ${target}（${relation}），已跳过`);
      continue;
    }
    edgeKeys.add(relationKey);

    const edge: InterestSeedEdge = {
      id,
      source,
      target,
      relation,
      origin: isRelationOrigin(value.origin) ? value.origin : 'user',
      status: isRelationStatus(value.status) ? value.status : 'confirmed',
      createdAt: toIsoString(value.createdAt, now),
      updatedAt: toIsoString(value.updatedAt, now),
    };

    if (value.origin !== undefined && !isRelationOrigin(value.origin)) {
      issues.push(`关系 ${id} 的 origin 无效（${String(value.origin)}），已回退为 user`);
    }
    if (value.status !== undefined && !isRelationStatus(value.status)) {
      issues.push(`关系 ${id} 的 status 无效（${String(value.status)}），已回退为 confirmed`);
    }

    if (typeof value.confidence === 'number' && Number.isFinite(value.confidence)) {
      edge.confidence = clamp01(value.confidence);
    }
    if (Array.isArray(value.evidence)) {
      const evidence = value.evidence
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean);
      if (evidence.length > 0) edge.evidence = evidence;
    }
    if (value.userRenamed === true) edge.userRenamed = true;

    if (
      (edge.origin === 'rule' || edge.origin === 'ai') &&
      (!edge.evidence || edge.evidence.length === 0)
    ) {
      // 历史数据可能没有 evidence；补上占位说明，保证仍可保存且来源可追溯。
      edge.evidence = ['历史数据：缺少来源说明'];
      issues.push(`关系 ${edge.id} 来源为 ${edge.origin} 但缺少 evidence，已补充占位说明`);
    }

    edgeIds.add(id);
    graph.edges.push(edge);
  }

  if (isRecord(raw.viewport)) {
    const zoom = toFiniteNumber(raw.viewport.zoom, 1);
    const viewport: GraphViewport = {
      zoom: zoom < 0.1 ? 0.1 : zoom > 5 ? 5 : zoom,
      panX: toFiniteNumber(raw.viewport.panX, 0),
      panY: toFiniteNumber(raw.viewport.panY, 0),
    };
    graph.viewport = viewport;
  }

  return { graph, issues };
}
