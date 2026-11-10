import { describe, expect, it, vi } from 'vitest';

const open = vi.fn();
const constructed: unknown[] = [];

vi.mock('../../src/ui/AiSetupModal', () => ({
  AiSetupModal: class {
    constructor(public app: unknown, public options: unknown) {
      constructed.push(this);
    }
    open() {
      open(this);
    }
  },
}));

vi.mock('../../src/services/ModelProvider', () => ({
  DEEPSEEK_V4_PRO_CONFIG: { baseUrl: 'http://localhost:7863/v1' },
}));

import { openAiSetupModal } from '../../src/plugin/aiSetup';

describe('aiSetup', () => {
  it('opens the AI setup modal with current settings', async () => {
    const getKey = vi.fn(async () => 'key');
    const saveKey = vi.fn(async () => undefined);
    openAiSetupModal({
      app: {} as never,
      manifestId: 'interestseed',
      aiModel: 'local',
      enableAI: true,
      aiConsentGranted: true,
      getKey,
      saveKey,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(constructed).toHaveLength(1);
    expect(open).toHaveBeenCalledTimes(1);
    const options = (constructed[0] as { options: Record<string, unknown> }).options;
    expect(options.endpoint).toBe('http://localhost:7863/v1');
    expect(options.providerLabel).toBe('本地模型 · local');
    expect(options.enabled).toBe(true);
    expect(options.hasKey).toBe(true);
  });

  it('opens the settings tab when requested', async () => {
    const open = vi.fn();
    const openTabById = vi.fn();
    openAiSetupModal({
      app: { setting: { open, openTabById } } as never,
      manifestId: 'interestseed',
      aiModel: 'local',
      enableAI: true,
      aiConsentGranted: true,
      getKey: vi.fn(async () => 'key'),
      saveKey: vi.fn(async () => undefined),
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const options = (constructed.at(-1) as { options: { onOpenSettings: () => void } }).options;
    options.onOpenSettings();
    expect(open).toHaveBeenCalledTimes(1);
    expect(openTabById).toHaveBeenCalledWith('interestseed');
  });

  it('passes consent false into the modal', async () => {
    openAiSetupModal({
      app: {} as never,
      manifestId: 'interestseed',
      aiModel: 'local',
      enableAI: false,
      aiConsentGranted: false,
      getKey: vi.fn(async () => undefined),
      saveKey: vi.fn(async () => undefined),
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const options = (constructed.at(-1) as { options: { consentGranted: boolean } }).options;
    expect(options.consentGranted).toBe(false);
  });
});
