import { describe, expect, it, vi } from 'vitest';

import {
  exploreWithClaudian,
  hasClaudianApi,
} from '../src/services/ClaudianProvider';
import { ModelProviderError } from '../src/services/ModelProvider';
import type { ExplorationRequest } from '../src/services/ModelProvider';

function request(): ExplorationRequest {
  return {
    themes: [{ key: 'theme_1', active: 2, total: 3 }],
    projects: ['project_1'],
    activity: [{ date: '2026-01-01', count: 2 }],
  };
}

function fakeApp() {
  let listener: ((payload: { sessionId: string }) => void) | null = null;
  const api = {
    version: 1,
    getActiveSessionId: () => 'session-1',
    send: vi.fn(async () => {
      listener?.({ sessionId: 'session-1' });
      return 'started';
    }),
    read: vi.fn(async () =>
      JSON.stringify({
        summary: 'theme_1 有活动。',
        confidence: 0.6,
        reasoning: ['观察', '推断'],
        opportunities: [
          {
            title: '继续观察 theme_1',
            why: '有 2 条活动发现。',
            nextStep: '再收集一条。',
            themes: ['theme_1'],
            evidence: ['2 条活动'],
            confidence: 0.6,
          },
        ],
      }),
    ),
  };
  const app = {
    plugins: { getPlugin: (id: string) => (id === 'realclaudian' ? { api } : null) },
    workspace: {
      on: (_name: string, callback: (payload: { sessionId: string }) => void) => {
        listener = callback;
        return {};
      },
      offref: () => {},
    },
  };
  return { app: app as never, api };
}

describe('Claudian provider bridge', () => {
  it('detects a version 1 Claudian API', () => {
    const { app } = fakeApp();
    expect(hasClaudianApi(app)).toBe(true);
  });

  it('does not silently call a missing plugin', async () => {
    await expect(
      exploreWithClaudian({ plugins: { getPlugin: () => null } } as never, request()),
    ).rejects.toBeInstanceOf(ModelProviderError);
  });

  it('sends a prompt, waits for turn-ended and parses the reply', async () => {
    const { app, api } = fakeApp();
    const result = await exploreWithClaudian(app, request());
    expect(api.send).toHaveBeenCalledOnce();
    expect(api.read).toHaveBeenCalledWith('session-1');
    expect(result.opportunities[0]?.themes).toEqual(['theme_1']);
  });
});
