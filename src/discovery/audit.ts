import { hash64 } from '../utils/ids';
import { pathFromUri } from '../utils/paths';
import { AuditVaultBinding } from './auditBinding';
import { DISCOVERY_SCHEMA_VERSION } from './types';
import type {
  DiscoveryApplicationState,
  DiscoveryEvidence,
  DiscoveryFeedbackStatus,
} from './types';

export const AUDIT_MAX_ACTIVE = 50;
export const AUDIT_MAX_DISMISSED = 20;
export const AUDIT_MIN_GROUP_DISPLAY = 3;

export type DiscoveryAuditJudgment =
  | 'worth-exploring'
  | 'related-but-low-value'
  | 'irrelevant'
  | 'insufficient-evidence';

export const DISCOVERY_AUDIT_JUDGMENTS: readonly DiscoveryAuditJudgment[] = [
  'worth-exploring',
  'related-but-low-value',
  'irrelevant',
  'insufficient-evidence',
];

/**
 * 这是调用方对“本次统计范围”的声明，不是真实用户授权证明。
 * 真实 Vault 适配器必须在生成此对象前完成显式确认。
 */
export interface DiscoveryAuditScope {
  binding: AuditVaultBinding;
  rangeConfirmed: boolean;
  projectKeys: string[];
  from?: string;
  to?: string;
  includeDismissed: boolean;
  maxActive: number;
  maxDismissed: number;
}

/**
 * 审计专用最小投影。
 * 不包含 id、title、description、nodeId、sourceUri、subjectKeys、evidence.text。
 * projectKeys 仅保留规范化后的顶层键，用于范围过滤，不进入最终格式输出。
 * themeGroupKey 是不可逆的内部统计键，不进入最终格式输出。
 */
export interface DiscoveryAuditProjection {
  status: 'active' | 'dismissed';
  feedbackStatus: DiscoveryFeedbackStatus;
  applicationState: DiscoveryApplicationState;
  superseded: boolean;
  projectKeys: string[];
  updatedAt: string;
  themeGroupKey: string;
  nodeCount: number;
  sourceComplete: boolean;
  confirmedComplete: boolean;
  evidence: {
    source: number;
    sharedTag: number;
    confirmedEdge: number;
  };
}

export interface DiscoveryAuditProjectionSet {
  records: DiscoveryAuditProjection[];
  inputCount: number;
  invalidRecordCount: number;
}

export interface DiscoveryAuditSummary {
  inputCount: number;
  structurallyValidCount: number;
  scopeMatchedCount: number;
  eligibleCount: number;
  sampledCount: number;
  coverage: {
    scope: number | null;
    input: number | null;
  };
  includedActive: number;
  includedDismissed: number;
  excluded: {
    invalidRecord: number;
    outOfScope: number;
    outOfTime: number;
    dismissed: number;
    superseded: number;
  };
  feedback: Record<DiscoveryFeedbackStatus | 'unknown', number>;
  application: Record<DiscoveryApplicationState | 'unknown', number>;
  evidence: {
    source: number;
    sharedTag: number;
    confirmedEdge: number;
    missingSource: number;
    missingConfirmed: number;
  };
  themeActivity: {
    groupCount: number;
    multiGroupCount: number;
    multiGroupCandidateCount: number;
    maxGroupSize: number;
    sizeHistogram: Record<string, number>;
  };
  scope: {
    projectKeyFilterApplied: boolean;
    fromApplied: boolean;
    toApplied: boolean;
    includeDismissed: boolean;
    vaultBound: boolean;
  };
}

export class DiscoveryAuditScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiscoveryAuditScopeError';
  }
}

export class DiscoveryAuditDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiscoveryAuditDataError';
  }
}

export class DiscoveryAuditLimitError extends Error {
  readonly limit: 'active' | 'dismissed';
  readonly actual: number;
  readonly max: number;

  constructor(limit: 'active' | 'dismissed', actual: number, max: number) {
    super(`审计范围超过上限：${limit} ${actual} > ${max}`);
    this.name = 'DiscoveryAuditLimitError';
    this.limit = limit;
    this.actual = actual;
    this.max = max;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validDate(value: unknown): number | null {
  if (typeof value !== 'string' || !value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function validSourceUri(uri: string | undefined): boolean {
  if (typeof uri !== 'string') return false;
  const trimmed = uri.trim();
  if (!trimmed) return false;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return false;
  // 拒绝绝对路径、盘符路径和目录穿越，避免把 Vault 外路径误判为可定位来源。
  if (/^[\\/]/.test(trimmed) || /^[a-zA-Z]:[\\/]/.test(trimmed)) return false;
  if (/(^|[\\/])\.\.([\\/]|$)/.test(trimmed)) return false;
  return pathFromUri(trimmed).length > 0;
}

function normalizeProjectKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes('/') || trimmed.includes('\\')) return null;
  return trimmed;
}

function isFeedbackStatus(value: unknown): value is DiscoveryFeedbackStatus {
  return (
    value === 'none' ||
    value === 'accepted' ||
    value === 'rejected' ||
    value === 'corrected' ||
    value === 'low-value' ||
    value === 'needs-verification'
  );
}

function isApplicationState(value: unknown): value is DiscoveryApplicationState {
  return (
    value === 'none' ||
    value === 'applying' ||
    value === 'applied' ||
    value === 'existing' ||
    value === 'failed' ||
    value === 'stale' ||
    value === 'recovery-required'
  );
}

function isEvidence(value: unknown): value is DiscoveryEvidence {
  if (!isRecord(value)) return false;
  return (
    (value.kind === 'source' ||
      value.kind === 'shared-tag' ||
      value.kind === 'confirmed-edge') &&
    typeof value.nodeId === 'string' &&
    value.nodeId.length > 0 &&
    typeof value.text === 'string' &&
    (value.sourceUri === undefined || typeof value.sourceUri === 'string')
  );
}

/**
 * 将任意原始记录投影为最小审计记录。
 * 校验失败返回 null；不保留任何原始敏感字段。
 * 这是唯一允许从原始发现记录提取审计字段的入口。
 */
export function projectDiscoveryAuditRecord(
  value: unknown,
): DiscoveryAuditProjection | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== 'string' || !value.id.trim()) return null;
  if (value.status !== 'active' && value.status !== 'dismissed') return null;
  if (!isFeedbackStatus(value.feedbackStatus)) return null;
  if (!Array.isArray(value.projectKeys) || value.projectKeys.length === 0) {
    return null;
  }
  const projectKeys: string[] = [];
  for (const key of value.projectKeys) {
    const normalized = normalizeProjectKey(key);
    if (normalized === null) return null;
    projectKeys.push(normalized);
  }
  if (
    !Array.isArray(value.subjectKeys) ||
    !value.subjectKeys.every((key) => typeof key === 'string')
  ) {
    return null;
  }
  if (
    !Array.isArray(value.nodeIds) ||
    value.nodeIds.length < 2 ||
    !value.nodeIds.every(
      (nodeId) => typeof nodeId === 'string' && nodeId.length > 0,
    )
  ) {
    return null;
  }
  if (!Array.isArray(value.evidence) || !value.evidence.every(isEvidence)) {
    return null;
  }
  const createdAt = validDate(value.createdAt);
  const updatedAt = validDate(value.updatedAt);
  if (createdAt === null || updatedAt === null) return null;

  const application = value.application;
  let applicationState: DiscoveryApplicationState = 'none';
  if (application !== undefined) {
    if (!isRecord(application) || !isApplicationState(application.state)) {
      return null;
    }
    applicationState = application.state;
  }

  const nodeIds = value.nodeIds as string[];
  const evidence = value.evidence as DiscoveryEvidence[];
  const source = evidence.filter((item) => item.kind === 'source');
  const confirmed = evidence.filter((item) => item.kind === 'confirmed-edge');
  const sourceComplete = nodeIds.every((nodeId) =>
    source.some(
      (item) => item.nodeId === nodeId && validSourceUri(item.sourceUri),
    ),
  );
  const confirmedComplete = nodeIds.every((nodeId) =>
    confirmed.some((item) => item.nodeId === nodeId),
  );
  const subjectKeys = value.subjectKeys as string[];
  const themeGroupKey = `theme_${hash64([...subjectKeys].sort().join('\u0000'))}`;

  return {
    status: value.status,
    feedbackStatus: value.feedbackStatus,
    applicationState,
    superseded:
      typeof value.supersededBy === 'string' && value.supersededBy.length > 0,
    projectKeys,
    updatedAt: value.updatedAt as string,
    themeGroupKey,
    nodeCount: nodeIds.length,
    sourceComplete,
    confirmedComplete,
    evidence: {
      source: source.length,
      sharedTag: evidence.filter((item) => item.kind === 'shared-tag').length,
      confirmedEdge: confirmed.length,
    },
  };
}

function normalizeScope(scope: DiscoveryAuditScope): {
  projectKeys: Set<string>;
  from: number | null;
  to: number | null;
} {
  if (!scope || typeof scope !== 'object') {
    throw new DiscoveryAuditScopeError('缺少范围声明，拒绝执行聚合审计');
  }
  if (scope.rangeConfirmed !== true) {
    throw new DiscoveryAuditScopeError('范围声明未确认，拒绝执行聚合审计');
  }
  if (!(scope.binding instanceof AuditVaultBinding) || !scope.binding.isActive) {
    throw new DiscoveryAuditScopeError('缺少有效的 Vault 绑定，拒绝执行聚合审计');
  }
  if (!Array.isArray(scope.projectKeys) || scope.projectKeys.length === 0) {
    throw new DiscoveryAuditScopeError('目录范围为空，拒绝执行聚合审计');
  }
  const projectKeys = new Set<string>();
  for (const key of scope.projectKeys) {
    const normalized = normalizeProjectKey(key);
    if (normalized === null) {
      throw new DiscoveryAuditScopeError('目录范围包含空值，拒绝执行聚合审计');
    }
    projectKeys.add(normalized);
  }
  if (typeof scope.includeDismissed !== 'boolean') {
    throw new DiscoveryAuditScopeError('dismissed 纳入选项无效');
  }
  if (
    !Number.isInteger(scope.maxActive) ||
    scope.maxActive < 0 ||
    scope.maxActive > AUDIT_MAX_ACTIVE ||
    !Number.isInteger(scope.maxDismissed) ||
    scope.maxDismissed < 0 ||
    scope.maxDismissed > AUDIT_MAX_DISMISSED
  ) {
    throw new DiscoveryAuditScopeError(
      `采样上限必须在 0–${AUDIT_MAX_ACTIVE}（active）和 0–${AUDIT_MAX_DISMISSED}（dismissed）之间`,
    );
  }
  const from = scope.from === undefined ? null : validDate(scope.from);
  const to = scope.to === undefined ? null : validDate(scope.to);
  if (
    (scope.from !== undefined && from === null) ||
    (scope.to !== undefined && to === null) ||
    (from !== null && to !== null && from > to)
  ) {
    throw new DiscoveryAuditScopeError('时间范围无效');
  }
  return { projectKeys, from, to };
}

function countOrNull(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

/**
 * 纯聚合核心：接受投影后的最小记录，不接触原始 DiscoveryFile。
 * 必须通过 projectDiscoveryAuditRecord() 生成记录；不得直接传入原始对象。
 */
export function buildDiscoveryAuditFromProjection(
  projection: DiscoveryAuditProjectionSet,
  scope: DiscoveryAuditScope,
): DiscoveryAuditSummary {
  const normalizedScope = normalizeScope(scope);
  if (!Array.isArray(projection.records)) {
    throw new DiscoveryAuditDataError('审计投影结构不受支持');
  }

  const excluded = {
    invalidRecord: projection.invalidRecordCount,
    outOfScope: 0,
    outOfTime: 0,
    dismissed: 0,
    superseded: 0,
  };
  const active: DiscoveryAuditProjection[] = [];
  const dismissed: DiscoveryAuditProjection[] = [];
  let structurallyValidCount = 0;
  let scopeMatchedCount = 0;

  for (const record of projection.records) {
    structurallyValidCount += 1;
    if (
      record.projectKeys.length === 0 ||
      record.projectKeys.some(
        (key) => !normalizedScope.projectKeys.has(key),
      )
    ) {
      excluded.outOfScope += 1;
      continue;
    }
    const updated = validDate(record.updatedAt);
    if (updated === null) {
      excluded.invalidRecord += 1;
      structurallyValidCount -= 1;
      continue;
    }
    if (
      (normalizedScope.from !== null && updated < normalizedScope.from) ||
      (normalizedScope.to !== null && updated > normalizedScope.to)
    ) {
      excluded.outOfTime += 1;
      continue;
    }
    scopeMatchedCount += 1;
    if (record.status === 'dismissed') {
      if (record.superseded) {
        excluded.superseded += 1;
      } else if (scope.includeDismissed) {
        dismissed.push(record);
      } else {
        excluded.dismissed += 1;
      }
    } else {
      active.push(record);
    }
  }

  if (active.length > scope.maxActive) {
    throw new DiscoveryAuditLimitError('active', active.length, scope.maxActive);
  }
  if (scope.includeDismissed && dismissed.length > scope.maxDismissed) {
    throw new DiscoveryAuditLimitError(
      'dismissed',
      dismissed.length,
      scope.maxDismissed,
    );
  }

  const eligibleCount = active.length + dismissed.length;
  const selected = [...active, ...dismissed];
  const feedback: Record<DiscoveryFeedbackStatus | 'unknown', number> = {
    none: 0,
    accepted: 0,
    rejected: 0,
    corrected: 0,
    'low-value': 0,
    'needs-verification': 0,
    unknown: 0,
  };
  const application: Record<DiscoveryApplicationState | 'unknown', number> = {
    none: 0,
    applying: 0,
    applied: 0,
    existing: 0,
    failed: 0,
    stale: 0,
    'recovery-required': 0,
    unknown: 0,
  };
  const evidence = {
    source: 0,
    sharedTag: 0,
    confirmedEdge: 0,
    missingSource: 0,
    missingConfirmed: 0,
  };
  const themeSizes = new Map<string, number>();

  for (const record of selected) {
    feedback[record.feedbackStatus] += 1;
    application[record.applicationState] += 1;
    evidence.source += record.evidence.source;
    evidence.sharedTag += record.evidence.sharedTag;
    evidence.confirmedEdge += record.evidence.confirmedEdge;
    if (!record.sourceComplete) evidence.missingSource += 1;
    if (!record.confirmedComplete) evidence.missingConfirmed += 1;
    themeSizes.set(
      record.themeGroupKey,
      (themeSizes.get(record.themeGroupKey) ?? 0) + 1,
    );
  }

  const sizeHistogram: Record<string, number> = {};
  let groupCount = 0;
  let multiGroupCount = 0;
  let multiGroupCandidateCount = 0;
  let maxGroupSize = 0;
  for (const size of themeSizes.values()) {
    groupCount += 1;
    sizeHistogram[String(size)] = (sizeHistogram[String(size)] ?? 0) + 1;
    maxGroupSize = Math.max(maxGroupSize, size);
    if (size > 1) {
      multiGroupCount += 1;
      multiGroupCandidateCount += size;
    }
  }

  return {
    inputCount: projection.inputCount,
    structurallyValidCount,
    scopeMatchedCount,
    eligibleCount,
    sampledCount: selected.length,
    coverage: {
      scope: countOrNull(selected.length, scopeMatchedCount),
      input: countOrNull(selected.length, projection.inputCount),
    },
    includedActive: active.length,
    includedDismissed: dismissed.length,
    excluded,
    feedback,
    application,
    evidence,
    themeActivity: {
      groupCount,
      multiGroupCount,
      multiGroupCandidateCount,
      maxGroupSize,
      sizeHistogram,
    },
    scope: {
      projectKeyFilterApplied: true,
      fromApplied: normalizedScope.from !== null,
      toApplied: normalizedScope.to !== null,
      includeDismissed: scope.includeDismissed,
      vaultBound: true,
    },
  };
}

/**
 * 兼容入口：只用于测试/内部数据，不用于真实 Vault 读取。
 * 它会把每条记录立即投影，不把标题、描述或 evidence 文本传入聚合核心。
 */
export function buildDiscoveryAudit(
  file: unknown,
  scope: DiscoveryAuditScope,
): DiscoveryAuditSummary {
  if (!isRecord(file) || !Array.isArray(file.discoveries)) {
    throw new DiscoveryAuditDataError('发现数据结构不受支持');
  }
  if (
    typeof file.discoverySchemaVersion !== 'number' ||
    file.discoverySchemaVersion < 1 ||
    file.discoverySchemaVersion > DISCOVERY_SCHEMA_VERSION
  ) {
    throw new DiscoveryAuditDataError('不支持的发现 Schema 版本');
  }
  const records: DiscoveryAuditProjection[] = [];
  let invalidRecordCount = 0;
  for (const item of file.discoveries) {
    const record = projectDiscoveryAuditRecord(item);
    if (record) records.push(record);
    else invalidRecordCount += 1;
  }
  return buildDiscoveryAuditFromProjection(
    {
      records,
      inputCount: file.discoveries.length,
      invalidRecordCount,
    },
    scope,
  );
}

function mayShowBreakdown(counts: Record<string, number>, sampledCount: number): boolean {
  if (sampledCount < AUDIT_MIN_GROUP_DISPLAY) return false;
  return Object.values(counts).every((count) => count === 0 || count >= AUDIT_MIN_GROUP_DISPLAY);
}

/**
 * 只输出聚合数字；不输出标题、路径、URI、ID、标签或 evidence 文本。
 * 小于展示阈值时隐藏可能反推单条记录状态的细分分布。
 */
export function formatDiscoveryAudit(summary: DiscoveryAuditSummary): string {
  const lines = [
    '# Discovery Audit',
    '',
    'scope_declared: true',
    'real_user_authorization: false',
    'vault_bound: true',
    `project_filter: ${summary.scope.projectKeyFilterApplied}`,
    `from_filter: ${summary.scope.fromApplied}`,
    `to_filter: ${summary.scope.toApplied}`,
    `include_dismissed: ${summary.scope.includeDismissed}`,
    '',
    `input: ${summary.inputCount}`,
    `structurally_valid: ${summary.structurallyValidCount}`,
    `scope_matched: ${summary.scopeMatchedCount}`,
    `eligible: ${summary.eligibleCount}`,
    `sampled: ${summary.sampledCount}`,
    `coverage_scope: ${summary.coverage.scope === null ? 'n/a' : `${(summary.coverage.scope * 100).toFixed(1)}%`}`,
    `coverage_input: ${summary.coverage.input === null ? 'n/a' : `${(summary.coverage.input * 100).toFixed(1)}%`}`,
    `included_active: ${summary.includedActive}`,
    `included_dismissed: ${summary.includedDismissed}`,
    '',
  ];

  if (summary.sampledCount < AUDIT_MIN_GROUP_DISPLAY) {
    lines.push('excluded_detail: suppressed_small_group');
  } else {
    lines.push(
      `excluded_invalid: ${summary.excluded.invalidRecord}`,
      `excluded_out_of_scope: ${summary.excluded.outOfScope}`,
      `excluded_out_of_time: ${summary.excluded.outOfTime}`,
      `excluded_superseded: ${summary.excluded.superseded}`,
      `excluded_dismissed: ${summary.excluded.dismissed}`,
    );
  }

  const feedbackSafe = mayShowBreakdown(summary.feedback, summary.sampledCount);
  const applicationSafe = mayShowBreakdown(summary.application, summary.sampledCount);
  const themeSafe =
    summary.sampledCount >= AUDIT_MIN_GROUP_DISPLAY &&
    Object.keys(summary.themeActivity.sizeHistogram).every(
      (size) => Number(size) >= AUDIT_MIN_GROUP_DISPLAY,
    );

  if (!feedbackSafe) {
    lines.push('feedback_detail: suppressed_small_group');
  } else {
    lines.push(
      '',
      `feedback_none: ${summary.feedback.none}`,
      `feedback_accepted: ${summary.feedback.accepted}`,
      `feedback_rejected: ${summary.feedback.rejected}`,
      `feedback_corrected: ${summary.feedback.corrected}`,
      `feedback_low_value: ${summary.feedback['low-value']}`,
      `feedback_needs_verification: ${summary.feedback['needs-verification']}`,
      `feedback_unknown: ${summary.feedback.unknown}`,
    );
  }

  if (!applicationSafe) {
    lines.push('application_detail: suppressed_small_group');
  } else {
    lines.push(
      '',
      `application_none: ${summary.application.none}`,
      `application_applying: ${summary.application.applying}`,
      `application_applied: ${summary.application.applied}`,
      `application_existing: ${summary.application.existing}`,
      `application_stale: ${summary.application.stale}`,
      `application_failed: ${summary.application.failed}`,
      `application_recovery_required: ${summary.application['recovery-required']}`,
      `application_unknown: ${summary.application.unknown}`,
    );
  }

  const evidenceSafe = mayShowBreakdown(
    {
      source: summary.evidence.source,
      sharedTag: summary.evidence.sharedTag,
      confirmed: summary.evidence.confirmedEdge,
      missingSource: summary.evidence.missingSource,
      missingConfirmed: summary.evidence.missingConfirmed,
    },
    summary.sampledCount,
  );

  if (!evidenceSafe) {
    lines.push('evidence_detail: suppressed_small_group');
  } else {
    lines.push(
      '',
      `evidence_source: ${summary.evidence.source}`,
      `evidence_shared_tag: ${summary.evidence.sharedTag}`,
      `evidence_confirmed: ${summary.evidence.confirmedEdge}`,
      `evidence_missing_source: ${summary.evidence.missingSource}`,
      `evidence_missing_confirmed: ${summary.evidence.missingConfirmed}`,
    );
  }

  if (!themeSafe) {
    lines.push('theme_detail: suppressed_small_group');
  } else {
    lines.push(
      '',
      `theme_groups: ${summary.themeActivity.groupCount}`,
      `theme_multi_groups: ${summary.themeActivity.multiGroupCount}`,
      `theme_multi_candidates: ${summary.themeActivity.multiGroupCandidateCount}`,
      `theme_max_group_size: ${summary.themeActivity.maxGroupSize}`,
    );
  }

  lines.push(
    '',
    'note: this is a declared scope, not proof of real user authorization.',
    'note: this is not a random representative sample of the whole Vault.',
  );
  return `${lines.join('\n')}\n`;
}
