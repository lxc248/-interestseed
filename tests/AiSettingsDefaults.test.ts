import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
} from '../src/settings/defaults';
import {
  DEFAULT_AI_MODEL,
  createModelProvider,
} from '../src/services/ModelProvider';

describe('AI defaults', () => {
  it('keeps AI and consent off by default for new installs', () => {
    expect(DEFAULT_SETTINGS.enableAI).toBe(false);
    expect(DEFAULT_SETTINGS.aiConsentGranted).toBe(false);
    expect(DEFAULT_SETTINGS.aiProvider).toBe('local');
    expect(DEFAULT_SETTINGS.aiModel).toBe(DEFAULT_AI_MODEL);

    const normalized = normalizeSettings(undefined);
    expect(normalized.enableAI).toBe(false);
    expect(normalized.aiConsentGranted).toBe(false);
    expect(normalized.aiModel).toBe(DEFAULT_AI_MODEL);
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
