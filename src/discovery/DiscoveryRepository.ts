import type { GraphStorageAdapter } from '../storage/GraphRepository';
import {
  DISCOVERY_IDENTITY_VERSION,
  DISCOVERY_SCHEMA_VERSION,
  emptyDiscoveryApplication,
  emptyDiscoveryFile,
  type Discovery,
  type DiscoveryApplication,
  type DiscoveryCorrection,
  type DiscoveryFeedbackEvent,
  type DiscoveryFile,
} from './types';
import { dedupeKeyFor, suppressionKeyFor } from './identity';

export type DiscoveryRepositoryErrorCode =
  | 'invalid-data'
  | 'blocked'
  | 'serialize-failed'
  | 'conflict';

export class DiscoveryRepositoryError extends Error {
  constructor(
    readonly code: DiscoveryRepositoryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'DiscoveryRepositoryError';
  }
}

export type DiscoveryBackupStatus =
  | 'not-needed'
  | 'succeeded'
  | 'failed'
  | 'unavailable';

export interface DiscoveryMigrationDiagnostics {
  totalRecords: number;
  legacyRecords: number;
  currentRecords: number;
  emptyEvidenceRecords: number;
  supersededRecords: number;
  persistedInThisInstance: 'not-attempted' | 'succeeded' | 'failed';
  persistedHistory: 'unknown';
}

export interface DiscoveryLoadResult {
  file: DiscoveryFile;
  blocked: boolean;
  blockedReason: string | null;
  issues: string[];
  backupStatus: DiscoveryBackupStatus;
  backupKey: string | null;
  migration?: DiscoveryMigrationDiagnostics;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

/**
 * 独立发现仓库。
 *
 * 复用 GraphStorageAdapter（实际由 PluginDataStorage 提供目录和原子写入），
 * 但不复用 VaultGraphRepository：发现数据有自己的版本、校验和错误语义。
 */
export class DiscoveryRepository {
  private blockedReason: string | null = null;
  private lastResult: DiscoveryLoadResult | null = null;
  private lastPersistStatus: DiscoveryMigrationDiagnostics['persistedInThisInstance'] = 'not-attempted';
  private lastRaw: string | null = null;
  private saveChain: Promise<void> = Promise.resolve();
  private backupChain: Promise<void> = Promise.resolve();
  private backupSequence = 0;

  constructor(
    private readonly adapter: GraphStorageAdapter,
    private readonly key = 'discoveries.json',
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  get isBlocked(): boolean {
    return this.blockedReason !== null;
  }

  get blockReason(): string | null {
    return this.blockedReason;
  }

  get lastLoadResult(): DiscoveryLoadResult | null {
    return this.lastResult;
  }

  async load(): Promise<DiscoveryFile> {
    const result = await this.loadDetailed();
    return result.file;
  }

  async loadDetailed(): Promise<DiscoveryLoadResult> {
    this.blockedReason = null;

    let raw: string | null;
    try {
      raw = await this.adapter.read(this.key);
      this.lastRaw = raw;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.blockedReason = `发现数据读取失败（${message}），已暂停写入`;
      const result: DiscoveryLoadResult = {
        file: emptyDiscoveryFile(this.now()),
        blocked: true,
        blockedReason: this.blockedReason,
        issues: [],
        backupStatus: 'unavailable',
        backupKey: null,
      };
      this.lastResult = result;
      return result;
    }

    if (raw === null || raw.trim() === '') {
      const result: DiscoveryLoadResult = {
        file: emptyDiscoveryFile(this.now()),
        blocked: false,
        blockedReason: null,
        issues: [],
        backupStatus: 'not-needed',
        backupKey: null,
      };
      this.lastResult = result;
      return result;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const backupKey = await this.backupCorrupt(raw);
      this.blockedReason = '发现数据不是合法 JSON，已暂停写入以保护原文件';
      const result: DiscoveryLoadResult = {
        file: emptyDiscoveryFile(this.now()),
        blocked: true,
        blockedReason: this.blockedReason,
        issues: [],
        backupStatus: backupKey ? 'succeeded' : 'failed',
        backupKey,
      };
      this.lastResult = result;
      return result;
    }

    if (!isRecord(parsed)) {
      const backupKey = await this.backupCorrupt(raw);
      this.blockedReason = '发现数据结构无效，已暂停写入以保护原文件';
      const result: DiscoveryLoadResult = {
        file: emptyDiscoveryFile(this.now()),
        blocked: true,
        blockedReason: this.blockedReason,
        issues: [],
        backupStatus: backupKey ? 'succeeded' : 'failed',
        backupKey,
      };
      this.lastResult = result;
      return result;
    }

    const version = parsed.discoverySchemaVersion;
    if (
      typeof version !== 'number' ||
      version < 1 ||
      version > DISCOVERY_SCHEMA_VERSION
    ) {
      const reason =
        typeof version !== 'number'
          ? '发现数据版本字段缺失或类型错误，已暂停写入'
          : version < 1
            ? `发现数据版本 ${String(version)} 过旧，暂无迁移路径，已暂停写入`
            : `发现数据版本 ${String(version)} 高于插件支持的 ${DISCOVERY_SCHEMA_VERSION}，请升级插件`;
      this.blockedReason = reason;
      const result: DiscoveryLoadResult = {
        file: emptyDiscoveryFile(this.now()),
        blocked: true,
        blockedReason: this.blockedReason,
        issues: [],
        backupStatus: 'not-needed',
        backupKey: null,
      };
      this.lastResult = result;
      return result;
    }

    const sanitized = this.sanitize(parsed, version);
    if (sanitized.blockedReason) {
      const backupKey = await this.backupCorrupt(raw);
      this.blockedReason = sanitized.blockedReason;
      const result: DiscoveryLoadResult = {
        file: sanitized.file,
        blocked: true,
        blockedReason: this.blockedReason,
        issues: sanitized.issues,
        backupStatus: backupKey ? 'succeeded' : 'failed',
        backupKey,
        migration: sanitized.migration,
      };
      this.lastResult = result;
      return result;
    }

    const result: DiscoveryLoadResult = {
      file: sanitized.file,
      blocked: false,
      blockedReason: null,
      issues: sanitized.issues,
      backupStatus: 'not-needed',
      backupKey: null,
      migration: sanitized.migration,
    };
    this.lastResult = result;
    return result;
  }

  validate(file: DiscoveryFile): string[] {
    const errors: string[] = [];
    if (file.discoverySchemaVersion !== DISCOVERY_SCHEMA_VERSION) {
      errors.push(`discoverySchemaVersion 必须为 ${DISCOVERY_SCHEMA_VERSION}`);
    }
    if (!Array.isArray(file.discoveries)) {
      errors.push('discoveries 必须是数组');
      return errors;
    }
    const ids = new Set<string>();
    for (const item of file.discoveries) {
      if (typeof item.id !== 'string' || !item.id.trim()) {
        errors.push('发现缺少 id');
      } else if (ids.has(item.id)) {
        errors.push(`发现 id 重复：${item.id}`);
      } else {
        ids.add(item.id);
      }
      if (item.kind !== 'cross-project-topic') {
        errors.push(`发现 ${item.id} 的 kind 无效`);
      }
      if (item.nodeIds.length < 2) {
        errors.push(`发现 ${item.id} 至少需要两个节点`);
      }
      if (typeof item.dedupeKey !== 'string' || !item.dedupeKey.trim()) {
        errors.push(`发现 ${item.id} 缺少 dedupeKey`);
      }
      if (typeof item.suppressionKey !== 'string' || !item.suppressionKey.trim()) {
        errors.push(`发现 ${item.id} 缺少 suppressionKey`);
      }
      if (item.identityVersion !== undefined && item.identityVersion !== 1 && item.identityVersion !== 2) {
        errors.push(`发现 ${item.id} 的 identityVersion 无效`);
      }
      if (
        !['none', 'accepted', 'rejected', 'corrected', 'low-value', 'needs-verification'].includes(
          item.feedbackStatus,
        )
      ) {
        errors.push(`发现 ${item.id} 的 feedbackStatus 无效`);
      }
      if (item.feedbackHistory !== undefined && !Array.isArray(item.feedbackHistory)) {
        errors.push(`发现 ${item.id} 的 feedbackHistory 必须是数组`);
      }
      if (Array.isArray(item.feedbackHistory)) {
        for (const event of item.feedbackHistory) {
          if (
            !event ||
            typeof event.id !== 'string' ||
            typeof event.action !== 'string' ||
            ![
              'accepted',
              'rejected',
              'corrected',
              'low-value',
              'needs-verification',
              'undo',
            ].includes(event.action) ||
            typeof event.at !== 'string' ||
            Number.isNaN(Date.parse(event.at))
          ) {
            errors.push(`发现 ${item.id} 的 feedbackHistory 事件无效`);
            break;
          }
        }
      }
      if (
        item.correction !== undefined &&
        (typeof item.correction.title !== 'string' ||
          typeof item.correction.description !== 'string' ||
          typeof item.correction.createdAt !== 'string' ||
          Number.isNaN(Date.parse(item.correction.createdAt)))
      ) {
        errors.push(`发现 ${item.id} 的 correction 无效`);
      }
      if (item.supersededBy !== undefined) {
        if (
          typeof item.supersededBy !== 'string' ||
          !item.supersededBy.trim() ||
          item.supersededBy === item.id
        ) {
          errors.push(`发现 ${item.id} 的 supersededBy 无效`);
        } else if (item.status !== 'dismissed') {
          errors.push(`发现 ${item.id} 的 supersededBy 只能用于 dismissed 记录`);
        }
      }
      if (item.evidence.some((evidence) => !evidence.nodeId.trim() || !item.nodeIds.includes(evidence.nodeId))) {
        errors.push(`发现 ${item.id} 的 evidence.nodeId 无效`);
      }
      if (
        typeof item.createdAt !== 'string' ||
        Number.isNaN(Date.parse(item.createdAt)) ||
        typeof item.updatedAt !== 'string' ||
        Number.isNaN(Date.parse(item.updatedAt))
      ) {
        errors.push(`发现 ${item.id} 的时间戳无效`);
      }
    }
    for (const item of file.discoveries) {
      if (item.supersededBy && !ids.has(item.supersededBy)) {
        errors.push(`发现 ${item.id} 的 supersededBy 指向不存在的记录`);
      }
    }
    return errors;
  }

  save(file: DiscoveryFile): Promise<void> {
    const expectedRaw = this.lastRaw;
    const task = this.saveChain.then(() => this.saveInternal(file, expectedRaw));
    this.saveChain = task.then(
      () => undefined,
      () => undefined,
    );
    return task;
  }

  private async saveInternal(
    file: DiscoveryFile,
    expectedRaw: string | null,
  ): Promise<void> {
    if (this.blockedReason) {
      throw new DiscoveryRepositoryError('blocked', this.blockedReason);
    }

    const errors = this.validate(file);
    if (errors.length > 0) {
      throw new DiscoveryRepositoryError(
        'invalid-data',
        `发现数据校验失败：${errors.slice(0, 10).join('；')}`,
      );
    }

    let current: string | null;
    try {
      current = await this.adapter.read(this.key);
    } catch (error) {
      throw new DiscoveryRepositoryError(
        'conflict',
        `发现数据写前状态读取失败：${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (current !== expectedRaw) {
      throw new DiscoveryRepositoryError(
        'conflict',
        '发现数据已被其他实例更新，拒绝用旧快照覆盖；请重新加载后再保存',
      );
    }

    const payload = {
      discoverySchemaVersion: DISCOVERY_SCHEMA_VERSION,
      identityVersion: file.identityVersion ?? DISCOVERY_IDENTITY_VERSION,
      updatedAt: this.now(),
      discoveries: file.discoveries,
    };

    let text: string;
    try {
      text = JSON.stringify(payload, null, 2);
    } catch (error) {
      throw new DiscoveryRepositoryError(
        'serialize-failed',
        `发现数据序列化失败：${error instanceof Error ? error.message : String(error)}`,
      );
    }

    try {
      await this.adapter.write(this.key, `${text}\n`);
      this.lastRaw = `${text}\n`;
      this.lastPersistStatus = 'succeeded';
    } catch (error) {
      this.lastPersistStatus = 'failed';
      throw error;
    }
  }

  private sanitize(
    parsed: Record<string, unknown>,
    sourceVersion: number,
  ): {
    file: DiscoveryFile;
    issues: string[];
    blockedReason: string | null;
    migration?: DiscoveryMigrationDiagnostics;
  } {
    const now = this.now();
    const discoveries: Discovery[] = [];
    const issues: string[] = [];
    let blockedReason: string | null = null;
    const seen = new Set<string>();

    const block = (reason: string): void => {
      issues.push(reason);
      if (!blockedReason) {
        blockedReason = '发现数据包含无法无损处理的记录，已暂停写入以保护原文件';
      }
    };

    const rawListRaw = parsed.discoveries;
    if (!Array.isArray(rawListRaw)) {
      block('discoveries 字段缺失或不是数组');
      const empty = emptyDiscoveryFile(now);
      if (typeof parsed.updatedAt === 'string') empty.updatedAt = parsed.updatedAt;
      return { file: empty, issues, blockedReason };
    }
    const rawList = rawListRaw;

    for (const raw of rawList) {
      if (!isRecord(raw)) {
        block('发现记录不是对象，已跳过');
        continue;
      }
      const id = typeof raw.id === 'string' ? raw.id : '';
      if (!id) {
        block('发现记录缺少 id，已跳过');
        continue;
      }
      if (seen.has(id)) {
        block(`发现 id 重复：${id}，未自动选择保留哪一条`);
        continue;
      }
      seen.add(id);

      const kind = raw.kind === 'cross-project-topic' ? raw.kind : 'cross-project-topic';
      const nodeIds = asStringArray(raw.nodeIds);
      if (nodeIds.length < 2 || nodeIds.some((nodeId) => !nodeId.trim())) {
        block(`发现 ${id} 的 nodeIds 少于两个节点或包含空节点，已跳过`);
        continue;
      }
      const application = this.sanitizeApplication(raw.application);
      if (!application) {
        block(`发现 ${id} 的 application 字段无效，已暂停写入`);
        continue;
      }

      const projectKeys = asStringArray(raw.projectKeys);
      const subjectKeys = asStringArray(raw.subjectKeys);
      if (projectKeys.length === 0 || projectKeys.some((key) => !key.trim() || /[\\/]/.test(key))) {
        block(`发现 ${id} 的 projectKeys 无效，已跳过`);
        continue;
      }
      const evidence = this.sanitizeEvidence(raw.evidence, nodeIds);
      if (evidence === null) {
        block(`发现 ${id} 的 evidence 结构无效，无法无损迁移`);
        continue;
      }
      const identityVersion =
        typeof raw.identityVersion === 'number'
          ? raw.identityVersion
          : sourceVersion >= DISCOVERY_SCHEMA_VERSION
            ? DISCOVERY_IDENTITY_VERSION
            : 1;
      const createdAt = typeof raw.createdAt === 'string' && raw.createdAt ? raw.createdAt : now;
      const updatedAt = typeof raw.updatedAt === 'string' && raw.updatedAt ? raw.updatedAt : now;
      if (Number.isNaN(Date.parse(createdAt)) || Number.isNaN(Date.parse(updatedAt))) {
        block(`发现 ${id} 的时间戳无效，已跳过`);
        continue;
      }
      const storedDedupeKey =
        typeof raw.dedupeKey === 'string' && raw.dedupeKey ? raw.dedupeKey : null;
      const dedupeKey =
        identityVersion >= 2 && storedDedupeKey
          ? storedDedupeKey
          : dedupeKeyFor(projectKeys, subjectKeys);
      const suppressionKey =
        typeof raw.suppressionKey === 'string' && raw.suppressionKey
          ? raw.suppressionKey
          : suppressionKeyFor(projectKeys, subjectKeys, evidence, id);

      discoveries.push({
        id,
        kind,
        title: typeof raw.title === 'string' ? raw.title : '共同主题',
        description: typeof raw.description === 'string' ? raw.description : '',
        nodeIds,
        projectKeys,
        subjectKeys,
        evidence,
        ruleVersion: typeof raw.ruleVersion === 'string' ? raw.ruleVersion : '',
        strength:
          raw.strength === 'strong' || raw.strength === 'weak'
            ? raw.strength
            : 'moderate',
        dedupeKey,
        suppressionKey,
        identityVersion,
        supersededBy:
          typeof raw.supersededBy === 'string' ? raw.supersededBy : undefined,
        supersededAt:
          typeof raw.supersededAt === 'string' ? raw.supersededAt : undefined,
        status: raw.status === 'dismissed' ? 'dismissed' : 'active',
        feedbackStatus:
          raw.feedbackStatus === 'accepted' ||
          raw.feedbackStatus === 'rejected' ||
          raw.feedbackStatus === 'corrected' ||
          raw.feedbackStatus === 'low-value' ||
          raw.feedbackStatus === 'needs-verification'
            ? raw.feedbackStatus
            : 'none',
        correction: this.sanitizeCorrection(raw.correction),
        feedbackHistory: this.sanitizeFeedbackHistory(raw.feedbackHistory),
        application,
        createdAt,
        updatedAt,
      });
    }

    const ids = new Set(discoveries.map((item) => item.id));
    for (const item of discoveries) {
      if (!item.supersededBy) continue;
      if (item.supersededBy === item.id || !ids.has(item.supersededBy)) {
        item.supersededBy = undefined;
        item.supersededAt = undefined;
      } else {
        // 与 validate() 的契约保持一致：superseded 记录必须是 dismissed。
        item.status = 'dismissed';
      }
    }

    return {
      file: {
        discoverySchemaVersion: DISCOVERY_SCHEMA_VERSION,
        identityVersion: discoveries.some((item) => item.identityVersion !== 2)
          ? 1
          : DISCOVERY_IDENTITY_VERSION,
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : now,
        discoveries,
      },
      issues,
      blockedReason,
      migration: {
        totalRecords: discoveries.length,
        legacyRecords: discoveries.filter((item) => item.identityVersion !== 2).length,
        currentRecords: discoveries.filter((item) => item.identityVersion === 2).length,
        emptyEvidenceRecords: discoveries.filter((item) => item.evidence.length === 0).length,
        supersededRecords: discoveries.filter((item) => Boolean(item.supersededBy)).length,
        persistedInThisInstance: this.lastPersistStatus,
        persistedHistory: 'unknown',
      },
    };
  }

  private sanitizeCorrection(raw: unknown): DiscoveryCorrection | undefined {
    if (!raw || typeof raw !== 'object') return undefined;
    const value = raw as Partial<DiscoveryCorrection>;
    if (
      typeof value.title !== 'string' ||
      typeof value.description !== 'string' ||
      typeof value.createdAt !== 'string' ||
      Number.isNaN(Date.parse(value.createdAt))
    ) {
      return undefined;
    }
    return {
      title: value.title,
      description: value.description,
      createdAt: value.createdAt,
    };
  }

  private sanitizeFeedbackHistory(raw: unknown): DiscoveryFeedbackEvent[] | undefined {
    if (!Array.isArray(raw)) return undefined;
    const allowed = new Set([
      'accepted',
      'rejected',
      'corrected',
      'low-value',
      'needs-verification',
      'undo',
    ]);
    return raw
      .filter((entry): entry is DiscoveryFeedbackEvent => {
        if (!entry || typeof entry !== 'object') return false;
        const value = entry as Partial<DiscoveryFeedbackEvent>;
        return (
          typeof value.id === 'string' &&
          typeof value.action === 'string' &&
          allowed.has(value.action) &&
          typeof value.at === 'string' &&
          !Number.isNaN(Date.parse(value.at)) &&
          typeof value.previousStatus === 'string' &&
          ['none', 'accepted', 'rejected', 'corrected', 'low-value', 'needs-verification'].includes(
            value.previousStatus,
          )
        );
      })
      .map((entry) => ({
        ...entry,
        correction: this.sanitizeCorrection(entry.correction),
      }));
  }

  private sanitizeApplication(raw: unknown): DiscoveryApplication | null {
    if (raw === undefined || raw === null) return emptyDiscoveryApplication();
    if (!isRecord(raw)) return null;
    const state = raw.state;
    if (
      state !== 'none' &&
      state !== 'applying' &&
      state !== 'applied' &&
      state !== 'existing' &&
      state !== 'failed' &&
      state !== 'stale' &&
      state !== 'recovery-required'
    ) {
      return null;
    }

    const readOptional = (key: string): string | undefined =>
      typeof raw[key] === 'string' && raw[key].trim()
        ? raw[key].trim()
        : undefined;

    return {
      state,
      edgeId: readOptional('edgeId'),
      sourceNodeId: readOptional('sourceNodeId'),
      targetNodeId: readOptional('targetNodeId'),
      relation: readOptional('relation'),
      startedAt: readOptional('startedAt'),
      appliedAt: readOptional('appliedAt'),
      updatedAt: readOptional('updatedAt'),
      failureReason: readOptional('failureReason'),
    };
  }

  private sanitizeEvidence(
    raw: unknown,
    nodeIds: readonly string[],
  ): Discovery['evidence'] | null {
    if (raw === undefined) return [];
    if (!Array.isArray(raw)) return null;
    const result: Discovery['evidence'] = [];
    for (const item of raw) {
      if (!isRecord(item)) return null;
      if (
        item.kind !== 'confirmed-edge' &&
        item.kind !== 'shared-tag' &&
        item.kind !== 'source'
      ) {
        return null;
      }
      if (
        typeof item.nodeId !== 'string' ||
        !item.nodeId.trim() ||
        !nodeIds.includes(item.nodeId)
      ) {
        return null;
      }
      if (typeof item.text !== 'string') return null;
      if (item.sourceUri !== undefined && typeof item.sourceUri !== 'string') {
        return null;
      }
      result.push({
        kind: item.kind,
        nodeId: item.nodeId,
        sourceUri: item.sourceUri,
        text: item.text,
      });
    }
    return result;
  }

  private async backupCorrupt(raw: string): Promise<string | null> {
    const task = this.backupChain.then(async () => {
      try {
        for (let attempt = 0; attempt < 8; attempt += 1) {
          const suffix =
            `${Date.now().toString(36)}-${(this.backupSequence++).toString(36)}-` +
            Math.random().toString(36).slice(2, 8);
          const key = `${this.key}.corrupt-${suffix}`;
          // 先确认候选不存在；backupChain 让同一仓库实例的备份串行化。
          if ((await this.adapter.read(key)) === null) {
            await this.adapter.write(key, raw);
            return key;
          }
        }
        console.error('[InterestSeed] 无法生成唯一的发现数据损坏备份文件名');
        return null;
      } catch (error) {
        try {
          console.error('[InterestSeed] 发现数据损坏备份失败', error);
        } catch {
          // 错误记录自身异常也不能影响原文件保护。
        }
        return null;
      }
    });

    this.backupChain = task.then(
      () => undefined,
      () => undefined,
    );
    return task;
  }
}
