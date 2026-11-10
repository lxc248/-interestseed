import { describe, expect, it, vi } from 'vitest';

const explore = vi.fn();
const dispose = vi.fn();

vi.mock('../../src/services/ModelProvider', () => ({
  createModelProvider: vi.fn(() => ({
    explore,
    dispose,
  })),
}));

import { generateExplorationInsightService } from '../../src/plugin/explorationInsight';

describe('explorationInsight', () => {
  it('returns the AI exploration result and disposes the provider', async () => {
    explore.mockResolvedValueOnce({ insight: 'result' });
    const result = await generateExplorationInsightService({
      request: { theme: '测试' } as never,
      enableAI: true,
      aiConsentGranted: true,
      aiModel: 'local',
      getApiKey: vi.fn(async () => 'key'),
    });
    expect(result).toEqual({ insight: 'result' });
    expect(explore).toHaveBeenCalledTimes(1);
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('throws when the provider has no explore method', async () => {
    vi.mocked(
      (await import('../../src/services/ModelProvider')).createModelProvider,
    ).mockReturnValueOnce({ dispose } as never);
    await expect(
      generateExplorationInsightService({
        request: { theme: '测试' } as never,
        enableAI: false,
        aiConsentGranted: false,
        aiModel: 'local',
        getApiKey: vi.fn(async () => 'key'),
      }),
    ).rejects.toThrow('AI 尚未启用或未授权');
    expect(dispose).toHaveBeenCalled();
  });
});
