import type { NodeType } from '../types/graph';

export interface NodePalette {
  color: string;
  glyph: string;
}

/** Shared fixed palette for generated cards and the cosmic canvas. */
export const NODE_TYPE_STYLE: Record<NodeType, NodePalette> = {
  project: { color: '#e18061', glyph: '项' },
  document: { color: '#5ed1df', glyph: '文' },
  topic: { color: '#9c8cff', glyph: '主' },
  image: { color: '#e6b66a', glyph: '图' },
  audio: { color: '#ee82a4', glyph: '音' },
  video: { color: '#ee82a4', glyph: '视' },
  activity: { color: '#7dd9ad', glyph: '活' },
};
