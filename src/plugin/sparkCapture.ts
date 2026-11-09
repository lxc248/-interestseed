import { Notice } from 'obsidian';
import type { GraphSession } from '../core/GraphSession';
import { appendObservation } from '../core/observations';
import { analyzeShareText, describeSpark, isVideoSpark } from '../services/shareAnalysis';
import { edgeIdFor, hashString, nodeIdForUri } from '../utils/ids';

export function captureInterestSpark(input: {
  text: string;
  targetId?: string;
  why?: string;
  context?: { source?: string; sourceRef?: string };
  getNode: (id: string) => unknown;
  addNode: (node: Parameters<GraphSession['addNode']>[0], message: string) => void;
  addEdge: (edge: Parameters<GraphSession['addEdge']>[0], message: string) => void;
  invalidateInsights: () => void;
  notifyStatus: () => void;
  persist: () => void;
  setSelectedNode: (id: string) => void;
}): string | null {
  const value = input.text.trim();
  const title = describeSpark(value);
  if (!title) {
    new Notice('先写下一句话，或粘贴一个链接。');
    return null;
  }
  const url = value.match(/https?:\/\/[^\s]+/i)?.[0];
  const id = nodeIdForUri(`interestseed://spark/${hashString(value.toLowerCase())}`);
  if (input.getNode(id)) {
    new Notice('这个火花已经在图谱里了。');
    return id;
  }
  const now = new Date().toISOString();
  const video = isVideoSpark(value);
  const analysis = analyzeShareText(value);
  input.addNode(
    {
      id,
      type: video ? 'video' : 'topic',
      title,
      ...(url ? { sourceUri: url } : {}),
      tags: ['火花', video ? '视频' : '文本', ...analysis.topics],
      createdAt: now,
      updatedAt: now,
      metadata: {
        spark: true,
        raw: value,
        capturedAt: now,
        platform: analysis.platform,
        topics: analysis.topics,
        taskState: input.targetId ? 'connected' : 'captured',
        taskStateUpdatedAt: now,
        contextSource: input.context?.source ?? 'share',
        ...(input.context?.sourceRef ? { contextSourceRef: input.context.sourceRef } : {}),
        observations: appendObservation(undefined, {
          source: input.context?.source ?? 'share',
          ...(input.context?.sourceRef ? { sourceRef: input.context.sourceRef } : {}),
          evidence: value.slice(0, 280),
          belief: 'changed',
        }),
        ...(input.why?.trim() ? { why: input.why.trim() } : {}),
      },
    },
    '种下一个兴趣火花',
  );
  if (input.targetId && input.getNode(input.targetId)) {
    input.addEdge(
      {
        id: edgeIdFor(input.targetId, id, '引出'),
        source: input.targetId,
        target: id,
        relation: '引出',
        origin: 'user',
        status: 'confirmed',
        evidence: ['来自你的火花捕获'],
        createdAt: now,
        updatedAt: now,
      },
      '把火花连接到已有兴趣',
    );
  }
  input.invalidateInsights();
  input.notifyStatus();
  input.persist();
  input.setSelectedNode(id);
  return id;
}
