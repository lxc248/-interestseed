import { describe, expect, it, vi } from 'vitest';

import { DiscoveryApplicationService, reconcileDiscoveryApplications } from '../src/discovery/application';
import type { DiscoveryApplicationDraft } from '../src/discovery/application';
import { emptyDiscoveryFile, emptyDiscoveryApplication } from '../src/discovery/types';
import type { Discovery, DiscoveryFile } from '../src/discovery/types';
import { GraphSession } from '../src/core/GraphSession';
import { InterestSeedGraphStore } from '../src/core/GraphStore';
import { UndoHistory } from '../src/core/UndoManager';
import { edgeIdFor } from '../src/utils/ids';
import type { InterestSeedEdge, InterestSeedNode } from '../src/types/graph';

const NOW = '2026-01-01T00:00:00.000Z';

function node(id: string, title = id): InterestSeedNode {
  return {
    id,
    type: 'document',
    title,
    tags: [],
    createdAt: NOW,
    updatedAt: NOW,
    metadata: {},
  };
}

function discovery(id = 'd1', feedback: Discovery['feedbackStatus'] = 'accepted'): Discovery {
  return {
    id,
    kind: 'cross-project-topic',
    title: '共同主题：测试',
    description: '测试发现',
    nodeIds: ['a', 'b'],
    projectKeys: ['P1', 'P2'],
    subjectKeys: ['topic'],
    evidence: [{ kind: 'source', nodeId: 'a', sourceUri: 'vault:P1/a.md', text: '来源 A' }],
    ruleVersion: 'v1',
    strength: 'strong',
    dedupeKey: id,
    status: 'active',
    feedbackStatus: feedback,
    application: emptyDiscoveryApplication(),
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function fileWith(item = discovery()): DiscoveryFile {
  const file = emptyDiscoveryFile(NOW);
  file.discoveries.push(item);
  return file;
}

function setup(
  feedback: Discovery['feedbackStatus'] = 'accepted',
  failEnqueueAt?: number,
  conflictAt?: number,
) {
  const store = new InterestSeedGraphStore(undefined, { now: () => NOW });
  const undo = new UndoHistory();
  const session = new GraphSession(store, undo);
  store.addNode(node('a', 'A'));
  store.addNode(node('b', 'B'));
  store.addNode(node('c', 'C'));
  let state = fileWith(discovery('d1', feedback));
  let enqueueCalls = 0;
  const persistence = {
    state: { blocked: false, blockedReason: null, saveFailed: false },
    flush: vi.fn(async () => {}),
  };
  const deps = {
    store,
    session,
    persistence,
    getDiscovery: (id: string) => state.discoveries.find((item) => item.id === id),
    getState: () => state,
    enqueue: async (mutator: (file: DiscoveryFile) => DiscoveryFile) => {
      enqueueCalls += 1;
      if (failEnqueueAt === enqueueCalls) throw new Error('发现保存失败');
      if (conflictAt === enqueueCalls) {
        const error = new Error('发现数据已被其他实例更新') as Error & { code: string };
        error.code = 'conflict';
        throw error;
      }
      state = mutator(state);
    },
  };
  return {
    store,
    session,
    persistence,
    service: new DiscoveryApplicationService(deps),
    getState: () => state,
  };
}

function draft(overrides: Partial<DiscoveryApplicationDraft> = {}): DiscoveryApplicationDraft {
  return {
    sourceNodeId: 'a',
    targetNodeId: 'b',
    relation: 'related-to',
    ...overrides,
  };
}

describe('DiscoveryApplicationService', () => {
  it('未接受的发现不能应用', async () => {
    const { service, store } = setup('none');

    const result = await service.apply('d1', draft());

    expect(result.status).toBe('blocked');
    expect(store.listEdges()).toHaveLength(0);
  });

  it('节点不存在时阻止应用', async () => {
    const { service, store } = setup();

    const result = await service.apply('d1', draft({ targetNodeId: 'missing' }));

    expect(result.status).toBe('blocked');
    expect(store.listEdges()).toHaveLength(0);
  });

  it('源/目标必须来自这条发现', async () => {
    const { service, store } = setup();

    const result = await service.apply('d1', draft({ targetNodeId: 'c' }));

    expect(result.status).toBe('blocked');
    expect(store.listEdges()).toHaveLength(0);
  });

  it('已拒绝或待验证的发现不能应用', async () => {
    for (const feedback of ['rejected', 'needs-verification'] as const) {
      const { service, store } = setup(feedback);
      const result = await service.apply('d1', draft());
      expect(result.status).toBe('blocked');
      expect(store.listEdges()).toHaveLength(0);
    }
  });

  it('用户修改的源、目标、方向和关系名会进入正式关系', async () => {
    const { service, store } = setup();
    const result = await service.apply(
      'd1',
      draft({ sourceNodeId: 'b', targetNodeId: 'a', relation: 'method-source' }),
    );
    expect(result.status).toBe('applied');
    expect(store.listEdges()).toHaveLength(1);
    expect(store.listEdges()[0]).toMatchObject({
      source: 'b',
      target: 'a',
      relation: 'method-source',
      origin: 'user',
      status: 'confirmed',
    });
  });

  it('已应用后重复提交返回 existing 且不新增关系', async () => {
    const { service, store, getState } = setup();
    const first = await service.apply('d1', draft());
    expect(first.status).toBe('applied');
    const second = await service.apply('d1', draft());
    expect(second.status).toBe('existing');
    expect(store.listEdges()).toHaveLength(1);
    expect(getState().discoveries[0]?.application?.state).toBe('existing');
  });

  it('相同 confirmed 关系识别为 existing 且不重复写入', async () => {
    const { service, store, getState } = setup();
    const existing: InterestSeedEdge = {
      id: edgeIdFor('a', 'b', 'related-to'),
      source: 'a',
      target: 'b',
      relation: 'related-to',
      origin: 'user',
      status: 'confirmed',
      createdAt: NOW,
      updatedAt: NOW,
    };
    store.addEdge(existing);

    const result = await service.apply('d1', draft());

    expect(result.status).toBe('existing');
    expect(store.listEdges()).toHaveLength(1);
    expect(getState().discoveries[0]?.application?.state).toBe('existing');
  });

  it('相同 suggested 关系不会被自动确认', async () => {
    const { service, store, getState } = setup();
    store.addEdge({
      id: 'suggested',
      source: 'a',
      target: 'b',
      relation: 'related-to',
      origin: 'rule',
      status: 'suggested',
      evidence: ['测试'],
      createdAt: NOW,
      updatedAt: NOW,
    });

    const result = await service.apply('d1', draft());

    expect(result.status).toBe('blocked');
    expect(store.getEdge('suggested')?.status).toBe('suggested');
    expect(getState().discoveries[0]?.application?.state).toBe('none');
  });

  it('同端点不同关系需要明确确认冲突', async () => {
    const { service, store } = setup();
    store.addEdge({
      id: 'other',
      source: 'a',
      target: 'b',
      relation: 'references',
      origin: 'user',
      status: 'confirmed',
      createdAt: NOW,
      updatedAt: NOW,
    });

    const blocked = await service.apply('d1', draft());
    expect(blocked.status).toBe('blocked');
    expect(store.listEdges()).toHaveLength(1);

    const applied = await service.apply('d1', draft({ confirmConflict: true }));
    expect(applied.status).toBe('applied');
    expect(applied.edgeId).toBe(edgeIdFor('a', 'b', 'related-to'));
    expect(store.listEdges()).toHaveLength(2);
  });

  it('反向关系不默认视为重复，但需要确认', async () => {
    const { service, store } = setup();
    store.addEdge({
      id: 'reverse',
      source: 'b',
      target: 'a',
      relation: 'related-to',
      origin: 'user',
      status: 'confirmed',
      createdAt: NOW,
      updatedAt: NOW,
    });

    const blocked = await service.apply('d1', draft());
    expect(blocked.status).toBe('blocked');

    const applied = await service.apply('d1', draft({ confirmConflict: true }));
    expect(applied.status).toBe('applied');
    expect(applied.edgeId).toBe(edgeIdFor('a', 'b', 'related-to'));
    expect(store.listEdges()).toHaveLength(2);
  });

  it('图谱保存失败不会标记 applied，保留可恢复关系', async () => {
    const { service, store, persistence, getState } = setup();
    persistence.flush.mockImplementation(async () => {
      persistence.state.saveFailed = true;
    });

    const result = await service.apply('d1', draft());

    expect(result.status).toBe('recovery-required');
    expect(getState().discoveries[0]?.application?.state).toBe('recovery-required');
    expect(store.listEdges()).toHaveLength(1);

    persistence.state.saveFailed = false;
    await service.reconcile();
    expect(getState().discoveries[0]?.application?.state).toBe('applied');
  });

  it('图谱已写入但发现状态保存失败时保留可恢复状态', async () => {
    const { service, store, getState } = setup('accepted', 2);

    const result = await service.apply('d1', draft());

    expect(result.status).toBe('recovery-required');
    expect(store.listEdges()).toHaveLength(1);
    expect(getState().discoveries[0]?.application?.state).toBe('applying');

    await service.reconcile();
    expect(getState().discoveries[0]?.application?.state).toBe('applied');
  });

  it('图谱成功但发现保存冲突时明确提示并保留恢复状态', async () => {
    const { service, store, getState } = setup('accepted', undefined, 2);
    const result = await service.apply('d1', draft());
    expect(result.status).toBe('recovery-required');
    expect(result.message).toContain('其他实例');
    expect(store.listEdges()).toHaveLength(1);
    expect(getState().discoveries[0]?.application?.state).toBe('applying');
    await service.reconcile();
    expect(getState().discoveries[0]?.application?.state).toBe('applied');
  });

  it('快速重复提交只执行一次', async () => {
    const { service, store, persistence } = setup();
    let release: (() => void) | undefined;
    let started: (() => void) | undefined;
    const startedPromise = new Promise<void>((resolve) => {
      started = resolve;
    });
    persistence.flush.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          started?.();
          release = resolve;
        }),
    );

    const first = service.apply('d1', draft());
    await startedPromise;
    const second = await service.apply('d1', draft());

    expect(second.status).toBe('blocked');
    release?.();
    await first;
    expect(store.listEdges()).toHaveLength(1);
  });

  it('applied 关系被删除后调和为 stale', async () => {
    const { service, getState } = setup();
    const item = getState().discoveries[0]!;
    item.application = {
      state: 'applied',
      edgeId: 'missing',
      sourceNodeId: 'a',
      targetNodeId: 'b',
      relation: 'related-to',
      appliedAt: NOW,
      updatedAt: NOW,
    };

    await service.reconcile();

    expect(getState().discoveries[0]?.application?.state).toBe('stale');
  });

  it('applying 但关系不存在时标记 failed，不自动重试', () => {
    const { store, getState } = setup();
    const item = getState().discoveries[0]!;
    item.application = {
      state: 'applying',
      edgeId: 'missing',
      sourceNodeId: 'a',
      targetNodeId: 'b',
      relation: 'related-to',
      startedAt: NOW,
      updatedAt: NOW,
    };

    const result = reconcileDiscoveryApplications(getState(), store, NOW);
    expect(result.file.discoveries[0]?.application?.state).toBe('failed');
  });

  it('recovery-required 且关系不存在时收敛为 failed，可显式重试', () => {
    const { store, getState } = setup();
    const item = getState().discoveries[0]!;
    item.application = {
      state: 'recovery-required',
      edgeId: 'missing',
      sourceNodeId: 'a',
      targetNodeId: 'b',
      relation: 'related-to',
      failureReason: '保存结果不确定',
      updatedAt: NOW,
    };

    const result = reconcileDiscoveryApplications(getState(), store, NOW);
    expect(result.file.discoveries[0]?.application?.state).toBe('failed');
    expect(result.file.discoveries[0]?.application?.failureReason).toContain('可主动重试');
  });

  it('applying 的 edgeId 存在时调和为 applied', () => {
    const { store, getState } = setup();
    store.addEdge({
      id: 'edge-stable',
      source: 'a',
      target: 'b',
      relation: 'related-to',
      origin: 'user',
      status: 'confirmed',
      createdAt: NOW,
      updatedAt: NOW,
    });
    const item = getState().discoveries[0]!;
    item.application = {
      state: 'applying',
      edgeId: 'edge-stable',
      sourceNodeId: 'a',
      targetNodeId: 'b',
      relation: 'related-to',
      startedAt: NOW,
      updatedAt: NOW,
    };

    const result = reconcileDiscoveryApplications(getState(), store, NOW);
    expect(result.file.discoveries[0]?.application?.state).toBe('applied');
  });

  it('稳定 edgeId 存在但端点变化时判定为 stale', () => {
    const { store, getState } = setup();
    store.addEdge({
      id: 'edge-stable',
      source: 'b',
      target: 'a',
      relation: 'related-to',
      origin: 'user',
      status: 'confirmed',
      createdAt: NOW,
      updatedAt: NOW,
    });
    const item = getState().discoveries[0]!;
    item.application = {
      state: 'applied',
      edgeId: 'edge-stable',
      sourceNodeId: 'a',
      targetNodeId: 'b',
      relation: 'related-to',
      appliedAt: NOW,
      updatedAt: NOW,
    };

    const result = reconcileDiscoveryApplications(getState(), store, NOW);
    expect(result.file.discoveries[0]?.application?.state).toBe('stale');
  });

  it('关系改名但稳定 edgeId 仍存在时保持 applied', () => {
    const { store, getState } = setup();
    store.addEdge({
      id: 'edge-stable',
      source: 'a',
      target: 'b',
      relation: 'renamed',
      origin: 'user',
      status: 'confirmed',
      createdAt: NOW,
      updatedAt: NOW,
    });
    const item = getState().discoveries[0]!;
    item.application = {
      state: 'applied',
      edgeId: 'edge-stable',
      sourceNodeId: 'a',
      targetNodeId: 'b',
      relation: 'related-to',
      appliedAt: NOW,
      updatedAt: NOW,
    };

    const result = reconcileDiscoveryApplications(getState(), store, NOW);
    expect(result.changed).toBe(false);
    expect(result.file.discoveries[0]?.application?.state).toBe('applied');
  });
});
