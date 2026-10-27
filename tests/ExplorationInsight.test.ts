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
});
