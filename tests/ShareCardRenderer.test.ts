// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { InterestSeedGraph } from '../src/types/graph';
import {
  SHARE_PRESETS,
  buildShareCaption,
  getSharePreset,
  renderShareCard,
  shareCardFilename,
} from '../src/ui/ShareCardRenderer';

function fakeContext(): CanvasRenderingContext2D {
  const gradient = { addColorStop() {} };
  return new Proxy(
    {},
    {
      get(_target, property) {
        if (property === 'measureText') return () => ({ width: 12 });
        if (property === 'createLinearGradient' || property === 'createRadialGradient') {
          return () => gradient;
        }
        if (property === 'canvas') return undefined;
        return () => undefined;
      },
      set() {
        return true;
      },
    },
  ) as CanvasRenderingContext2D;
}

const now = '2026-01-01T00:00:00.000Z';
const graph: InterestSeedGraph = {
  schemaVersion: 2,
  updatedAt: now,
  nodes: [
    {
      id: 'a',
      type: 'topic',
      title: '设计系统',
      tags: ['设计', '工具'],
      createdAt: now,
      updatedAt: now,
      metadata: {},
    },
    {
      id: 'b',
      type: 'document',
      title: '一篇关于长期练习的文章',
      tags: ['设计', '练习'],
      createdAt: now,
      updatedAt: now,
      metadata: {},
    },
  ],
  edges: [
    {
      id: 'e1',
      source: 'a',
      target: 'b',
      relation: 'related',
      origin: 'user',
      status: 'confirmed',
      createdAt: now,
      updatedAt: now,
    },
  ],
};

const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');

beforeAll(() => {
  getContext.mockImplementation(() => fakeContext());
});

afterEach(() => {
  getContext.mockClear();
});

describe('share presets and caption', () => {
  it('resolves presets and file names', () => {
    expect(getSharePreset('x').width).toBe(1600);
    expect(getSharePreset('story').height).toBe(1920);
    expect(getSharePreset('xiaohongshu')).toBe(SHARE_PRESETS[0]);
    expect(getSharePreset('unknown' as never)).toBe(SHARE_PRESETS[0]);
    expect(shareCardFilename(getSharePreset('instagram'))).toBe(
      'interestseed-star-map-instagram-1080x1350.png',
    );
  });

  it('builds a caption with topics and platform hashtag', () => {
    const caption = buildShareCaption(graph, getSharePreset('x'));
    expect(caption).toContain('2 个兴趣');
    expect(caption).toContain('设计');
    expect(caption).toContain('#个人成长');
  });

  it('builds a caption without topics', () => {
    const empty = buildShareCaption(
      { schemaVersion: 2, updatedAt: now, nodes: [], edges: [] },
      getSharePreset('xiaohongshu'),
    );
    expect(empty).not.toContain('最近在认真看');
    expect(empty).toContain('#自我探索');
  });
});

describe('share card rendering', () => {
  it('renders a portrait card at the requested size', () => {
    const canvas = renderShareCard(graph, getSharePreset('xiaohongshu'));
    expect(canvas.width).toBe(1080);
    expect(canvas.height).toBe(1440);
  });

  it('renders a landscape card at the requested size', () => {
    const canvas = renderShareCard(graph, getSharePreset('x'));
    expect(canvas.width).toBe(1600);
    expect(canvas.height).toBe(900);
  });

  it('renders an empty graph without throwing', () => {
    const canvas = renderShareCard(
      { schemaVersion: 2, updatedAt: now, nodes: [], edges: [] },
      getSharePreset('wechat'),
    );
    expect(canvas.width).toBe(1080);
    expect(canvas.height).toBe(1080);
  });
});
