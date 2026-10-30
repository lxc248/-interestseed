import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AI_ENABLEMENT_NOTICE,
  DEEPSEEK_V4_PRO_CONFIG,
  DisabledModelProvider,
  ModelProviderError,
  OpenAICompatibleModelProvider,
  RELATION_REQUEST_FIELDS,
  buildRelationRequest,
  createModelProvider,
  resolveLocalApiKey,
} from '../src/services/ModelProvider';
import type { InterestSeedNode } from '../src/types/graph';

const NOW = '2026-01-01T00:00:00.000Z';

function node(overrides: Partial<InterestSeedNode> = {}): InterestSeedNode {
  return {
    id: 'node-1',
    type: 'document',
    title: '深度工作',
    sourceUri: 'vault:Notes/深度工作.md',
    tags: ['focus', '#效率'],
    createdAt: NOW,
    updatedAt: NOW,
    metadata: {
      path: 'Notes/深度工作.md',
      extension: 'md',
      summary: '这是一段不应该被发送的正文摘要。',
      links: ['Notes/刻意练习'],
    },
    ...overrides,
  };
}

describe('ModelProvider（v1 禁用状态）', () => {
  it('默认 provider 不可用，且不发起任何请求', async () => {
    const provider = createModelProvider();
    await expect(provider.isAvailable()).resolves.toBe(false);
    provider.dispose();
  });

  it('禁用状态下调用 suggestRelations 抛明确错误', async () => {
    const provider = new DisabledModelProvider();

    await expect(provider.suggestRelations({ nodes: [] })).rejects.toBeInstanceOf(
      ModelProviderError,
    );
    await expect(provider.suggestRelations({ nodes: [] })).rejects.toMatchObject({
      code: 'disabled',
    });
  });

  it('dispose 可重复调用且不抛错', () => {
    const provider = new DisabledModelProvider();
    expect(() => {
      provider.dispose();
      provider.dispose();
    }).not.toThrow();
  });

  it('展示未来启用 AI 的隐私说明与字段清单', () => {
    expect(AI_ENABLEMENT_NOTICE).toContain('明确授权');
    expect(AI_ENABLEMENT_NOTICE).toContain('不会发送笔记正文');
    expect([...RELATION_REQUEST_FIELDS]).toEqual(['节点 id', '标题', '标签']);
  });

  it('只有 enableAI 与 consent 同时开启才创建实验 provider', () => {
    expect(
      createModelProvider({ enableAI: false, aiConsentGranted: true }),
    ).toBeInstanceOf(DisabledModelProvider);
    expect(
      createModelProvider({ enableAI: true, aiConsentGranted: false }),
    ).toBeInstanceOf(DisabledModelProvider);
    expect(
      createModelProvider({ enableAI: true, aiConsentGranted: true }),
    ).toBeInstanceOf(OpenAICompatibleModelProvider);
  });
});

describe('OpenAI-compatible experimental provider', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('prefers INTERESTSEED_AI_API_KEY and never falls back to a cloud key', () => {
    vi.stubEnv('INTERESTSEED_AI_API_KEY', 'test-primary');
    vi.stubEnv('DEEPSEEK_API_KEY', 'test-fallback');
    expect(resolveLocalApiKey()).toBe('test-primary');

    vi.unstubAllEnvs();
    vi.stubEnv('DEEPSEEK_API_KEY', 'test-fallback');
    expect(resolveLocalApiKey()).toBeUndefined();
  });

  it('uses the requested model/base URL and sends only id/title/tags', async () => {
    let captured: { url: string; init: RequestInit } | undefined;
    const fakeFetch = async (url: string, init: RequestInit): Promise<Response> => {
      captured = { url, init };
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: '{"suggestions":[]}' } }],
        }),
      } as Response;
    };
    const provider = new OpenAICompatibleModelProvider(
      DEEPSEEK_V4_PRO_CONFIG,
      fakeFetch as typeof fetch,
      'test-local-key',
    );

    await expect(provider.isAvailable()).resolves.toBe(true);
    await provider.suggestRelations(buildRelationRequest([node()]));
    const body = JSON.parse(String(captured?.init.body)) as {
      model: string;
      messages: Array<{ content: string }>;
      response_format: { type: string };
    };

    expect(captured?.url).toBe('http://localhost:7863/v1/chat/completions');
    expect(body.model).toBe('cn:deepseek-v4-pro');
    expect(body.response_format).toEqual({ type: 'json_object' });
    const serialized = String(captured?.init.body);
    expect(serialized).not.toContain('Notes/深度工作.md');
    expect(serialized).not.toContain('不应该被发送');
    expect(serialized).not.toContain('summary');
    expect((captured?.init.headers as Record<string, string>).Authorization).toBe(
      'Bearer test-local-key',
    );
    provider.dispose();
  });

  it('rebuilds runtime payload and ignores extra fields', async () => {
    let body = '';
    const fakeFetch = async (_url: string, init: RequestInit): Promise<Response> => {
      body = String(init.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: '{"suggestions":[]}' } }] }),
      } as Response;
    };
    const provider = new OpenAICompatibleModelProvider(
      DEEPSEEK_V4_PRO_CONFIG,
      fakeFetch as typeof fetch,
    );
    const unsafeRequest = {
      nodes: [
        {
          id: 'node-1',
          title: 'Title',
          tags: ['tag'],
          path: 'Notes/secret.md',
          summary: 'secret summary',
        },
      ],
    };

    await provider.suggestRelations(
      unsafeRequest as unknown as Parameters<typeof provider.suggestRelations>[0],
    );

    expect(body).not.toContain('Notes/secret.md');
    expect(body).not.toContain('secret summary');
    const parsedBody = JSON.parse(body) as {
      messages: Array<{ content: string }>;
    };
    expect(parsedBody.messages[1]?.content).toContain('"id":"node-1"');
    provider.dispose();
  });

  it('rejects malformed model content and does not leak network error text', async () => {
    const malformed = new OpenAICompatibleModelProvider(
      DEEPSEEK_V4_PRO_CONFIG,
      (async () =>
        ({
          ok: true,
          status: 200,
          json: async () => ({ choices: [{ message: { content: 'not-json' } }] }),
        }) as Response) as typeof fetch,
    );
    await expect(
      malformed.suggestRelations(buildRelationRequest([node()])),
    ).rejects.toMatchObject({ code: 'invalid-response' });

    const network = new OpenAICompatibleModelProvider(
      DEEPSEEK_V4_PRO_CONFIG,
      (async () => {
        throw new Error('network failed: test-primary');
      }) as typeof fetch,
    );
    await expect(
      network.suggestRelations(buildRelationRequest([node()])),
    ).rejects.toMatchObject({
      code: 'network',
      message: 'AI 本地服务不可用',
    });
    malformed.dispose();
    network.dispose();
  });

  it('accepts pure JSON and a fully fenced JSON object', async () => {
    for (const content of [
      '{"suggestions":[{"source":"node-1","target":"node-2","relation":"related-to"}]}',
      '```json\n{"suggestions":[]}\n```',
    ]) {
      const provider = new OpenAICompatibleModelProvider(
        DEEPSEEK_V4_PRO_CONFIG,
        (async () =>
          ({
            ok: true,
            status: 200,
            json: async () => ({ choices: [{ message: { content } }] }),
          }) as Response) as typeof fetch,
      );
      await expect(
        provider.suggestRelations(
          buildRelationRequest([node(), node({ id: 'node-2' })]),
        ),
      ).resolves.toMatchObject({ suggestions: expect.any(Array) });
      provider.dispose();
    }
  });

  it('rejects prose, mixed prose+JSON, malformed fields and empty content', async () => {
    const cases = [
      'These 6 nodes are all tagged theme8.',
      'Here is the JSON:\n{"suggestions":[]}',
      '{"suggestions":[{"source":"node-1"}]}',
      '{"suggestions":[{"source":1,"target":"b","relation":"r"}]}',
      '   ',
    ];
    for (const content of cases) {
      const provider = new OpenAICompatibleModelProvider(
        DEEPSEEK_V4_PRO_CONFIG,
        (async () =>
          ({
            ok: true,
            status: 200,
            json: async () => ({ choices: [{ message: { content } }] }),
          }) as Response) as typeof fetch,
      );
      await expect(
        provider.suggestRelations(buildRelationRequest([node()])),
      ).rejects.toMatchObject({ code: 'invalid-response' });
      provider.dispose();
    }
  });

  it('rejects unknown node ids and self-loop suggestions', async () => {
    for (const content of [
      '{"suggestions":[{"source":"node-1","target":"unknown","relation":"r"}]}',
      '{"suggestions":[{"source":"node-1","target":"node-1","relation":"r"}]}',
    ]) {
      const provider = new OpenAICompatibleModelProvider(
        DEEPSEEK_V4_PRO_CONFIG,
        (async () =>
          ({
            ok: true,
            status: 200,
            json: async () => ({ choices: [{ message: { content } }] }),
          }) as Response) as typeof fetch,
      );
      await expect(
        provider.suggestRelations(buildRelationRequest([node()])),
      ).rejects.toMatchObject({ code: 'invalid-response' });
      provider.dispose();
    }
  });

  it('does not retry or switch models on HTTP failure', async () => {    let calls = 0;
    const fakeFetch = async (): Promise<Response> => {
      calls += 1;
      return { ok: false, status: 503, json: async () => ({}) } as Response;
    };
    const provider = new OpenAICompatibleModelProvider(
      DEEPSEEK_V4_PRO_CONFIG,
      fakeFetch as typeof fetch,
    );

    await expect(
      provider.suggestRelations(buildRelationRequest([node()])),
    ).rejects.toMatchObject({ code: 'http' });
    expect(calls).toBe(1);
    provider.dispose();
  });

  it('rejects invalid model response without touching local discovery', async () => {
    const fakeFetch = async (): Promise<Response> =>
      ({
        ok: true,
        status: 200,
        json: async () => ({ choices: [] }),
      }) as Response;
    const provider = new OpenAICompatibleModelProvider(
      DEEPSEEK_V4_PRO_CONFIG,
      fakeFetch as typeof fetch,
    );

    await expect(
      provider.suggestRelations(buildRelationRequest([node()])),
    ).rejects.toMatchObject({ code: 'invalid-response' });
    provider.dispose();
  });
});

describe('buildRelationRequest', () => {
  it('只发送 id / 标题 / 标签，不泄漏摘要、路径、链接与 metadata', () => {
    const request = buildRelationRequest([node()]);

    expect(request.nodes).toHaveLength(1);
    expect(request.nodes[0]).toEqual({
      id: 'node-1',
      title: '深度工作',
      tags: ['focus', '#效率'],
    });

    const serialized = JSON.stringify(request);
    expect(serialized).not.toContain('Notes/深度工作.md');
    expect(serialized).not.toContain('不应该被发送');
    expect(serialized).not.toContain('刻意练习');
    expect(serialized).not.toContain('metadata');
    expect(serialized).not.toContain('summary');
  });

  it('复制标签数组，修改请求不会影响原节点', () => {
    const source = node();
    const request = buildRelationRequest([source]);
    request.nodes[0]?.tags.push('extra');

    expect(source.tags).toEqual(['focus', '#效率']);
  });

  it('空节点列表返回空请求', () => {
    expect(buildRelationRequest([])).toEqual({ nodes: [] });
  });
});
