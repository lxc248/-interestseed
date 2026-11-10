import { describe, expect, it } from 'vitest';
import {
  PLATFORMS,
  canonicalizeUrl,
  cardPresetFor,
  detectIngest,
  platformLabel,
} from '../src/services/ingest';
import { analyzeShareText, isVideoSpark } from '../src/services/shareAnalysis';
import { ShareInbox } from '../src/inbox/ShareInbox';

const CASES: Array<{ url: string; platform: string; kind: string }> = [
  { url: 'https://www.douyin.com/video/7300000000000000000', platform: 'douyin', kind: 'video' },
  { url: 'https://v.douyin.com/iRabcdef/', platform: 'douyin', kind: 'video' },
  { url: 'https://www.tiktok.com/@user/video/7300000000000000000', platform: 'tiktok', kind: 'video' },
  { url: 'https://vm.tiktok.com/ZMabcdef/', platform: 'tiktok', kind: 'video' },
  { url: 'https://www.kuaishou.com/short-video/3xabcdef', platform: 'kuaishou', kind: 'video' },
  { url: 'https://www.xiaohongshu.com/explore/65abcdef', platform: 'xiaohongshu', kind: 'post' },
  { url: 'https://xhslink.com/a/abcDEF', platform: 'xiaohongshu', kind: 'post' },
  { url: 'https://www.bilibili.com/video/BV1xx411c7mD', platform: 'bilibili', kind: 'video' },
  { url: 'https://b23.tv/abcDEF', platform: 'bilibili', kind: 'video' },
  { url: 'https://weibo.com/1234567890/abcdef', platform: 'weibo', kind: 'post' },
  { url: 'https://mp.weixin.qq.com/s/abcdef', platform: 'wechat', kind: 'article' },
  { url: 'https://www.zhihu.com/question/123456', platform: 'zhihu', kind: 'article' },
  { url: 'https://www.douban.com/note/123456/', platform: 'douban', kind: 'post' },
  { url: 'https://www.v2ex.com/t/123456', platform: 'v2ex', kind: 'post' },
  { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', platform: 'youtube', kind: 'video' },
  { url: 'https://youtu.be/dQw4w9WgXcQ', platform: 'youtube', kind: 'video' },
  { url: 'https://vimeo.com/123456789', platform: 'vimeo', kind: 'video' },
  { url: 'https://x.com/someone/status/1234567890', platform: 'x', kind: 'post' },
  { url: 'https://twitter.com/someone/status/1234567890', platform: 'x', kind: 'post' },
  { url: 'https://www.instagram.com/p/abcdef/', platform: 'instagram', kind: 'image' },
  { url: 'https://www.threads.net/@someone/post/abcdef', platform: 'threads', kind: 'post' },
  { url: 'https://bsky.app/profile/someone.bsky.social/post/abcdef', platform: 'bluesky', kind: 'post' },
  { url: 'https://mastodon.social/@someone/123456', platform: 'mastodon', kind: 'post' },
  { url: 'https://www.reddit.com/r/obsidian/comments/abcdef/thread/', platform: 'reddit', kind: 'post' },
  { url: 'https://redd.it/abcdef', platform: 'reddit', kind: 'post' },
  { url: 'https://www.pinterest.com/pin/123456/', platform: 'pinterest', kind: 'image' },
  { url: 'https://pin.it/abcDEF', platform: 'pinterest', kind: 'image' },
  { url: 'https://www.linkedin.com/posts/someone_abcdef', platform: 'linkedin', kind: 'post' },
  { url: 'https://medium.com/@someone/some-post-abcdef', platform: 'medium', kind: 'article' },
  { url: 'https://someone.substack.com/p/some-post', platform: 'substack', kind: 'article' },
  { url: 'https://github.com/lxc248/-interestseed', platform: 'github', kind: 'article' },
  { url: 'https://example.com/some/page', platform: 'web', kind: 'web' },
];

describe('ingest platform recognition', () => {
  for (const item of CASES) {
    it(`${item.platform} <- ${item.url}`, () => {
      const result = detectIngest(`看看这个 ${item.url}`);
      expect(result.platform).toBe(item.platform);
      expect(result.kind).toBe(item.kind);
    });
  }

  it('treats text without a URL as text', () => {
    const result = detectIngest('我想知道自己为什么总是重新开始');
    expect(result.platform).toBe('text');
    expect(result.kind).toBe('text');
    expect(result.url).toBeNull();
    expect(result.canonicalUrl).toBeNull();
  });

  it('exposes every platform through the label helper', () => {
    for (const platform of PLATFORMS) {
      expect(platformLabel(platform.id)).toBe(platform.label);
      expect(platformLabel(platform.id).length).toBeGreaterThan(0);
    }
    expect(platformLabel('unknown-platform')).toBe('网页');
  });
});

describe('ingest URL normalisation', () => {
  it('strips tracking parameters but keeps identity parameters', () => {
    const result = detectIngest(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ&utm_source=share&si=abcdef&feature=share',
    );
    expect(result.canonicalUrl).toBe('https://youtube.com/watch?v=dQw4w9WgXcQ');
    expect(result.removedParams).toEqual(expect.arrayContaining(['utm_source', 'si', 'feature']));
  });

  it('rewrites youtu.be short links to the canonical watch URL', () => {
    const result = detectIngest('https://youtu.be/dQw4w9WgXcQ?t=42');
    expect(result.canonicalUrl).toBe('https://youtube.com/watch?v=dQw4w9WgXcQ');
  });

  it('removes the fragment and trailing slash', () => {
    const result = detectIngest('https://www.bilibili.com/video/BV1xx411c7mD/?spm_id_from=333.999#reply');
    expect(result.canonicalUrl).toBe('https://bilibili.com/video/BV1xx411c7mD');
  });

  it('sorts remaining query parameters so the same item yields the same key', () => {
    const first = canonicalizeUrl('https://example.com/a?b=2&a=1');
    const second = canonicalizeUrl('https://example.com/a?a=1&b=2');
    expect(first.canonicalUrl).toBe(second.canonicalUrl);
    expect(first.removedParams).toEqual([]);
  });

  it('flags short-link hosts it cannot expand offline', () => {
    for (const url of [
      'https://b23.tv/abc',
      'https://xhslink.com/a/abc',
      'https://v.douyin.com/iRabc/',
      'https://t.co/abc',
      'https://redd.it/abc',
      'https://pin.it/abc',
      'https://lnkd.in/abc',
      'https://vm.tiktok.com/ZMabc/',
    ]) {
      const result = detectIngest(url);
      expect(result.shortLink, url).toBe(true);
      expect(result.platform, url).not.toBe('web');
    }
  });

  it('does not flag normal hosts as short links', () => {
    expect(detectIngest('https://www.xiaohongshu.com/explore/1').shortLink).toBe(false);
    expect(detectIngest('https://example.com/x').shortLink).toBe(false);
  });

  it('returns the input untouched when the URL cannot be parsed', () => {
    expect(canonicalizeUrl('not a url').canonicalUrl).toBe('not a url');
  });
});

describe('ingest share card mapping', () => {
  it('maps platforms to a card preset', () => {
    expect(cardPresetFor('xiaohongshu')).toBe('xiaohongshu');
    expect(cardPresetFor('instagram')).toBe('instagram');
    expect(cardPresetFor('x')).toBe('x');
    expect(cardPresetFor('wechat')).toBe('wechat');
    expect(cardPresetFor('youtube')).toBe('story');
  });

  it('returns null for unknown platforms', () => {
    expect(cardPresetFor('nope')).toBeNull();
  });
});

describe('share analysis uses ingest', () => {
  it('carries the new fields through', () => {
    const result = analyzeShareText(
      '这个剪辑讲得真好 https://www.bilibili.com/video/BV1xx411c7mD?spm_id_from=333.999',
    );
    expect(result.platform).toBe('bilibili');
    expect(result.kind).toBe('video');
    expect(result.canonicalUrl).toBe('https://bilibili.com/video/BV1xx411c7mD');
    expect(result.cardPreset).toBe('xiaohongshu');
  });

  it('recognises platforms that were previously unknown', () => {
    const result = analyzeShareText('https://www.kuaishou.com/short-video/3xabc');
    expect(result.platform).toBe('kuaishou');
    expect(result.platformLabel).toBe('快手');
  });

  it('treats 快手 and TikTok as video sparks', () => {
    expect(isVideoSpark('https://www.kuaishou.com/short-video/3xabc')).toBe(true);
    expect(isVideoSpark('https://www.tiktok.com/@u/video/1')).toBe(true);
    expect(isVideoSpark('https://www.zhihu.com/question/1')).toBe(false);
  });
});

describe('share inbox records the source platform', () => {
  it('stores platform and canonical URL for a link', () => {
    const inbox = new ShareInbox();
    const result = inbox.enqueue('https://x.com/a/status/1?utm_source=share');
    expect(result?.item.sourcePlatform).toBe('x');
    expect(result?.item.canonicalUrl).toBe('https://x.com/a/status/1');
  });

  it('leaves plain text items without platform metadata', () => {
    const inbox = new ShareInbox();
    const result = inbox.enqueue('我想把摄影练起来');
    expect(result?.item.sourcePlatform).toBeUndefined();
    expect(result?.item.canonicalUrl).toBeUndefined();
  });

  it('still dedupes the same link with different tracking parameters', () => {
    const inbox = new ShareInbox();
    const first = inbox.enqueue('https://www.douyin.com/video/123?utm_source=a');
    const second = inbox.enqueue('https://www.douyin.com/video/123?utm_source=b');
    expect(second?.duplicate).toBe(true);
    expect(second?.item.id).toBe(first?.item.id);
  });
});
