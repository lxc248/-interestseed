import { describe, expect, it } from 'vitest';

import {
  ModelProviderError,
  parseExplorationInsight,
} from '../src/services/ModelProvider';

describe('AI exploration insight parser', () => {
  it('接受严格 JSON 并保留机会字段', () => {
    const result = parseExplorationInsight(
      JSON.stringify({
        summary: '主题集中在 theme8，但反馈量仍少。',
        opportunities: [
          {
            title: '继续观察 theme8',
            why: 'theme8 有活动发现和接受反馈。',
            nextStep: '再收集三次反馈。',
            themes: ['theme8'],
          },
        ],
      }),
    );
    expect(result.summary).toContain('theme8');
    expect(result.opportunities).toHaveLength(1);
    expect(result.opportunities[0]?.themes).toEqual(['theme8']);
  });

  it('接受完整 JSON 代码围栏', () => {
    const result = parseExplorationInsight(
      '```json\n{"summary":"ok","opportunities":[]}\n```',
    );
    expect(result.summary).toBe('ok');
  });

  it('拒绝非 JSON 和缺少字段的响应', () => {
    expect(() => parseExplorationInsight('不是 JSON')).toThrow(ModelProviderError);
    expect(() => parseExplorationInsight('{"summary":"ok"}')).toThrow(
      ModelProviderError,
    );
    expect(() =>
      parseExplorationInsight('{"summary":"ok","opportunities":[{}]}'),
    ).toThrow(ModelProviderError);
  });

  it('过滤 AI 编造的未知主题', () => {
    const result = parseExplorationInsight(
      JSON.stringify({
        summary: 'ok',
        opportunities: [
          { title: 'x', why: 'y', nextStep: 'z', themes: ['theme8', 'fake'] },
        ],
      }),
      new Set(['theme8']),
    );
    expect(result.opportunities[0]?.themes).toEqual(['theme8']);
  });

  it('保留可解释推理、置信度与证据字段', () => {
    const result = parseExplorationInsight(
      JSON.stringify({
        summary: 'ok',
        confidence: 0.76,
        reasoning: ['观察：theme8 跨 3 个项目', '推断：它是稳定主线', '行动：继续收集'],
        opportunities: [
          {
            title: 'x',
            why: 'y',
            nextStep: 'z',
            themes: ['theme8'],
            evidence: ['3 个项目', '5 条发现'],
            confidence: 0.7,
          },
        ],
      }),
      new Set(['theme8']),
    );
    expect(result.confidence).toBe(0.76);
    expect(result.reasoning).toHaveLength(3);
    expect(result.opportunities[0]?.evidence).toEqual(['3 个项目', '5 条发现']);
    expect(result.opportunities[0]?.confidence).toBe(0.7);
  });
});
