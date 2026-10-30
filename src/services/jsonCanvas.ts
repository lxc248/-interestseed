import type { InterestSeedGraph, InterestSeedNode } from '../types/graph';

export interface JsonCanvasNode {
  id: string;
  type: 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  color?: string;
}

export interface JsonCanvasEdge {
  id: string;
  fromNode: string;
  toNode: string;
  fromSide?: 'top' | 'right' | 'bottom' | 'left';
  toSide?: 'top' | 'right' | 'bottom' | 'left';
  label?: string;
}

export interface JsonCanvas {
  nodes: JsonCanvasNode[];
  edges: JsonCanvasEdge[];
}

function fnv1a(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function hexId(seed: string): string {
  // Two independent 32-bit FNV-1a hashes form a 64-bit ID. The previous LCG
  // only exposed the low nibble, whose period is 16, so large vaults collapsed
  // to at most 16 unique Canvas IDs.
  const first = fnv1a(`a:${seed}`).toString(16).padStart(8, '0');
  const second = fnv1a(`b:${seed}`).toString(16).padStart(8, '0');
  return `${first}${second}`;
}

function typeLabel(node: InterestSeedNode): string {
  const labels: Record<string, string> = {
    project: '项目',
    document: '文档',
    topic: '主题',
    image: '图片',
    audio: '音频',
    video: '视频',
    activity: '活动',
  };
  return labels[node.type] ?? '兴趣';
}

function typeColor(node: InterestSeedNode): string | undefined {
  const colors: Record<string, string> = {
    project: '6',
    document: '5',
    topic: '1',
    image: '3',
    audio: '2',
    video: '2',
    activity: '4',
  };
  return colors[node.type];
}

function taskLine(node: InterestSeedNode): string {
  const state = node.metadata?.taskState;
  if (typeof state === 'string') return `状态：${state}`;
  if (node.metadata?.nextStep === true) return '状态：experimenting';
  return '';
}

/**
 * Build a JSON Canvas 1.0 document from the local interest graph.
 *
 * The export is deterministic and read-only with respect to the graph. It is
 * not a screenshot: Obsidian Canvas renders the resulting .canvas file.
 */
export function buildJsonCanvas(graph: InterestSeedGraph): JsonCanvas {
  const columns = 3;
  const nodeWidth = 300;
  const nodeHeight = 150;
  const gapX = 60;
  const gapY = 60;
  const margin = 80;

  const canvasIds = new Map<string, string>();
  const nodes: JsonCanvasNode[] = graph.nodes.map((node, index) => {
    const id = hexId(`node:${node.id}`);
    canvasIds.set(node.id, id);
    const col = index % columns;
    const row = Math.floor(index / columns);
    const lines = [
      node.title,
      `类型：${typeLabel(node)}`,
      taskLine(node),
    ].filter(Boolean);
    if (node.tags.length > 0) lines.push(`标签：${node.tags.slice(0, 5).join('、')}`);
    return {
      id,
      type: 'text',
      x: margin + col * (nodeWidth + gapX),
      y: margin + row * (nodeHeight + gapY),
      width: nodeWidth,
      height: nodeHeight,
      text: lines.join('\n'),
      color: typeColor(node),
    };
  });

  const edges: JsonCanvasEdge[] = graph.edges
    .filter((edge) => edge.status !== 'rejected')
    .map((edge, index) => ({
      id: hexId(`edge:${edge.id}:${index}`),
      fromNode: canvasIds.get(edge.source) ?? '',
      toNode: canvasIds.get(edge.target) ?? '',
      fromSide: 'right' as const,
      toSide: 'left' as const,
      label: edge.relation || '连接',
    }))
    .filter((edge) => edge.fromNode !== '' && edge.toNode !== '');

  return { nodes, edges };
}
