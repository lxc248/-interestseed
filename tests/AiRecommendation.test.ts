import { describe, expect, it } from 'vitest';
import {
  DEEPSEEK_V4_PRO_CONFIG,
  OpenAICompatibleModelProvider,
  buildRelationRequest,
  type AiSuggestionPayload,
} from '../src/services/ModelProvider';
import type { InterestSeedNode } from '../src/types/graph';

const node = (id: string, tags: string[]): InterestSeedNode => ({
  id,
  type: 'topic',
  title: id,
  tags,
  createdAt: '',
  updatedAt: '',
  metadata: {},
});

describe('AI relation request selection', () => {
  const nodes = [node('a', ['ai', '工具']), node('b', ['ai']), node('c', ['运动']), node('d', [])];

  it('puts the focus node first and prefers shared tags', () => {
    const request = buildRelationRequest(nodes, {
      focusNodeId: 'a',
      existingEdges: [{ source: 'a', target: 'd' }],
      maxNodes: 4,
      maxSuggestions: 5,
    });
    expect(request.focusNodeId).toBe('a');
    expect(request.nodes[0]?.id).toBe('a');
    expect(request.nodes.map((item) => item.id)).toContain('b');
    expect(request.existingEdges).toEqual([{ source: 'a', target: 'd' }]);
    expect(request.maxSuggestions).toBe(5);
  });

  it('without focus, starts from low-degree nodes', () => {
    const request = buildRelationRequest(nodes, {
      existingEdges: [{ source: 'a', target: 'd' }],
      maxNodes: 4,
    });
    expect(['b', 'c']).toContain(request.nodes[0]?.id);
    expect(request.focusNodeId).toBeUndefined();
  });
});

describe('AI relation response normalization', () => {
  it('keeps reason/confidence and dedupes unordered pairs', async () => {
    const fakeFetch = async (): Promise<Response> =>
      ({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  suggestions: [
                    { source: 'a', target: 'b', relation: '共享工具', reason: '都提到 AI', confidence: 0.82 },
                    { source: 'b', target: 'a', relation: '反向重复', reason: '重复', confidence: 0.9 },
                  ],
                }),
              },
            },
          ],
        }),
      }) as Response;
    const provider = new OpenAICompatibleModelProvider(
      DEEPSEEK_V4_PRO_CONFIG,
      fakeFetch as typeof fetch,
      'test-key',
    );
    const result = (await provider.suggestRelations(
      buildRelationRequest([node('a', ['ai']), node('b', ['ai'])], { maxSuggestions: 5 }),
    )) as AiSuggestionPayload;
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0]).toMatchObject({
      source: 'a',
      target: 'b',
      reason: '都提到 AI',
      confidence: 0.82,
    });
  });
});

