import { describe, expect, it } from 'vitest';
import {
  SHARE_PRESETS,
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
});
