import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  buildRelationRequest,
  createModelProvider,
  type AiRelationSuggestion,
} from '../../src/services/ModelProvider';
import type { InterestSeedEdge, InterestSeedGraph } from '../../src/types/graph';
import { edgeIdFor } from '../../src/utils/ids';
import { loadConfig, loadState, saveGraph, snapshotGraph, type StandaloneConfig } from './state';

export async function resolveApiKey(
  vaultPath: string,
  config: StandaloneConfig,
): Promise<string | undefined> {
  const allowedKeyEnv = 'INTERESTSEED_AI_API_KEY';
  const envValue = config.keyEnv === allowedKeyEnv ? process.env[allowedKeyEnv] : undefined;
  if (envValue?.trim()) return envValue.trim();
  const local = join(vaultPath, '.interestseed', 'key');
  if (existsSync(local)) {
    const value = (await readFile(local, 'utf8')).trim();
    if (value) return value;
  }
  return undefined;
}

/**
 * AI 未就绪（缺 key / 未启用 / 未同意）属于客户端可修复的状态，
 * 不是服务端故障。服务端据此返回 409 而不是 500，让界面能显示可操作提示。
 */
export class AiPreconditionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiPreconditionError';
  }
}

export async function suggestRelations(
  vaultPath: string,
  focusNodeId?: string,
): Promise<AiRelationSuggestion[]> {
  const config = await loadConfig(vaultPath);
  const state = await loadState(vaultPath);
  const key = await resolveApiKey(vaultPath, config);
  if (!key) {
    throw new AiPreconditionError(
      `Missing API key. Set ${config.keyEnv} or write .interestseed/key.`,
    );
  }
  if (!config.enableAI) {
    throw new AiPreconditionError('AI 已关闭，请先在设置里启用。');
  }
  if (!config.aiConsentGranted) {
    throw new AiPreconditionError('还没有确认 AI 请求边界，请先在设置里同意。');
  }

  const request = buildRelationRequest(state.graph.nodes, {
    focusNodeId,
    existingEdges: state.graph.edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
    })),
    maxSuggestions: 5,
  });
  const provider = createModelProvider(
    {
      enableAI: config.enableAI,
      aiConsentGranted: config.aiConsentGranted,
      model: config.model,
      baseUrl: config.baseUrl,
    },
    undefined,
    key,
  );
  try {
    const result = await provider.suggestRelations(request);
    return (result as { suggestions?: AiRelationSuggestion[] }).suggestions ?? [];
  } finally {
    provider.dispose();
  }
}

export interface ConnectResult {
  ok: boolean;
  edge?: InterestSeedEdge;
  message?: string;
}

export async function connectSuggestion(
  vaultPath: string,
  suggestion: AiRelationSuggestion,
): Promise<ConnectResult> {
  const state = await loadState(vaultPath);
  const graph = state.graph;
  const source = graph.nodes.find((node) => node.id === suggestion.source);
  const target = graph.nodes.find((node) => node.id === suggestion.target);
  if (!source || !target) return { ok: false, message: 'Source or target node is missing.' };
  if (source.id === target.id) return { ok: false, message: 'Self-loops are not supported.' };
  const relation = suggestion.relation.trim();
  if (!relation) return { ok: false, message: 'Relation name is empty.' };
  const duplicate = graph.edges.some(
    (edge) =>
      (edge.source === source.id && edge.target === target.id) ||
      (edge.source === target.id && edge.target === source.id),
  );
  if (duplicate) return { ok: false, message: 'This pair is already connected.' };

  const now = new Date().toISOString();
  const edge: InterestSeedEdge = {
    id: edgeIdFor(source.id, target.id, relation),
    source: source.id,
    target: target.id,
    relation,
    origin: 'ai',
    status: 'confirmed',
    ...(typeof suggestion.confidence === 'number'
      ? { confidence: suggestion.confidence }
      : {}),
    evidence: suggestion.reason
      ? [`AI 建议：${suggestion.reason.slice(0, 160)}`, '用户确认']
      : ['AI 建议，用户确认'],
    createdAt: now,
    updatedAt: now,
  };
  const next: InterestSeedGraph = {
    ...graph,
    edges: [...graph.edges, edge],
    updatedAt: now,
  };
  await snapshotGraph(vaultPath);
  await saveGraph(vaultPath, next);
  return { ok: true, edge };
}
