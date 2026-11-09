import { type App } from 'obsidian';
import { AiSetupModal } from '../ui/AiSetupModal';
import { DEEPSEEK_V4_PRO_CONFIG } from '../services/ModelProvider';

export function openAiSetupModal(input: {
  app: App;
  manifestId: string;
  aiModel: string;
  enableAI: boolean;
  aiConsentGranted: boolean;
  getKey: () => Promise<string | undefined>;
  saveKey: (value: string) => Promise<void>;
}): void {
  void input.getKey().then((key) => {
    new AiSetupModal(input.app, {
      endpoint: DEEPSEEK_V4_PRO_CONFIG.baseUrl,
      providerLabel: `本地模型 · ${input.aiModel}`,
      enabled: input.enableAI,
      consentGranted: input.aiConsentGranted,
      hasKey: Boolean(key),
      onSaveKey: (value) => input.saveKey(value),
      onOpenSettings: () => {
        const setting = (
          input.app as unknown as {
            setting?: { open(): void; openTabById(id: string): void };
          }
        ).setting;
        setting?.open();
        setting?.openTabById(input.manifestId);
      },
    }).open();
  });
}
