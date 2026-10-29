import { describe, expect, it } from 'vitest';
import { normalizeSourceUri } from '../src/utils/paths';

describe('sourceUri normalization', () => {
  it('keeps external URLs intact', () => {
    expect(normalizeSourceUri('https://www.xiaohongshu.com/explore/1')).toBe(
      'https://www.xiaohongshu.com/explore/1',
    );
  });

  it('repairs previously collapsed URL slashes', () => {
    expect(normalizeSourceUri('https:/www.douyin.com/video/1')).toBe(
      'https://www.douyin.com/video/1',
    );
  });

  it('normalizes vault paths and vault URIs', () => {
    expect(normalizeSourceUri('P2\\note.md')).toBe('P2/note.md');
    expect(normalizeSourceUri('vault:P2//note.md')).toBe('vault:P2/note.md');
  });
});
