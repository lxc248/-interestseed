import {
  createModelProvider,
  type ExplorationInsight,
  type ExplorationRequest,
} from '../services/ModelProvider';

export async function generateExplorationInsightService(input: {
  request: ExplorationRequest;
  enableAI: boolean;
  aiConsentGranted: boolean;
  aiModel: string;
  getApiKey: () => Promise<string | undefined>;
}): Promise<ExplorationInsight> {
  const apiKey = await input.getApiKey();
  const provider = createModelProvider(
    {
      enableAI: input.enableAI,
      aiConsentGranted: input.aiConsentGranted,
      model: input.aiModel,
    },
    undefined,
    apiKey,
  );
  try {
    if (!provider.explore) {
      throw new Error('AI 尚未启用或未授权；请在设置中启用 AI 并确认隐私授权。');
    }
    const result = await provider.explore(input.request);
    return result as ExplorationInsight;
  } finally {
    provider.dispose();
  }
}
