import { emptyGraph } from '../types/graph';
import type { InterestSeedGraph } from '../types/graph';
import {
  isRecord,
  toIsoString,
  validateGraph,
  validateGraphStructure,
} from '../utils/validation';
import { MigrationManager, type MigrationResult } from './MigrationManager';

/** 持久化后端：Obsidian 插件目录、内存、测试桩都实现这个接口。 */
export interface GraphStorageAdapter {
  read(key: string): Promise<string | null>;
  write(key: string, data: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface GraphRepositoryOptions {
  key?: string;
  migrations?: MigrationManager;
  now?: () => string;
  pretty?: boolean;
}

export type GraphRepositoryErrorCode =
  | 'invalid-graph'
  | 'serialize-failed'
  | 'blocked'
  | 'backup-failed';

export class GraphRepositoryError extends Error {
  constructor(
    readonly code: GraphRepositoryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'GraphRepositoryError';
  }
}

export type LoadSource = 'store' | 'empty' | 'recovered';

export interface LoadResult {
  graph: InterestSeedGraph;
  source: LoadSource;
  issues: string[];
  appliedMigrations: string[];
  migratedFrom: number | null;
  corruptedBackupKey: string | null;
  preMigrationBackupKey: string | null;
  issuesBackupKey?: string | null;
  blocked: boolean;
  blockedReason: string | null;
}

/** 对外的图谱仓库契约。 */
export interface GraphRepository {
  load(): Promise<InterestSeedGraph>;

  save(graph: InterestSeedGraph): Promise<void>;

  validate(graph: InterestSeedGraph): string[];

  createBackup(): Promise<void>;
}

/**
 * 插件目录图谱仓库。
 *
 * - `load()` 只返回图谱；诊断信息通过 `loadDetailed()` / `lastLoadResult` 获取；
 * - 写盘前先做结构校验与 JSON round-trip；
 * - 迁移前自动备份；迁移失败时暂停写入，避免覆盖原文件；
 * - `createBackup()` 是显式备份，失败会抛出明确错误，由 UI 告知用户下一步。
 */
export class VaultGraphRepository implements GraphRepository {
  private readonly key: string;
  private readonly migrations: MigrationManager;
  private readonly now: () => string;
  private readonly pretty: boolean;
  private blockedReason: string | null = null;
  private lastResult: LoadResult | null = null;
  private lastBackup: string | null = null;

  constructor(
    private readonly adapter: GraphStorageAdapter,
    options: GraphRepositoryOptions = {},
  ) {
    this.key = options.key ?? 'graph.json';
    this.migrations = options.migrations ?? new MigrationManager();
    this.now = options.now ?? (() => new Date().toISOString());
    this.pretty = options.pretty ?? true;
  }

  get storageKey(): string {
    return this.key;
  }

  get isBlocked(): boolean {
    return this.blockedReason !== null;
  }

  get blockReason(): string | null {
    return this.blockedReason;
  }

  get lastLoadResult(): LoadResult | null {
    return this.lastResult;
  }

  get lastBackupKey(): string | null {
    return this.lastBackup;
  }

  async load(): Promise<InterestSeedGraph> {
    const result = await this.loadDetailed();
    return result.graph;
  }

  async loadDetailed(): Promise<LoadResult> {
    this.blockedReason = null;

    const raw = await this.adapter.read(this.key);
    if (raw === null || raw.trim() === '') {
      const result = this.emptyResult();
      this.lastResult = result;
      return result;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return this.recoverFromBackup(raw);
    }

    let migrated: MigrationResult;
    try {
      migrated = this.migrations.migrate(parsed);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const backup = await this.writeBackup(raw, 'corrupt');
      this.blockedReason = `图谱数据无法迁移（${message}），已暂停写入以保护原文件`;
      const result = this.recovered(
        [`图谱数据迁移失败：${message}`],
        backup,
        true,
      );
      this.lastResult = result;
      return result;
    }

    let preMigrationBackupKey: string | null = null;
    if (migrated.applied.length > 0) {
      preMigrationBackupKey = await this.writeBackup(raw, `backup-v${migrated.from}`);
      if (preMigrationBackupKey === null) {
        this.blockedReason = '迁移前备份旧数据失败，已暂停写入以保护原文件';
      }
    }

    const { graph, issues } = validateGraph(migrated.data, this.now());
    graph.schemaVersion = migrated.to;

    let issuesBackupKey: string | null = null;
    if (issues.length > 0) {
      issuesBackupKey = await this.writeBackup(raw, 'issues');
      if (issuesBackupKey === null) {
        issues.push('图谱数据已被部分清洗，但清洗前备份失败');
      }
    }

    if (isRecord(migrated.data)) {
      graph.updatedAt = toIsoString(migrated.data.updatedAt, this.now());
    }

    const result: LoadResult = {
      graph,
      source: 'store',
      issues,
      appliedMigrations: migrated.applied,
      migratedFrom: migrated.from === migrated.to ? null : migrated.from,
      corruptedBackupKey: null,
      preMigrationBackupKey,
      issuesBackupKey,
      blocked: this.blockedReason !== null,
      blockedReason: this.blockedReason,
    };
    this.lastResult = result;
    return result;
  }

  validate(graph: InterestSeedGraph): string[] {
    return validateGraphStructure(graph);
  }

  async save(graph: InterestSeedGraph): Promise<void> {
    if (this.blockedReason) {
      throw new GraphRepositoryError('blocked', this.blockedReason);
    }

    const errors = this.validate(graph);
    if (errors.length > 0) {
      throw new GraphRepositoryError(
        'invalid-graph',
        `图谱结构校验失败：${errors.slice(0, 10).join('；')}`,
      );
    }

    const payload: Record<string, unknown> = {
      schemaVersion: this.migrations.target,
      updatedAt: this.now(),
      nodes: graph.nodes,
      edges: graph.edges,
    };
    if (graph.viewport) payload.viewport = graph.viewport;

    let text: string;
    try {
      text = JSON.stringify(payload, null, this.pretty ? 2 : 0);
    } catch (error) {
      throw new GraphRepositoryError(
        'serialize-failed',
        `图谱序列化失败：${error instanceof Error ? error.message : String(error)}`,
      );
    }

    try {
      const roundTrip: unknown = JSON.parse(text);
      if (
        !isRecord(roundTrip) ||
        !Array.isArray(roundTrip.nodes) ||
        !Array.isArray(roundTrip.edges)
      ) {
        throw new Error('缺少 nodes / edges');
      }
    } catch (error) {
      throw new GraphRepositoryError(
        'serialize-failed',
        `图谱序列化结果无效：${error instanceof Error ? error.message : String(error)}`,
      );
    }

    await this.adapter.write(this.key, `${text}\n`);
  }

  /**
   * 显式备份当前存储文件。备份失败会抛错，绝不静默当作成功。
   * 备份 key 通过 lastBackupKey 获取。
   */
  async createBackup(): Promise<void> {
    const raw = await this.adapter.read(this.key);
    if (raw === null) {
      throw new GraphRepositoryError(
        'backup-failed',
        '当前没有可备份的图谱文件（尚未保存过图谱）',
      );
    }

    const stamp = this.now().replace(/[:.]/g, '-');
    const key = `${this.key}.backup-${stamp}`;

    try {
      await this.adapter.write(key, raw);
    } catch (error) {
      throw new GraphRepositoryError(
        'backup-failed',
        `备份写入失败：${error instanceof Error ? error.message : String(error)}`,
      );
    }

    this.lastBackup = key;
  }

  async exists(): Promise<boolean> {
    return (await this.adapter.read(this.key)) !== null;
  }

  async clear(): Promise<void> {
    await this.adapter.remove(this.key);
  }

  /**
   * 迁移失败后的显式恢复：先把原文件复制为备份，再允许写入。
   * 备份失败时不解除保护。
   */
  async releaseBlockAfterBackup(): Promise<string | null> {
    if (!this.blockedReason) return null;

    const raw = await this.adapter.read(this.key);
    let backupKey: string | null = null;

    if (raw !== null) {
      backupKey = await this.writeBackup(raw, 'migration-failed');
      if (backupKey === null) {
        throw new GraphRepositoryError('blocked', '备份原文件失败，未解除写入保护');
      }
    }

    this.blockedReason = null;
    return backupKey;
  }

  private emptyResult(): LoadResult {
    return {
      graph: emptyGraph(this.now()),
      source: 'empty',
      issues: [],
      appliedMigrations: [],
      migratedFrom: null,
      corruptedBackupKey: null,
      preMigrationBackupKey: null,
      blocked: false,
      blockedReason: null,
    };
  }

  private recovered(
    issues: string[],
    backupKey: string | null,
    blocked: boolean,
  ): LoadResult {
    return {
      graph: emptyGraph(this.now()),
      source: 'recovered',
      issues,
      appliedMigrations: [],
      migratedFrom: null,
      corruptedBackupKey: backupKey,
      preMigrationBackupKey: null,
      blocked,
      blockedReason: this.blockedReason,
    };
  }

  private recoveredGraph(
    graph: InterestSeedGraph,
    issues: string[],
    backupKey: string | null,
  ): LoadResult {
    return {
      graph,
      source: 'recovered',
      issues,
      appliedMigrations: [],
      migratedFrom: null,
      corruptedBackupKey: backupKey,
      preMigrationBackupKey: null,
      blocked: false,
      blockedReason: null,
    };
  }

  private async recoverFromBackup(raw: string): Promise<LoadResult> {
    // 先保存损坏主文件；这一步失败就不能继续，否则后续保存可能把原文件轮换进 .bak。
    const corruptBackupKey = await this.writeBackup(raw, 'corrupt');
    if (corruptBackupKey === null) {
      this.blockedReason = '图谱损坏且备份原文件失败，已暂停写入以保护原文件';
      const result = this.recovered(['图谱不是合法 JSON，且原文件备份失败'], null, true);
      this.lastResult = result;
      return result;
    }

    let backupRaw: string | null;
    try {
      backupRaw = await this.adapter.read(`${this.key}.bak`);
    } catch {
      this.blockedReason = '图谱损坏且备份读取失败，已暂停写入以保护原文件';
      const result = this.recovered(
        ['图谱不是合法 JSON，且 .bak 读取失败'],
        corruptBackupKey,
        true,
      );
      this.lastResult = result;
      return result;
    }

    if (backupRaw === null || backupRaw.trim() === '') {
      this.blockedReason = '图谱主文件损坏且备份缺失，已暂停写入以保护原文件';
      const result = this.recovered(
        ['图谱不是合法 JSON，且 .bak 不存在'],
        corruptBackupKey,
        true,
      );
      this.lastResult = result;
      return result;
    }

    let backupParsed: unknown;
    try {
      backupParsed = JSON.parse(backupRaw);
    } catch {
      this.blockedReason = '图谱主文件与备份均损坏，已暂停写入以保护原文件';
      const result = this.recovered(
        ['图谱主文件与 .bak 都不是合法 JSON'],
        corruptBackupKey,
        true,
      );
      this.lastResult = result;
      return result;
    }

    if (
      !isRecord(backupParsed) ||
      !Array.isArray(backupParsed.nodes) ||
      !Array.isArray(backupParsed.edges)
    ) {
      this.blockedReason = '图谱备份结构无效（缺少 nodes/edges 数组），已暂停写入以保护原文件';
      const result = this.recovered(
        ['图谱备份结构无效：缺少 nodes/edges 数组'],
        corruptBackupKey,
        true,
      );
      this.lastResult = result;
      return result;
    }

    let migrated: MigrationResult;
    try {
      migrated = this.migrations.migrate(backupParsed);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.blockedReason = `图谱备份无法迁移（${message}），已暂停写入以保护原文件`;
      const result = this.recovered(
        [`图谱备份迁移失败：${message}`],
        corruptBackupKey,
        true,
      );
      this.lastResult = result;
      return result;
    }

    const { graph, issues } = validateGraph(migrated.data, this.now());
    graph.schemaVersion = migrated.to;
    if (isRecord(migrated.data)) {
      graph.updatedAt = toIsoString(migrated.data.updatedAt, this.now());
    }

    const structuralErrors = this.validate(graph);
    if (issues.length > 0 || structuralErrors.length > 0) {
      this.blockedReason = '图谱备份校验未通过，已暂停写入以保护原文件';
      const result = this.recovered(
        [
          '图谱备份校验未通过：',
          ...issues,
          ...structuralErrors.map((item) => `结构：${item}`),
        ],
        corruptBackupKey,
        true,
      );
      this.lastResult = result;
      return result;
    }

    // 恢复成功后写回主文件，避免“内存已恢复、磁盘主文件仍损坏”的长期不一致。
    // 先把有效备份内容保存为 .recovered-<时间戳>，防止后续原子写入轮换 .bak 时丢失。
    const recoveredBackupKey = await this.writeBackup(backupRaw, 'recovered');
    if (recoveredBackupKey === null) {
      this.blockedReason = '图谱恢复前保存有效备份失败，已暂停写入以保护原文件';
      const result = this.recovered(
        ['图谱恢复前保存有效备份失败'],
        corruptBackupKey,
        true,
      );
      this.lastResult = result;
      return result;
    }

    try {
      await this.save(graph);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.blockedReason = `图谱恢复后写回主文件失败（${message}），已暂停写入以保护原文件`;
      const result = this.recovered(
        [`图谱恢复后写回主文件失败：${message}`],
        corruptBackupKey,
        true,
      );
      this.lastResult = result;
      return result;
    }

    const result = this.recoveredGraph(
      graph,
      [
        '图谱主文件不是合法 JSON，已从 .bak 恢复并写回主文件',
        `有效备份已保存：${recoveredBackupKey}`,
        ...issues,
      ],
      corruptBackupKey,
    );
    this.lastResult = result;
    return result;
  }

  private async writeBackup(raw: string, suffix: string): Promise<string | null> {
    const stamp = this.now().replace(/[:.]/g, '-');
    const base = `${this.key}.${suffix}-${stamp}`;
    let key = base;
    let attempt = 0;

    // 时间戳精度不足或同一毫秒内重复恢复时，避免覆盖已经存在的备份。
    while (await this.backupKeyExists(key)) {
      attempt += 1;
      if (attempt > 1000) return null;
      key = `${base}-${attempt}`;
    }

    try {
      await this.adapter.write(key, raw);
      return key;
    } catch {
      return null;
    }
  }

  private async backupKeyExists(key: string): Promise<boolean> {
    try {
      return (await this.adapter.read(key)) !== null;
    } catch {
      // 读取失败时按“已存在”处理，换一个 key，避免覆盖未知文件。
      return true;
    }
  }
}
