import { existsSync } from 'node:fs';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DiscoveryEngine } from '../../src/discovery/DiscoveryEngine';
import { sortDiscoveries } from '../../src/discovery/ranking';
import {
  emptyDiscoveryFile,
  type Discovery,
  type DiscoveryFeedbackAction,
  type DiscoveryFile,
} from '../../src/discovery/types';
import type { InterestSeedEdge, InterestSeedGraph } from '../../src/types/graph';
import { edgeIdFor } from '../../src/utils/ids';
import { ensureStateDir, loadState, saveGraph, snapshotGraph, stateDir } from './state';

const FILE = 'discoveries.json';

function pathFor(vaultPath: string): string {
  return join(stateDir(vaultPath), FILE);
}

export async function loadDiscoveries(vaultPath: string): Promise<DiscoveryFile> {
  const path = pathFor(vaultPath);
  if (!existsSync(path)) return emptyDiscoveryFile(new Date().toISOString());
  const raw = (await readFile(path, 'utf8')).replace(/^\uFEFF/, '');
  const parsed = JSON.parse(raw) as Partial<DiscoveryFile>;
  if (!Array.isArray(parsed.discoveries)) {
    throw new Error('Invalid InterestSeed discoveries file');
  }
  return {
    discoverySchemaVersion: parsed.discoverySchemaVersion ?? 3,
    ...(parsed.identityVersion ? { identityVersion: parsed.identityVersion } : {}),
    updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    discoveries: parsed.discoveries,
  };
}

async function saveDiscoveries(vaultPath: string, file: DiscoveryFile): Promise<void> {
  await ensureStateDir(vaultPath);
  const path = pathFor(vaultPath);
  const temp = `${path}.tmp`;
  await writeFile(temp, `${JSON.stringify(file, null, 2)}\n`, 'utf8');
  await rename(temp, path);
}

export async function refreshDiscoveries(vaultPath: string): Promise<Discovery[]> {
  const state = await loadState(vaultPath);
  const previous = await loadDiscoveries(vaultPath);
  const next = new DiscoveryEngine().generate(state.graph, previous);
  await saveDiscoveries(vaultPath, next);
  return sortDiscoveries(next.discoveries.filter((item) => item.status === 'active'));
}

export async function listDiscoveries(vaultPath: string): Promise<Discovery[]> {
  const file = await loadDiscoveries(vaultPath);
  return sortDiscoveries(file.discoveries.filter((item) => item.status === 'active'));
}

export interface DiscoveryActionResult {
  ok: boolean;
  message?: string;
  edge?: InterestSeedEdge;
}

export async function applyDiscovery(
  vaultPath: string,
  id: string,
): Promise<DiscoveryActionResult> {
  const file = await loadDiscoveries(vaultPath);
  const discovery = file.discoveries.find((item) => item.id === id);
  if (!discovery) return { ok: false, message: 'Discovery not found.' };
  const state = await loadState(vaultPath);
  const [sourceId, targetId] = discovery.nodeIds;
  if (!sourceId || !targetId) return { ok: false, message: 'Discovery has no node pair.' };
  const source = state.graph.nodes.find((node) => node.id === sourceId);
  const target = state.graph.nodes.find((node) => node.id === targetId);
  if (!source || !target) return { ok: false, message: 'Node is missing from the graph.' };

  const existing = state.graph.edges.find(
    (edge) =>
      (edge.source === sourceId && edge.target === targetId) ||
      (edge.source === targetId && edge.target === sourceId),
  );
  if (existing) {
    const now = new Date().toISOString();
    if (existing.status !== 'confirmed') {
      const confirmed: InterestSeedEdge = {
        ...existing,
        status: 'confirmed',
        origin: 'rule',
        evidence: [
          ...(existing.evidence ?? []),
          `发现：${discovery.title}`,
          '用户确认',
        ],
        updatedAt: now,
      };
      await snapshotGraph(vaultPath);
      await saveGraph(vaultPath, {
        ...state.graph,
        edges: state.graph.edges.map((edge) => (edge.id === existing.id ? confirmed : edge)),
        updatedAt: now,
      });
      discovery.feedbackStatus = 'accepted';
      discovery.application = {
        state: 'applied',
        edgeId: confirmed.id,
        sourceNodeId: sourceId,
        targetNodeId: targetId,
        relation: confirmed.relation,
        appliedAt: now,
        updatedAt: now,
      };
      discovery.updatedAt = now;
      await saveDiscoveries(vaultPath, file);
      return { ok: true, edge: confirmed };
    }
    discovery.application = {
      state: 'existing',
      edgeId: existing.id,
      sourceNodeId: sourceId,
      targetNodeId: targetId,
      relation: existing.relation,
      updatedAt: now,
    };
    discovery.updatedAt = now;
    await saveDiscoveries(vaultPath, file);
    return { ok: true, edge: existing, message: 'This pair is already connected.' };
  }

  const relation = discovery.subjectKeys.length
    ? `共同主题：${discovery.subjectKeys.map((tag) => `#${tag}`).join('、')}`
    : '共同主题';
  const now = new Date().toISOString();
  const edge: InterestSeedEdge = {
    id: edgeIdFor(sourceId, targetId, relation),
    source: sourceId,
    target: targetId,
    relation,
    origin: 'rule',
    status: 'confirmed',
    evidence: [
      `发现：${discovery.title}`,
      ...discovery.evidence.slice(0, 3).map((item) => item.text),
      '用户确认',
    ],
    createdAt: now,
    updatedAt: now,
  };
  const nextGraph: InterestSeedGraph = {
    ...state.graph,
    edges: [...state.graph.edges, edge],
    updatedAt: now,
  };
  await snapshotGraph(vaultPath);
  await saveGraph(vaultPath, nextGraph);
  discovery.feedbackStatus = 'accepted';
  discovery.application = {
    state: 'applied',
    edgeId: edge.id,
    sourceNodeId: sourceId,
    targetNodeId: targetId,
    relation,
    appliedAt: now,
    updatedAt: now,
  };
  discovery.updatedAt = now;
  await saveDiscoveries(vaultPath, file);
  return { ok: true, edge };
}

export async function dismissDiscovery(
  vaultPath: string,
  id: string,
): Promise<DiscoveryActionResult> {
  const file = await loadDiscoveries(vaultPath);
  const discovery = file.discoveries.find((item) => item.id === id);
  if (!discovery) return { ok: false, message: 'Discovery not found.' };
  const now = new Date().toISOString();
  discovery.status = 'dismissed';
  discovery.feedbackStatus = 'rejected';
  discovery.updatedAt = now;
  discovery.feedbackHistory = [
    ...(discovery.feedbackHistory ?? []),
    { id: `feedback_${Date.now()}`, action: 'rejected', at: now, previousStatus: 'none' },
  ];
  await saveDiscoveries(vaultPath, file);
  return { ok: true };
}

export async function feedbackDiscovery(
  vaultPath: string,
  id: string,
  action: DiscoveryFeedbackAction,
  correction?: string,
): Promise<DiscoveryActionResult> {
  const file = await loadDiscoveries(vaultPath);
  const discovery = file.discoveries.find((item) => item.id === id);
  if (!discovery) return { ok: false, message: 'Discovery not found.' };
  const now = new Date().toISOString();
  const previousStatus = discovery.feedbackStatus;
  discovery.feedbackStatus = action;
  discovery.updatedAt = now;
  discovery.feedbackHistory = [
    ...(discovery.feedbackHistory ?? []),
    { id: `feedback_${Date.now()}`, action, at: now, previousStatus },
  ];
  if (action === 'rejected') {
    discovery.status = 'dismissed';
  } else {
    discovery.status = 'active';
  }
  if (action === 'corrected' && correction?.trim()) {
    discovery.correction = {
      title: discovery.title,
      description: correction.trim(),
      createdAt: now,
    };
  }
  await saveDiscoveries(vaultPath, file);
  return { ok: true };
}

export function discoveryView(discovery: Discovery): Record<string, unknown> {
  return {
    id: discovery.id,
    title: discovery.title,
    description: discovery.description,
    nodeIds: discovery.nodeIds,
    projectKeys: discovery.projectKeys,
    subjectKeys: discovery.subjectKeys,
    evidence: discovery.evidence,
    strength: discovery.strength,
    feedbackStatus: discovery.feedbackStatus,
    status: discovery.status,
    application: discovery.application ?? { state: 'none' },
    ...(discovery.correction ? { correction: discovery.correction } : {}),
    updatedAt: discovery.updatedAt,
  };
}
