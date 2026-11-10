/**
 * Platform-agnostic intake: recognise where a saved item came from,
 * normalise its URL, and map it to a share-card preset.
 *
 * Everything here is pure text work. No network, no page fetching.
 */

export type IngestKind = 'video' | 'image' | 'post' | 'article' | 'web' | 'text';

export type IngestCardPreset = 'xiaohongshu' | 'instagram' | 'x' | 'wechat' | 'story';

export interface IngestPlatform {
  id: string;
  label: string;
  kind: IngestKind;
  /** Match by exact host or by subdomain suffix. */
  hosts: string[];
  /** Hosts that only redirect elsewhere; we cannot expand them offline. */
  shortHosts?: string[];
  cardPreset?: IngestCardPreset;
}

/**
 * Ordered rules. First match wins, so put narrower hosts before broader ones
 * (for example `mp.weixin.qq.com` must win over a generic `qq.com`).
 */
export const PLATFORMS: readonly IngestPlatform[] = [
  { id: 'douyin', label: '抖音', kind: 'video', hosts: ['douyin.com', 'iesdouyin.com'], shortHosts: ['v.douyin.com'], cardPreset: 'xiaohongshu' },
  { id: 'tiktok', label: 'TikTok', kind: 'video', hosts: ['tiktok.com'], shortHosts: ['vm.tiktok.com', 'vt.tiktok.com'], cardPreset: 'story' },
  { id: 'kuaishou', label: '快手', kind: 'video', hosts: ['kuaishou.com', 'gifshow.com'], shortHosts: ['v.kuaishou.com'], cardPreset: 'xiaohongshu' },
  { id: 'xiaohongshu', label: '小红书', kind: 'post', hosts: ['xiaohongshu.com', 'rednote.com'], shortHosts: ['xhslink.com'], cardPreset: 'xiaohongshu' },
  { id: 'bilibili', label: 'B 站', kind: 'video', hosts: ['bilibili.com', 'bilibili.tv'], shortHosts: ['b23.tv'], cardPreset: 'xiaohongshu' },
  { id: 'weibo', label: '微博', kind: 'post', hosts: ['weibo.com', 'weibo.cn'], shortHosts: ['t.cn'], cardPreset: 'wechat' },
  { id: 'wechat', label: '微信公众号', kind: 'article', hosts: ['mp.weixin.qq.com'], cardPreset: 'wechat' },
  { id: 'zhihu', label: '知乎', kind: 'article', hosts: ['zhihu.com'], shortHosts: ['zhihu.com/s/*'], cardPreset: 'wechat' },
  { id: 'douban', label: '豆瓣', kind: 'post', hosts: ['douban.com'], cardPreset: 'wechat' },
  { id: 'v2ex', label: 'V2EX', kind: 'post', hosts: ['v2ex.com'], cardPreset: 'x' },
  { id: 'youtube', label: 'YouTube', kind: 'video', hosts: ['youtube.com', 'm.youtube.com'], shortHosts: ['youtu.be'], cardPreset: 'story' },
  { id: 'vimeo', label: 'Vimeo', kind: 'video', hosts: ['vimeo.com'], cardPreset: 'story' },
  { id: 'x', label: 'X', kind: 'post', hosts: ['x.com', 'twitter.com'], shortHosts: ['t.co'], cardPreset: 'x' },
  { id: 'instagram', label: 'Instagram', kind: 'image', hosts: ['instagram.com'], cardPreset: 'instagram' },
  { id: 'threads', label: 'Threads', kind: 'post', hosts: ['threads.net'], cardPreset: 'instagram' },
  { id: 'bluesky', label: 'Bluesky', kind: 'post', hosts: ['bsky.app'], cardPreset: 'x' },
  { id: 'mastodon', label: 'Mastodon', kind: 'post', hosts: ['mastodon.social', 'mastodon.online', 'fosstodon.org'], cardPreset: 'x' },
  { id: 'reddit', label: 'Reddit', kind: 'post', hosts: ['reddit.com'], shortHosts: ['redd.it'], cardPreset: 'x' },
  { id: 'pinterest', label: 'Pinterest', kind: 'image', hosts: ['pinterest.com'], shortHosts: ['pin.it'], cardPreset: 'instagram' },
  { id: 'linkedin', label: 'LinkedIn', kind: 'post', hosts: ['linkedin.com'], shortHosts: ['lnkd.in'], cardPreset: 'x' },
  { id: 'medium', label: 'Medium', kind: 'article', hosts: ['medium.com'], cardPreset: 'wechat' },
  { id: 'substack', label: 'Substack', kind: 'article', hosts: ['substack.com'], cardPreset: 'wechat' },
  { id: 'github', label: 'GitHub', kind: 'article', hosts: ['github.com'], cardPreset: 'x' },
];

const TRACKING_PARAM_PREFIXES = ['utm_', 'spm_'];
const TRACKING_PARAMS = new Set([
  'fbclid',
  'gclid',
  'yclid',
  'msclkid',
  'spm',
  'scm',
  'from',
  'share_source',
  'share_medium',
  'share_plat',
  'share_token',
  'share_from',
  'share_session_id',
  'xsec_token',
  'xsec_source',
  'is_from_webapp',
  'sender_device',
  'web_id',
  'app',
  'timestamp',
  'si',
  'feature',
  'ref',
  'ref_src',
  'ref_url',
]);

export interface IngestResult {
  platform: string;
  label: string;
  kind: IngestKind;
  url: string | null;
  canonicalUrl: string | null;
  /** True when the only host we saw is a short-link host we cannot expand offline. */
  shortLink: boolean;
  removedParams: string[];
  cardPreset: IngestCardPreset | null;
}

const TEXT_RESULT: Omit<IngestResult, 'url' | 'canonicalUrl'> = {
  platform: 'text',
  label: '一段文字',
  kind: 'text',
  shortLink: false,
  removedParams: [],
  cardPreset: null,
};

function bareHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, '');
}

function hostMatches(host: string, candidate: string): boolean {
  return host === candidate || host.endsWith(`.${candidate}`);
}

function findPlatform(host: string): { platform: IngestPlatform; short: boolean } | null {
  // Short-link hosts win: `v.douyin.com` is a suffix of `douyin.com` but only
  // resolves through a redirect, so it must be reported as a short link.
  for (const platform of PLATFORMS) {
    if (platform.shortHosts?.some((candidate) => host === candidate)) {
      return { platform, short: true };
    }
  }
  for (const platform of PLATFORMS) {
    if (platform.hosts.some((candidate) => hostMatches(host, candidate))) {
      return { platform, short: false };
    }
  }
  return null;
}

export function extractFirstUrl(raw: string): string | null {
  return raw.match(/https?:\/\/[^\s]+/i)?.[0] ?? null;
}

export function canonicalizeUrl(
  rawUrl: string,
  platformId?: string,
): { canonicalUrl: string; removedParams: string[] } {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { canonicalUrl: rawUrl, removedParams: [] };
  }

  parsed.hash = '';
  parsed.hostname = bareHost(parsed.hostname);

  // A youtu.be short link carries the id in the path; rewrite it to the canonical form.
  if (platformId === 'youtube' && parsed.hostname === 'youtu.be') {
    const id = parsed.pathname.replace(/^\/+/, '');
    return {
      canonicalUrl: id ? `https://youtube.com/watch?v=${id}` : 'https://youtube.com',
      removedParams: [...parsed.searchParams.keys()],
    };
  }

  const removedParams: string[] = [];
  for (const key of [...parsed.searchParams.keys()]) {
    const tracked =
      TRACKING_PARAMS.has(key) || TRACKING_PARAM_PREFIXES.some((prefix) => key.startsWith(prefix));
    if (tracked) {
      parsed.searchParams.delete(key);
      removedParams.push(key);
    }
  }

  // Sort what is left so the same item always produces the same key.
  const kept = [...parsed.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
  parsed.search = '';
  for (const [key, value] of kept) parsed.searchParams.append(key, value);

  let text = parsed.toString();
  if (text.endsWith('/') && parsed.pathname !== '/') text = text.slice(0, -1);
  return { canonicalUrl: text, removedParams };
}

export function detectIngest(raw: string): IngestResult {
  const text = raw.trim();
  const url = extractFirstUrl(text);
  if (!url) {
    return { ...TEXT_RESULT, url: null, canonicalUrl: null };
  }

  let host: string;
  try {
    host = bareHost(new URL(url).hostname);
  } catch {
    host = '';
  }

  const matched = host ? findPlatform(host) : null;
  const platform = matched?.platform;
  const canonical = canonicalizeUrl(url, platform?.id);

  return {
    platform: platform?.id ?? 'web',
    label: platform?.label ?? '网页',
    kind: platform?.kind ?? 'web',
    url,
    canonicalUrl: canonical.canonicalUrl,
    shortLink: matched?.short ?? false,
    removedParams: canonical.removedParams,
    cardPreset: platform?.cardPreset ?? null,
  };
}

export function platformLabel(id: string): string {
  return PLATFORMS.find((platform) => platform.id === id)?.label ?? '网页';
}

export function cardPresetFor(platform: string): IngestCardPreset | null {
  return PLATFORMS.find((entry) => entry.id === platform)?.cardPreset ?? null;
}
