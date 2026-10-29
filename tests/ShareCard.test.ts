import { describe, expect, it } from 'vitest';
import {
  SHARE_PRESETS,
  buildShareCaption,
  getSharePreset,
  shareCardFilename,
} from '../src/ui/ShareCardRenderer';

describe('social share card presets', () => {
  it('covers the main platform aspect ratios', () => {
    expect(SHARE_PRESETS).toHaveLength(5);
    const ids = new Set(SHARE_PRESETS.map((preset) => preset.id));
    expect(ids.size).toBe(SHARE_PRESETS.length);
    for (const preset of SHARE_PRESETS) {
      expect(preset.width).toBeGreaterThanOrEqual(1080);
      expect(preset.height).toBeGreaterThanOrEqual(900);
      expect(preset.label.length).toBeGreaterThan(0);
    }
  });

  it('falls back safely and produces a platform-specific filename', () => {
    expect(getSharePreset('xiaohongshu').width).toBe(1080);
    expect(getSharePreset('xiaohongshu').height).toBe(1440);
    expect(shareCardFilename(getSharePreset('x'))).toBe(
      'interestseed-star-map-x-1600x900.png',
    );
  });

  it('keeps portrait cards taller than wide', () => {
    expect(getSharePreset('instagram').height).toBeGreaterThan(
      getSharePreset('instagram').width,
    );
    expect(getSharePreset('story').height).toBeGreaterThan(
      getSharePreset('story').width,
    );
  });

  it('builds a copyable caption from real graph topics', () => {
    const caption = buildShareCaption(
      {
        schemaVersion: 2,
        updatedAt: '2026-01-01T00:00:00.000Z',
        nodes: [
          {
            id: 'a',
            type: 'topic',
            title: '美妆与风格',
            tags: ['美妆与风格'],
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
            metadata: {},
          },
          {
            id: 'b',
            type: 'video',
            title: '跑步',
            tags: ['运动与身体', '火花'],
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
            metadata: {},
          },
        ],
        edges: [],
      },
      getSharePreset('xiaohongshu'),
    );
    expect(caption).toContain('2 个节点');
    expect(caption).toContain('美妆与风格');
    expect(caption).toContain('#InterestSeed');
  });
});
