import { GRAPH_SCHEMA_VERSION, isNodeType } from '../types/graph';
import { isRecord, toFiniteNumber } from '../utils/validation';

export type MigrationData = Record<string, unknown>;

export interface GraphMigration {
  from: number;
  to: number;
  description: string;
  migrate(data: MigrationData): MigrationData;
}

export type MigrationErrorCode = 'invalid-data' | 'future-version' | 'no-path';

export class MigrationError extends Error {
  constructor(
    readonly code: MigrationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'MigrationError';
  }
}

export interface MigrationResult {
  data: MigrationData;
  applied: string[];
  from: number;
  to: number;
}

const LEGACY_RELATION_KINDS: Record<string, string> = {
  link: 'extends',
  links: 'extends',
  parent: 'prerequisite',
  child: 'extends',
  same: 'related',
  related: 'related',
  contrast: 'contrasts',
  apply: 'application',
};

const V1_RELATION_MAP: Record<string, string> = {
  related: 'related-to',
  extends: 'references',
  contrasts: 'contrasts',
  prerequisite: 'depends-on',
  application: 'applied-to',
};

function isoOf(value: unknown, fallback: string): string {
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? fallback : new Date(parsed).toISOString();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  return fallback;
}

function mapOrigin(origin: unknown): string {
  if (origin === 'user' || origin === 'rule' || origin === 'ai') return origin;
  if (origin === 'manual' || origin === 'wikilink') return 'user';
  if (origin === 'tag' || origin === 'similarity') return 'rule';
  return 'user';
}

function mapStatus(origin: unknown, status: unknown): string {
  if (status === 'confirmed' || status === 'suggested' || status === 'rejected') {
    return status;
  }
  return mapOrigin(origin) === 'rule' ? 'suggested' : 'confirmed';
}

function mapRelation(kind: unknown): string {
  if (typeof kind !== 'string' || !kind.trim()) return 'related-to';
  return V1_RELATION_MAP[kind] ?? kind;
}

function mapType(declared: unknown, kind: unknown): string {
  if (isNodeType(declared)) return declared;
  if (kind === 'note') return 'document';
  if (kind === 'concept' || kind === 'seed') return 'topic';
  return 'document';
}

/** v0 → v1：数组格式（nodes / links）规整为记录格式。 */
const MIGRATION_V0_V1: GraphMigration = {
  from: 0,
  to: 1,
  description: '数组结构（nodes / links）转换为记录结构并统一字段名',
  migrate(data: MigrationData): MigrationData {
    const now = isoOf(data.updatedAt, new Date().toISOString());

    const rawNodes: unknown[] = [];
    if (Array.isArray(data.nodes)) rawNodes.push(...data.nodes);
    else if (isRecord(data.nodes)) {
      for (const [key, value] of Object.entries(data.nodes)) {
        rawNodes.push(isRecord(value) ? { id: key, ...value } : value);
      }
    }

    const nodes: Record<string, unknown> = {};
    for (const raw of rawNodes) {
      if (!isRecord(raw)) continue;
      const id =
        typeof raw.id === 'string' && raw.id.trim()
          ? raw.id
          : `node_${Object.keys(nodes).length + 1}`;
      const title =
        typeof raw.title === 'string' && raw.title.trim()
          ? raw.title
          : typeof raw.name === 'string' && raw.name.trim()
            ? raw.name
            : id;
      const tags = Array.isArray(raw.tags)
        ? raw.tags.filter((tag): tag is string => typeof tag === 'string')
        : typeof raw.tags === 'string'
          ? raw.tags.split(/[,，\s]+/).filter(Boolean)
          : [];

      nodes[id] = {
        id,
        title,
        kind: raw.kind ?? 'note',
        status: raw.status ?? 'seed',
        summary: raw.summary ?? raw.description ?? '',
        tags,
        sourcePath: raw.sourcePath ?? raw.path ?? null,
        weight: raw.weight ?? raw.interest ?? 0.5,
        createdAt: raw.createdAt ?? raw.created ?? now,
        updatedAt: raw.updatedAt ?? raw.updated ?? raw.createdAt ?? now,
      };
    }

    const rawEdges: unknown[] = [];
    if (Array.isArray(data.edges)) rawEdges.push(...data.edges);
    else if (Array.isArray(data.links)) rawEdges.push(...data.links);
    else if (isRecord(data.edges)) {
      for (const [key, value] of Object.entries(data.edges)) {
        rawEdges.push(isRecord(value) ? { id: key, ...value } : value);
      }
    }

    const edges: Record<string, unknown> = {};
    let index = 0;
    for (const raw of rawEdges) {
      if (!isRecord(raw)) continue;

      const source =
        typeof raw.source === 'string'
          ? raw.source
          : typeof raw.from === 'string'
            ? raw.from
            : '';
      const target =
        typeof raw.target === 'string'
          ? raw.target
          : typeof raw.to === 'string'
            ? raw.to
            : '';
      if (!source || !target) continue;

      const rawKind =
        typeof raw.kind === 'string'
          ? raw.kind
          : typeof raw.relationship === 'string'
            ? raw.relationship
            : 'related';
      const kind = LEGACY_RELATION_KINDS[rawKind] ?? rawKind;

      index += 1;
      const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id : `edge_${index}`;
      edges[id] = {
        id,
        source,
        target,
        kind,
        origin: raw.origin ?? 'manual',
        weight: raw.weight ?? 0.5,
        createdAt: raw.createdAt ?? now,
        updatedAt: raw.updatedAt ?? now,
      };
    }

    return { ...data, schemaVersion: 1, nodes, edges, updatedAt: now };
  },
};

/** v1 → v2：兴趣成熟度模型 → 种子节点模型（type / confidence / 关系状态）。 */
const MIGRATION_V1_V2: GraphMigration = {
  from: 1,
  to: 2,
  description: '兴趣模型（kind / status / weight）迁移为节点类型、关系来源与置信度',
  migrate(data: MigrationData): MigrationData {
    const now = isoOf(data.updatedAt, new Date().toISOString());

    const rawNodes: unknown[] = Array.isArray(data.nodes)
      ? data.nodes
      : isRecord(data.nodes)
        ? Object.values(data.nodes)
        : [];

    const nodes: unknown[] = [];
    for (const raw of rawNodes) {
      if (!isRecord(raw)) continue;
      const id =
        typeof raw.id === 'string' && raw.id.trim()
          ? raw.id
          : `node_${nodes.length + 1}`;
      const title =
        typeof raw.title === 'string' && raw.title.trim() ? raw.title : id;
      const summary = typeof raw.summary === 'string' ? raw.summary : '';
      const metadata: Record<string, unknown> = {
        ...(isRecord(raw.metadata) ? raw.metadata : {}),
      };
      if (summary) metadata.summary = summary;

      nodes.push({
        id,
        type: mapType(raw.type, raw.kind),
        title,
        sourceUri: typeof raw.sourceUri === 'string' ? raw.sourceUri : (raw.sourcePath ?? undefined),
        tags: Array.isArray(raw.tags)
          ? raw.tags.filter((tag): tag is string => typeof tag === 'string')
          : [],
        createdAt: isoOf(raw.createdAt, now),
        updatedAt: isoOf(raw.updatedAt, now),
        metadata,
      });
    }

    const rawEdges: unknown[] = Array.isArray(data.edges)
      ? data.edges
      : isRecord(data.edges)
        ? Object.values(data.edges)
        : [];

    const edges: unknown[] = [];
    for (const raw of rawEdges) {
      if (!isRecord(raw)) continue;
      const source = typeof raw.source === 'string' ? raw.source : '';
      const target = typeof raw.target === 'string' ? raw.target : '';
      if (!source || !target) continue;

      const origin = mapOrigin(raw.origin);
      const rawEvidence = Array.isArray(raw.evidence)
        ? raw.evidence
            .filter((item): item is string => typeof item === 'string')
            .map((item) => item.trim())
            .filter(Boolean)
        : [];
      const evidence =
        rawEvidence.length > 0
          ? rawEvidence
          : origin === 'rule'
            ? ['由 v1 的标签 / 相似度规则迁移生成']
            : origin === 'ai'
              ? ['由 v1 的 AI 建议迁移生成']
              : undefined;

      edges.push({
        id: typeof raw.id === 'string' && raw.id.trim() ? raw.id : `edge_${edges.length + 1}`,
        source,
        target,
        relation: mapRelation(raw.kind ?? raw.relation),
        origin,
        status: mapStatus(raw.origin, raw.status),
        confidence:
          typeof raw.confidence === 'number'
            ? raw.confidence
            : typeof raw.weight === 'number'
              ? raw.weight
              : undefined,
        evidence,
        createdAt: isoOf(raw.createdAt, now),
        updatedAt: isoOf(raw.updatedAt, now),
      });
    }

    const result: MigrationData = { ...data, schemaVersion: 2, nodes, edges, updatedAt: now };
    if (isRecord(data.viewport)) result.viewport = data.viewport;
    return result;
  },
};

export const DEFAULT_MIGRATIONS: GraphMigration[] = [MIGRATION_V0_V1, MIGRATION_V1_V2];

function readVersion(data: MigrationData): number {
  const raw = data.schemaVersion ?? data.version;
  return Math.max(0, Math.floor(toFiniteNumber(raw, 0)));
}

/**
 * 版本迁移管理器：迁移按 from / to 形成链，逐级执行；
 * 遇到比插件更新的版本会显式报错而不是静默丢数据。
 */
export class MigrationManager {
  private migrations: GraphMigration[];

  constructor(
    migrations: GraphMigration[] = DEFAULT_MIGRATIONS,
    private readonly targetVersion: number = GRAPH_SCHEMA_VERSION,
  ) {
    this.migrations = [...migrations].sort((left, right) => left.from - right.from);
  }

  get target(): number {
    return this.targetVersion;
  }

  register(migration: GraphMigration): void {
    this.migrations = [...this.migrations, migration].sort(
      (left, right) => left.from - right.from,
    );
  }

  migrate(raw: unknown): MigrationResult {
    if (!isRecord(raw)) {
      throw new MigrationError('invalid-data', '图谱数据必须是 JSON 对象');
    }

    const from = readVersion(raw);
    if (from > this.targetVersion) {
      throw new MigrationError(
        'future-version',
        `图谱版本 ${from} 高于当前插件支持的 ${this.targetVersion}，请升级 InterestSeed 后再打开。`,
      );
    }

    let data: MigrationData = { ...raw };
    let version = from;
    let guard = 0;
    const applied: string[] = [];

    while (version < this.targetVersion) {
      const migration = this.migrations.find((item) => item.from === version);
      if (!migration) {
        throw new MigrationError(
          'no-path',
          `缺少从版本 ${version} 到 ${this.targetVersion} 的迁移路径`,
        );
      }

      data = migration.migrate(data);
      version = migration.to;
      applied.push(`${migration.from} → ${migration.to}：${migration.description}`);

      guard += 1;
      if (guard > 64) {
        throw new MigrationError('no-path', '迁移链疑似出现循环，已中止');
      }
    }

    data.schemaVersion = this.targetVersion;
    return { data, applied, from, to: this.targetVersion };
  }
}
