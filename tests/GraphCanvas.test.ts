import { describe, expect, it } from 'vitest';
import { readNodePosition } from '../src/ui/GraphCanvas';
import type { InterestSeedNode } from '../src/types/graph';

const NOW = '2026-01-01T00:00:00.000Z';

function node(position: unknown): InterestSeedNode {
  return {
    id: 'node',
    type: 'document',
    title: 'Node',
    tags: [],
    createdAt: NOW,
    updatedAt: NOW,
    metadata: { position },
  };
}

describe('GraphCanvas / 布局坐标', () => {
  it('读取有效的保存坐标', () => {
    expect(readNodePosition(node({ x: 12, y: -8 }))).toEqual({ x: 12, y: -8 });
  });

  it('拒绝缺失坐标和非法坐标', () => {
    expect(readNodePosition(node(undefined))).toBeNull();
    expect(readNodePosition(node(null))).toBeNull();
    expect(readNodePosition(node({ x: '1', y: 2 }))).toBeNull();
    expect(readNodePosition(node({ x: 1 }))).toBeNull();
    expect(readNodePosition(node({ x: Number.NaN, y: 0 }))).toBeNull();
    expect(readNodePosition(node({ x: 0, y: Number.POSITIVE_INFINITY }))).toBeNull();
  });
});
