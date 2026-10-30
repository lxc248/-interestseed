/**
 * Deterministic intake analysis for Douyin / Xiaohongshu share text.
 *
 * This module never fetches a platform page and never invents a video
 * transcript. It extracts only what the user deliberately pasted, then gives
 * the user a small, explicit next decision.
 */

export type SharePlatform =
  | 'douyin'
  | 'xiaohongshu'
  | 'bilibili'
  | 'youtube'
  | 'web'
  | 'text';

export interface ShareAnalysis {
  platform: SharePlatform;
  platformLabel: string;
  url: string | null;
  title: string;
  topics: string[];
  why: string;
  nextQuestion: string;
}

const PLATFORM_RULES: Array<{
  platform: SharePlatform;
  label: string;
  test: RegExp;
}> = [
  { platform: 'douyin', label: '抖音', test: /douyin\.com|iesdouyin\.com/i },
  { platform: 'xiaohongshu', label: '小红书', test: /xiaohongshu\.com|xhslink\.com|rednote\.com/i },
  { platform: 'bilibili', label: 'B 站', test: /bilibili\.com|b23\.tv/i },
  { platform: 'youtube', label: 'YouTube', test: /youtube\.com|youtu\.be/i },
  { platform: 'web', label: '网页', test: /https?:\/\//i },
];

const TOPIC_RULES: Array<{ topic: string; test: RegExp }> = [
  { topic: 'AI 与工具', test: /ai|agent|大模型|deepseek|kimi|vibe|工具|效率|自动化/i },
  { topic: '视觉与表达', test: /视觉|设计|摄影|剪辑|配色|封面|影像|叙事|表达|排版/i },
  { topic: '职业与选择', test: /实习|简历|面试|选调|就业|职场|工作|考公|招聘/i },
  { topic: '学习与认知', test: /学习|课程|考试|大学|作业|论文|认知|记忆/i },
  { topic: '产品与商业', test: /产品|创业|增长|用户|需求|商业|项目/i },
  { topic: '城市与生活', test: /城市|空间|旅行|生活|消费|退款|租房/i },
  { topic: '美妆与风格', test: /美妆|化妆|护肤|穿搭|口红|妆容|底妆|彩妆|发型|风格/i },
  { topic: '运动与身体', test: /健身|运动|跑步|瑜伽|篮球|足球|羽毛球|深蹲|减脂|拉伸/i },
  { topic: '游戏与虚拟世界', test: /游戏|网游|手游|电竞|steam|主机|玩家|开放世界|塞尔达|英雄联盟|lpl/i },
];

const SHARE_NOISE = [
  /复制打开抖音[，,：:]?/gi,
  /看看【?/gi,
  /打开小红书[，,：:]?/gi,
  /长按复制此条消息[，,：:]?/gi,
  /^【[^】]*】\s*/,
];

function cleanTitle(raw: string): string {
  let value = raw.replace(/https?:\/\/[^\s]+/gi, ' ');
  for (const pattern of SHARE_NOISE) value = value.replace(pattern, ' ');
  value = value.replace(/#[^\s#]+/g, ' ').replace(/\s+/g, ' ').trim();
  const firstSentence = value.split(/[。！？!?]\s*/)[0] ?? value;
  return (firstSentence || value).slice(0, 80).trim();
}

export function analyzeShareText(raw: string): ShareAnalysis {
  const text = raw.trim();
  const url = text.match(/https?:\/\/[^\s]+/i)?.[0] ?? null;
  const platformRule = PLATFORM_RULES.find((rule) => rule.test.test(text));
  const platform = platformRule?.platform ?? 'text';
  const platformLabel = platformRule?.label ?? '一段文字';
  const title = cleanTitle(text) || `${platformLabel}内容`;
  const topics = TOPIC_RULES.filter((rule) => rule.test.test(text))
    .map((rule) => rule.topic)
    .slice(0, 3);

  return {
    platform,
    platformLabel,
    url,
    title,
    topics,
    why:
      topics.length > 0
        ? `这条内容碰到了「${topics.join(' / ')}」。先判断它是短暂好奇，还是你想继续靠近的方向。`
        : '先判断它是短暂好奇，还是你想继续靠近的方向；不需要把每一条内容都留下。',
    nextQuestion:
      platform === 'text'
        ? '这句话和你已经留下的哪个兴趣有关？'
        : '这条内容和你已经留下的哪个兴趣有关？',
  };
}

/** True when the pasted text points at a video platform. */
export function isVideoSpark(text: string): boolean {
  return /(youtube\.com|youtu\.be|bilibili\.com|douyin\.com|tiktok\.com|vimeo\.com)/i.test(text);
}

/** A short human label for a spark, without fetching the source page. */
export function describeSpark(text: string): string {
  const value = text.trim();
  if (!value) return '';
  const url = value.match(/https?:\/\/[^\s]+/i)?.[0];
  if (url) {
    try {
      const host = new URL(url).hostname.replace(/^www\./, '');
      const prefix = value.replace(url, '').trim();
      return (prefix || `视频火花 · ${host}`).slice(0, 96);
    } catch {
      return '视频火花';
    }
  }
  return value.slice(0, 96);
}
