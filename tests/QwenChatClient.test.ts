import { afterEach, describe, expect, it, vi } from 'vitest';

import { QwenChatClient } from '../src/agent/QwenChatClient';
import { QWEN_CONFIG } from '../src/services/ModelProvider';
import type { ModelProviderError } from '../src/services/ModelProvider';

describe('QwenChatClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('fails closed without a token', async () => {
    vi.stubEnv('DASHSCOPE_API_KEY', '');
    vi.stubEnv('QWEN_API_KEY', '');
    const client = new QwenChatClient(QWEN_CONFIG, undefined);
    await expect(
      client.complete([{ role: 'user', content: 'hello' }]),
    ).rejects.toMatchObject<Partial<ModelProviderError>>({
      code: 'not-authorized',
    });
    client.dispose();
  });

  it('uses the user endpoint, model and token without exposing them in settings', async () => {
    let captured: { url: string; init: RequestInit } | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        captured = { url, init };
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: '千问回复' } }],
          }),
        } as Response;
      }),
    );
    const client = new QwenChatClient(
      {
        ...QWEN_CONFIG,
        baseUrl: 'https://example.test/v1/',
        model: 'qwen-plus',
      },
      'user-token',
    );
    await expect(
      client.complete([{ role: 'user', content: '你好' }]),
    ).resolves.toBe('千问回复');
    expect(captured?.url).toBe('https://example.test/v1/chat/completions');
    expect(JSON.parse(String(captured?.init.body)).model).toBe('qwen-plus');
    expect((captured?.init.headers as Record<string, string>).Authorization).toBe(
      'Bearer user-token',
    );
    client.dispose();
  });
});
