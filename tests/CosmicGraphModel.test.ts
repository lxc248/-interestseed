import { describe, expect, it } from 'vitest';
import {
  CLUSTER_CENTERS,
  CLUSTER_STYLE,
  TYPE_STYLE,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  clamp,
  clusterKey,
  graphLabel,
  hash,
  nodeRadius,
} from '../src/ui/cosmicGraphModel';
import type { InterestSeedNode } from '../src/types/graph';

const node = (id: string, tags: string[] = []): InterestSeedNode => ({
  id,
  type: 'topic',
  title: id,
  tags,
  createdAt: '',
  updatedAt: '',
  metadata: {},
});

describe('cosmicGraphModel', () => {
  it('keeps deterministic hashes and helpers in range', () => {
    expect(hash('node-a')).toBe(hash('node-a'));
    expect(hash('node-a')).toBeGreaterThanOrEqual(0);
    expect(hash('node-a')).toBeLessThanOrEqual(1);
    expect(clamp(5, 1, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(nodeRadius('topic', 0)).toBe(19);
    expect(nodeRadius('topic', 100)).toBe(27);
    expect(WORLD_WIDTH).toBe(1600);
    expect(WORLD_HEIGHT).toBe(1000);
    expect(CLUSTER_CENTERS.length).toBe(6);
    expect(TYPE_STYLE.topic.glyph).toBe('主');
    expect(CLUSTER_STYLE.genesis?.label).toContain('冷启动');
  });

  it('labels and clusters nodes consistently', () => {
    expect(graphLabel('论文初稿：一个很长的副标题')).toBe('论文初稿');
    expect(graphLabel('这是一个超过十八个字符的很长标题用于测试截断')).toHaveLength(19);
    expect(clusterKey(node('a', ['兴趣起跑']))).toBe('genesis');
    expect(clusterKey(node('b', ['美妆']))).toBe('beauty');
    expect(clusterKey(node('c', ['游戏']))).toBe('game');
    expect(clusterKey(node('d', ['运动']))).toBe('body');
    expect(clusterKey(node('e', ['城市']))).toBe('city');
    expect(clusterKey(node('f', ['设计']))).toBe('expression');
    expect(clusterKey(node('g', ['实验']))).toBe('experiment');
    expect(clusterKey({ ...node('h'), type: 'project' })).toBe('projects');
    expect(clusterKey(node('i'))).toBe('other');
  });

  it('computes 1000-node layout metadata well under a second', () => {
    const started = performance.now();
    for (let index = 0; index < 1000; index += 1) {
      const item = node(`node-${index}`, index % 2 === 0 ? ['设计'] : ['运动']);
      clusterKey(item);
      nodeRadius(item.type, index % 10);
      hash(item.id);
    }
    expect(performance.now() - started).toBeLessThan(1000);
  });
});
