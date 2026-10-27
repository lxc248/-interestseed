import type { InterestSeedEdge } from '../types/graph';
import type { InterestSeedGraphStore } from '../core/GraphStore';
import type { GraphSession } from '../core/GraphSession';
import type { PersistenceState } from '../plugin/PersistenceService';
import { edgeIdFor } from '../utils/ids';
import type {
  Discovery,
  DiscoveryApplication,
  DiscoveryApplicationState,
  DiscoveryFile,
} from './types';

export interface DiscoveryApplicationDraft {
  sourceNodeId: string;
  targetNodeId: string;
  relation: string;
  /** 用户已确认反向/同端点其他关系冲突。 */
  confirmConflict?: boolean;
}

export interface DiscoveryApplicationEdgeInfo {
  id: string;
  source: string;
  target: string;
  relation: string;
  status: InterestSeedEdge['status'];
  direction: 'forward' | 'reverse';
}

export type DiscoveryApplicationPreviewKind =
  | 'ok'
  | 'existing'
  | 'conflict'
  | 'blocked'
  | 'invalid';

export interface DiscoveryApplicationPreview {
  kind: DiscoveryApplicationPreviewKind;
  reason: string;
  edgeId?: string;
  conflicts: DiscoveryApplicationEdgeInfo[];
}

export type DiscoveryApplicationResultStatus =
  | 'applied'
  | 'existing'
  | 'blocked'
  | 'failed'
  | 'recovery-required';

export interface DiscoveryApplicationResult {
  status: DiscoveryApplicationResultStatus;
  message: string;
  edgeId?: string;
}

interface PersistencePort {
  readonly state: PersistenceState;
  flush(): Promise<void>;
}

export interface DiscoveryApplicationDeps {
  store: InterestSeedGraphStore;
  session: GraphSession;
  persistence: PersistencePort;
  getDiscovery(id: string): Discovery | undefined;
  getState(): DiscoveryFile;
  enqueue(mutator: (file: DiscoveryFile) => DiscoveryFile): Promise<void>;
  now?: () => string;
}

function normalizeRelation(value: string): string {
  return value.trim();
}

function isUsableApplicationState(state: DiscoveryApplicationState): boolean {
  return state === 'applying' || state === 'recovery-required';
}

function edgeInfo(
  edge: InterestSeedEdge,
  sourceNodeId: string,
  targetNodeId: string,
): DiscoveryApplicationEdgeInfo {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    relation: edge.relation,
    status: edge.status,
    direction:
      edge.source === sourceNodeId && edge.target === targetNodeId
        ? 'forward'
        : 'reverse',
  };
}

function matchesApplicationEdge(
  edge: InterestSeedEdge,
  application: DiscoveryApplication,
): boolean {
  if (!application.sourceNodeId || !application.targetNodeId) return true;
  return (
    edge.source === application.sourceNodeId &&
    edge.target === application.targetNodeId
  );
}

/** 只更新发现应用状态，不触碰反馈、证据或稳定 ID。 */
export function updateDiscoveryApplication(
  file: DiscoveryFile,
  id: string,
  application: DiscoveryApplication,
): DiscoveryFile {
  if (!file.discoveries.some((item) => item.id === id)) return file;
  return {
    ...file,
    updatedAt: file.updatedAt,
    discoveries: file.discoveries.map((item) =>
      item.id === id
        ? {
            ...item,
            application,
            updatedAt: application.updatedAt ?? item.updatedAt,
          }
        : item,
    ),
  };
}

/** 调和发现应用状态与当前图谱；不写图谱。 */
export function reconcileDiscoveryApplications(
  file: DiscoveryFile,
  store: InterestSeedGraphStore,
  now: string,
): { file: DiscoveryFile; changed: boolean } {
  let changed = false;
  const discoveries = file.discoveries.map((discovery) => {
    const application = discovery.application;
    if (!application || application.state === 'none') return discovery;

    const edge = application.edgeId ? store.getEdge(application.edgeId) : undefined;
    const endpointMatches = edge ? matchesApplicationEdge(edge, application) : false;
    let nextState: DiscoveryApplicationState | null = null;
    let nextFailureReason = application.failureReason;

    if (application.state === 'applied' || application.state === 'existing') {
      if (!edge || !endpointMatches) nextState = 'stale';
    } else if (isUsableApplicationState(application.state)) {
      if (edge && endpointMatches) {
        nextState = 'applied';
        nextFailureReason = undefined;
      } else if (edge && !endpointMatches) {
        nextState = 'recovery-required';
        nextFailureReason = '稳定 edgeId 存在，但源/目标端点与记录不一致';
      } else {
        // 图谱已成功加载且目标 edgeId 不存在：不再猜测“可能已写入”，
        // 允许用户在看到明确失败状态后主动重试。
        nextState = 'failed';
        nextFailureReason = '目标关系不存在，已确认未应用；可主动重试';
      }
    } else if (application.state === 'stale') {
      if (edge && endpointMatches) {
        nextState = 'applied';
        nextFailureReason = undefined;
      }
    }

    if (!nextState || nextState === application.state) return discovery;
    changed = true;
    return {
      ...discovery,
      application: {
        ...application,
        state: nextState,
        failureReason: nextFailureReason,
        updatedAt: now,
      },
      updatedAt: now,
    };
  });

  return {
    file: changed ? { ...file, updatedAt: now, discoveries } : file,
    changed,
  };
}

/**
 * 应用发现到图谱。
 *
 * 关键约束：
 * - 只通过 GraphSession.addEdge 写图谱；
 * - 图谱保存结果由 PersistenceService.state 判定；
 * - 图谱与发现不是一个事务，应用状态必须可恢复。
 */
interface DiscoveryApplicationPersistResult {
  ok: boolean;
  conflict: boolean;
}

export class DiscoveryApplicationService {
  private readonly inFlight = new Set<string>();

  constructor(private readonly deps: DiscoveryApplicationDeps) {}

  private now(): string {
    return this.deps.now?.() ?? new Date().toISOString();
  }

  preview(
    id: string,
    draft: DiscoveryApplicationDraft,
  ): DiscoveryApplicationPreview {
    const discovery = this.deps.getDiscovery(id);
    if (!discovery) {
      return { kind: 'invalid', reason: '发现不存在', conflicts: [] };
    }
    if (discovery.status !== 'active') {
      return { kind: 'blocked', reason: '该发现已被抑制，不能应用', conflicts: [] };
    }
    if (discovery.feedbackStatus !== 'accepted') {
      return { kind: 'blocked', reason: '请先接受这条发现，再应用到图谱', conflicts: [] };
    }
    if (
      discovery.application &&
      isUsableApplicationState(discovery.application.state)
    ) {
      return {
        kind: 'blocked',
        reason: '这条发现已有未完成的应用，请先检查恢复状态',
        conflicts: [],
      };
    }

    const sourceNodeId = draft.sourceNodeId.trim();
    const targetNodeId = draft.targetNodeId.trim();
    const relation = normalizeRelation(draft.relation);
    if (!sourceNodeId || !targetNodeId || sourceNodeId === targetNodeId) {
      return { kind: 'invalid', reason: '请选择两个不同的有效节点', conflicts: [] };
    }
    if (!relation) {
      return { kind: 'invalid', reason: '关系名称不能为空', conflicts: [] };
    }
    const source = this.deps.store.getNode(sourceNodeId);
    const target = this.deps.store.getNode(targetNodeId);
    if (!source || !target) {
      return { kind: 'invalid', reason: '源节点或目标节点已不存在', conflicts: [] };
    }
    const allowedNodes = new Set(discovery.nodeIds);
    if (!allowedNodes.has(sourceNodeId) || !allowedNodes.has(targetNodeId)) {
      return {
        kind: 'invalid',
        reason: '源节点和目标节点必须来自这条发现',
        conflicts: [],
      };
    }

    const exact = this.deps.store.findEdge(sourceNodeId, targetNodeId, relation);
    if (exact) {
      if (exact.status === 'confirmed') {
        return {
          kind: 'existing',
          reason: '相同关系已存在，不会重复创建',
          edgeId: exact.id,
          conflicts: [],
        };
      }
      return {
        kind: 'blocked',
        reason:
          exact.status === 'suggested'
            ? '相同关系是建议关系，请先在关系收件箱确认'
            : '相同关系已被拒绝，不能由应用操作直接恢复',
        conflicts: [edgeInfo(exact, sourceNodeId, targetNodeId)],
      };
    }

    const conflicts = this.deps.store
      .listEdges()
      .filter(
        (edge) =>
          (edge.source === sourceNodeId && edge.target === targetNodeId) ||
          (edge.source === targetNodeId && edge.target === sourceNodeId),
      )
      .map((edge) => edgeInfo(edge, sourceNodeId, targetNodeId));

    if (conflicts.length > 0 && !draft.confirmConflict) {
      return {
        kind: 'conflict',
        reason: '两端点之间已有关系；请检查并明确确认后再创建不同关系',
        conflicts,
      };
    }

    return { kind: 'ok', reason: '可以应用到图谱', conflicts };
  }

  async apply(
    id: string,
    draft: DiscoveryApplicationDraft,
  ): Promise<DiscoveryApplicationResult> {
    if (this.inFlight.has(id)) {
      return { status: 'blocked', message: '这条发现正在应用，请勿重复提交' };
    }

    const preview = this.preview(id, draft);
    if (preview.kind === 'existing') {
      const saved = await this.persistApplication(id, {
        state: 'existing',
        edgeId: preview.edgeId,
        sourceNodeId: draft.sourceNodeId.trim(),
        targetNodeId: draft.targetNodeId.trim(),
        relation: draft.relation.trim(),
        appliedAt: this.now(),
        updatedAt: this.now(),
      });
      return saved.ok
        ? {
            status: 'existing',
            message: preview.reason,
            edgeId: preview.edgeId,
          }
        : {
            status: 'recovery-required',
            message: saved.conflict
              ? '关系已存在，但发现数据已被其他实例更新；请重载插件后核对'
              : '关系已存在，但发现应用状态保存失败，请重载后检查',
            edgeId: preview.edgeId,
          };
    }
    if (preview.kind === 'blocked' || preview.kind === 'conflict' || preview.kind === 'invalid') {
      return { status: 'blocked', message: preview.reason };
    }

    this.inFlight.add(id);
    const sourceNodeId = draft.sourceNodeId.trim();
    const targetNodeId = draft.targetNodeId.trim();
    const relation = draft.relation.trim();
    const edgeId = edgeIdFor(sourceNodeId, targetNodeId, relation);
    const startedAt = this.now();

    try {
      const savedIntent = await this.persistApplication(id, {
        state: 'applying',
        edgeId,
        sourceNodeId,
        targetNodeId,
        relation,
        startedAt,
        updatedAt: startedAt,
      });
      if (!savedIntent.ok) {
        return {
          status: 'recovery-required',
          message: savedIntent.conflict
            ? '发现数据已被其他实例更新，未写入图谱；请重载插件后再应用'
            : '无法持久化应用意图，未写入图谱',
          edgeId,
        };
      }

      const now = this.now();
      const edge: InterestSeedEdge = {
        id: edgeId,
        source: sourceNodeId,
        target: targetNodeId,
        relation,
        origin: 'user',
        status: 'confirmed',
        confidence: 1,
        evidence: this.deps.getDiscovery(id)?.evidence.map((item) => item.text).slice(0, 3) ?? [
          '从发现应用',
        ],
        createdAt: now,
        updatedAt: now,
      };

      try {
        this.deps.session.addEdge(edge, `应用发现「${relation}」`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const existing = this.deps.store.findEdge(sourceNodeId, targetNodeId, relation);
        if (existing?.status === 'confirmed') {
          await this.persistApplication(id, {
            state: 'existing',
            edgeId: existing.id,
            sourceNodeId,
            targetNodeId,
            relation,
            appliedAt: this.now(),
            updatedAt: this.now(),
          });
          return {
            status: 'existing',
            message: '关系已存在，未重复创建',
            edgeId: existing.id,
          };
        }
        await this.persistApplication(id, {
          state: 'failed',
          edgeId,
          sourceNodeId,
          targetNodeId,
          relation,
          failureReason: message,
          updatedAt: this.now(),
        });
        return { status: 'failed', message: `创建关系失败：${message}`, edgeId };
      }

      let flushError: unknown;
      try {
        await this.deps.persistence.flush();
      } catch (error) {
        flushError = error;
      }
      const persistenceState = this.deps.persistence.state;
      if (persistenceState.blocked || persistenceState.saveFailed || flushError) {
        const reason =
          persistenceState.blocked
            ? persistenceState.blockedReason ?? '图谱处于阻止写入状态'
            : '图谱保存失败或结果不确定，请重载后检查';
        await this.persistApplication(id, {
          state: 'recovery-required',
          edgeId,
          sourceNodeId,
          targetNodeId,
          relation,
          failureReason: reason,
          updatedAt: this.now(),
        });
        return {
          status: 'recovery-required',
          message: reason,
          edgeId,
        };
      }

      const created = this.deps.store.getEdge(edgeId);
      if (!created) {
        await this.persistApplication(id, {
          state: 'recovery-required',
          edgeId,
          sourceNodeId,
          targetNodeId,
          relation,
          failureReason: '图谱保存后未找到目标关系',
          updatedAt: this.now(),
        });
        return {
          status: 'recovery-required',
          message: '图谱保存后未找到目标关系，请重载后检查',
          edgeId,
        };
      }

      const saved = await this.persistApplication(id, {
        state: 'applied',
        edgeId,
        sourceNodeId,
        targetNodeId,
        relation,
        appliedAt: this.now(),
        updatedAt: this.now(),
      });
      if (!saved.ok) {
        return {
          status: 'recovery-required',
          message: saved.conflict
            ? '图谱关系已保存，但发现数据已被其他实例更新；请重载插件后核对'
            : '图谱关系已保存，但发现应用状态保存失败；请重载后核对',
          edgeId,
        };
      }
      return {
        status: 'applied',
        message: '已创建 confirmed 关系',
        edgeId,
      };
    } finally {
      this.inFlight.delete(id);
    }
  }

  async reconcile(): Promise<void> {
    if (this.deps.persistence.state.blocked) return;
    await this.deps.enqueue((state) => {
      const result = reconcileDiscoveryApplications(state, this.deps.store, this.now());
      return result.changed ? result.file : state;
    });
  }

  private async persistApplication(
    id: string,
    application: DiscoveryApplication,
  ): Promise<DiscoveryApplicationPersistResult> {
    try {
      await this.deps.enqueue((file) =>
        updateDiscoveryApplication(file, id, application),
      );
      return { ok: true, conflict: false };
    } catch (error) {
      const conflict =
        error instanceof Error &&
        'code' in error &&
        (error as { code?: unknown }).code === 'conflict';
      return { ok: false, conflict };
    }
  }
}
