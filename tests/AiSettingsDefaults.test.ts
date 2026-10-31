import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
} from '../src/settings/defaults';
import {
  DEEPSEEK_V4_PRO_CONFIG,
  createModelProvider,
} from '../src/services/ModelProvider';

describe('AI defaults', () => {
  it('enables AI and consent by default for new installs', () => {
    expect(DEFAULT_SETTINGS.enableAI).toBe(true);
    expect(DEFAULT_SETTINGS.aiConsentGranted).toBe(true);
    expect(DEFAULT_SETTINGS.aiProvider).toBe(DEEPSEEK_V4_PRO_CONFIG.model);

    const normalized = normalizeSettings(undefined);
    expect(normalized.enableAI).toBe(true);
    expect(normalized.aiConsentGranted).toBe(true);
  });

  it('keeps an explicit opt-out', () => {
    const normalized = normalizeSettings({
      enableAI: false,
      aiConsentGranted: false,
    });
    expect(normalized.enableAI).toBe(false);
    expect(normalized.aiConsentGranted).toBe(false);
  });

  it('creates a provider only after enable and consent', async () => {
    const disabled = createModelProvider(
      { enableAI: false, aiConsentGranted: true },
      vi.fn(),
    );
    expect(await disabled.isAvailable()).toBe(false);
    disabled.dispose();

    const enabled = createModelProvider(
      { enableAI: true, aiConsentGranted: true },
      vi.fn(),
    );
    expect(await enabled.isAvailable()).toBe(true);
    enabled.dispose();
  });
});
