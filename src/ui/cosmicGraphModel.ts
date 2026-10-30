import type {
  InterestSeedEdge,
  InterestSeedNode,
  NodeType,
} from '../types/graph';

export interface CosmicNode extends InterestSeedNode {
  x: number;
  y: number;
  radius: number;
  degree: number;
  cluster: string;
  phase: number;
  screenX: number;
  screenY: number;
}

export interface CosmicEdge {
  edge: InterestSeedEdge;
  source: CosmicNode;
  target: CosmicNode;
}

export interface Cluster {
  key: string;
  label: string;
  color: string;
  count: number;
  x: number;
  y: number;
  radius: number;
}

export const WORLD_WIDTH = 1600;
export const WORLD_HEIGHT = 1000;

export const TYPE_STYLE: Record<NodeType, { color: string; glyph: string }> = {
  project: { color: '#e18061', glyph: '项' },
  document: { color: '#5ed1df', glyph: '文' },
  topic: { color: '#9c8cff', glyph: '主' },
  image: { color: '#e6b66a', glyph: '图' },
  audio: { color: '#ee82a4', glyph: '音' },
  video: { color: '#ee82a4', glyph: '视' },
  activity: { color: '#7dd9ad', glyph: '活' },
};

export const CLUSTER_STYLE: Record<string, { label: string; color: string }> = {
  genesis: { label: '冷启动问卷', color: '#e18061' },
  projects: { label: '项目轨道', color: '#9c8cff' },
  expression: { label: '表达轨道', color: '#e6b66a' },
  beauty: { label: '风格轨道', color: '#e9a0b4' },
  body: { label: '身体轨道', color: '#7dd9ad' },
  game: { label: '游戏轨道', color: '#8f9cff' },
  city: { label: '城市轨道', color: '#5ed1df' },
  experiment: { label: '3/7 天验证行动', color: '#7dd9ad' },
  other: { label: '其他轨道', color: '#969ca8' },
};

export const CLUSTER_CENTERS: Array<[number, number]> = [
  [430, 500],
  [1100, 400],
  [1240, 760],
  [550, 820],
  [880, 580],
  [230, 740],
];

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function hash(value: string): number {
  let h = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    h ^= value.charCodeAt(index);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

export function nodeRadius(type: NodeType, degree: number): number {
  const base: Record<NodeType, number> = {
    project: 23,
    document: 13,
    topic: 19,
    image: 14,
    audio: 14,
    video: 15,
    activity: 18,
  };
  return base[type] + Math.min(8, degree * 0.7);
}

export function graphLabel(title: string): string {
  const cut = title.search(/[：:，,。！？!?]/);
  let value = cut >= 3 && cut <= 26 ? title.slice(0, cut) : title;
  if (value.length > 18) value = `${value.slice(0, 18)}…`;
  return value;
}

export function clusterKey(node: InterestSeedNode): string {
  const tags = node.tags.map((tag) => tag.toLowerCase());
  if (tags.includes('兴趣起跑')) return 'genesis';
  if (tags.some((tag) => /美妆|穿搭|风格|护肤|妆容/.test(tag))) return 'beauty';
  if (tags.some((tag) => /游戏|玩家|虚拟世界|电竞/.test(tag))) return 'game';
  if (tags.some((tag) => /运动|身体|健身|跑步|健康/.test(tag))) return 'body';
  if (tags.includes('城市') || tags.includes('空间')) return 'city';
  if (tags.includes('设计') || tags.includes('表达') || tags.includes('影像')) {
    return 'expression';
  }
  if (tags.includes('实验') || tags.includes('下一步')) return 'experiment';
  if (node.type === 'project' || tags.includes('项目')) return 'projects';
  return 'other';
}
