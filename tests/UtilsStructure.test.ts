import { describe, expect, it } from 'vitest';
import { compareText } from '../src/utils/text';
import { clamp, hash01 } from '../src/utils/math';
import { describeSpark, isVideoSpark } from '../src/services/shareAnalysis';

describe('shared utilities', () => {
  it('compares text deterministically', () => {
    expect(compareText('a', 'a')).toBe(0);
    expect(compareText('a', 'b')).toBe(-1);
    expect(compareText('b', 'a')).toBe(1);
  });

  it('clamps and hashes deterministically', () => {
    expect(clamp(5, 1, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(hash01('x')).toBe(hash01('x'));
    expect(hash01('x')).toBeGreaterThanOrEqual(0);
    expect(hash01('x')).toBeLessThanOrEqual(1);
  });
});

describe('spark text', () => {
  it('detects video hosts', () => {
    expect(isVideoSpark('https://www.bilibili.com/video/BV1')).toBe(true);
    expect(isVideoSpark('https://example.com/a')).toBe(false);
  });

  it('describes URLs without fetching them', () => {
    expect(describeSpark('')).toBe('');
    expect(describeSpark('https://www.youtube.com/watch?v=1')).toBe('视频火花 · youtube.com');
    expect(describeSpark('我的观察 https://youtu.be/x')).toBe('我的观察');
    expect(describeSpark('纯文本观察')).toBe('纯文本观察');
  });
});
