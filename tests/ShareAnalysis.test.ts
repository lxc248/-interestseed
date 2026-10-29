import { describe, expect, it } from 'vitest';
import { analyzeShareText } from '../src/services/shareAnalysis';

describe('share analysis', () => {
  it('recognizes Douyin and keeps a clean short title', () => {
    const result = analyzeShareText(
      'AI 会议纪要：把周会变成行动项 https://www.douyin.com/video/123',
    );
    expect(result.platform).toBe('douyin');
    expect(result.platformLabel).toBe('抖音');
    expect(result.url).toContain('douyin.com');
    expect(result.title).toBe('AI 会议纪要：把周会变成行动项');
  });

  it('recognizes Xiaohongshu share noise and extracts topics', () => {
    const result = analyzeShareText(
      '复制打开小红书，看看【视觉设计：封面三秒抓住人】 https://xhslink.com/a1b2',
    );
    expect(result.platform).toBe('xiaohongshu');
    expect(result.title).toContain('视觉设计');
    expect(result.topics).toContain('视觉与表达');
  });

  it('supports a plain sentence without inventing a platform', () => {
    const result = analyzeShareText('我想知道为什么自己总是重新开始');
    expect(result.platform).toBe('text');
    expect(result.url).toBeNull();
    expect(result.title).toBe('我想知道为什么自己总是重新开始');
  });

  it('returns one explicit next question', () => {
    const result = analyzeShareText('产品增长：先找到愿意付费的 10 个人');
    expect(result.nextQuestion).toContain('哪个兴趣');
    expect(result.why).toContain('产品与商业');
  });
});
