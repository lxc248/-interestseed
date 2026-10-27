/**
 * InterestSeed 发现领域模型（独立于图谱 Schema）。
 *
 * 本模型只用于“发现”功能，不修改 InterestSeedGraph 或 GRAPH_SCHEMA_VERSION。
 * 全部时间戳为 ISO 8601 字符串。
 */

export const DISCOVERY_SCHEMA_VERSION = 3;
export const LEGACY_DISCOVERY_SCHEMA_VERSION = 2;
export const DISCOVERY_IDENTITY_VERSION = 2;

export type DiscoveryKind = 'cross-project-topic';

export type DiscoveryApplicationState =
  | 'none'
  | 'applying'
  | 'applied'
  | 'existing'
  | 'failed'
  | 'stale'
  | 'recovery-required';

export interface DiscoveryApplication {
  state: DiscoveryApplicationState;
  edgeId?: string;
  sourceNodeId?: string;
  targetNodeId?: string;
  relation?: string;
  startedAt?: string;
  appliedAt?: string;
  updatedAt?: string;
  failureReason?: string;
}

export function emptyDiscoveryApplication(): DiscoveryApplication {
  return { state: 'none' };
}

export type DiscoveryFeedbackAction =
  | 'accepted'
  | 'rejected'
  | 'corrected'
  | 'low-value'
  | 'needs-verification';

export type DiscoveryFeedbackStatus =
  | 'none'
  | 'accepted'
  | 'rejected'
  | 'corrected'
  | 'low-value'
  | 'needs-verification';

export interface DiscoveryCorrection {
  title: string;
  description: string;
  createdAt: string;
}

export interface DiscoveryFeedbackEvent {
  id: string;
  action: DiscoveryFeedbackAction | 'undo';
  at: string;
  previousStatus: DiscoveryFeedbackStatus;
  correction?: DiscoveryCorrection;
}

export type DiscoveryStatus = 'active' | 'dismissed';

export interface DiscoveryEvidence {
  kind: 'confirmed-edge' | 'shared-tag' | 'source';
  nodeId: string;
  sourceUri?: string;
  text: string;
}

export interface Discovery {
  id: string;
  kind: DiscoveryKind;
  title: string;
  description: string;
  nodeIds: string[];
  /** 推定项目分组：来自 metadata.path 顶层目录，不等于用户确认的项目实体。 */
  projectKeys: string[];
  /** 规范化后的共享标签 key。 */
  subjectKeys: string[];
  evidence: DiscoveryEvidence[];
  ruleVersion: string;
  strength: 'strong' | 'moderate' | 'weak';
  dedupeKey: string;
  /** 拒绝抑制范围；旧记录缺失时由仓库迁移计算。 */
  suppressionKey?: string;
  /** 1=旧身份，2=三键分离身份。 */
  identityVersion?: number;
  /** 系统因同槽收敛隐藏的重复记录；不表示用户拒绝。 */
  supersededBy?: string;
  supersededAt?: string;
  status: DiscoveryStatus;
  feedbackStatus: DiscoveryFeedbackStatus;
  /** v2 应用状态；缺失按 none 处理，兼容旧数据。 */
  application?: DiscoveryApplication;
  /** 用户修正内容；保留原发现文本，不覆盖 title/description。 */
  correction?: DiscoveryCorrection;
  /** 反馈事件历史；用于软撤销和追溯。 */
  feedbackHistory?: DiscoveryFeedbackEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface DiscoveryFile {
  discoverySchemaVersion: number;
  identityVersion?: number;
  updatedAt: string;
  discoveries: Discovery[];
}

export function emptyDiscoveryFile(now: string): DiscoveryFile {
  return {
    discoverySchemaVersion: DISCOVERY_SCHEMA_VERSION,
    identityVersion: DISCOVERY_IDENTITY_VERSION,
    updatedAt: now,
    discoveries: [],
  };
}

export function isDiscoveryFeedbackAction(
  value: unknown,
): value is DiscoveryFeedbackAction {
  return (
    value === 'accepted' || value === 'rejected' || value === 'needs-verification'
  );
}
