import { describe, expect, it } from 'vitest';
import {
  writeConfirmedAiSuggestion,
  type AiSuggestionWriter,
} from '../src/services/AiSuggestionConfirmation';
import type { InterestSeedEdge } from '../src/types/graph';

function context(overrides: Partial<Parameters<typeof writeConfirmedAiSuggestion>[1]> = {}) {
  return {
    aiEnabled: true,
    consentGranted: true,
    hasNode: (id: string) => id === 'a' || id === 'b',
    hasEdge: () => false,
    ...overrides,
  };
}

function writer(overrides: Partial<AiSuggestionWriter> = {}) {
  const added: InterestSeedEdge[] = [];
  const removed: string[] = [];
  let flushed = 0;
  const result: AiSuggestionWriter = {
    addEdge: (edge) => {
      added.push(edge);
    },
    removeEdge: (edgeId) => {
      removed.push(edgeId);
    },
    flush: async () => {
      flushed += 1;
    },
    saveFailed: () => false,
    ...overrides,
  };
  return { result, added, removed, flushed: () => flushed };
}

describe('AI suggestion confirmation writer', () => {
  it('does not add an edge when AI is off or consent is absent', async () => {
    const fake = writer();
    const suggestion = { source: 'a', target: 'b', relation: '相关' };
    expect(
      await writeConfirmedAiSuggestion(suggestion, context({ aiEnabled: false }), fake.result),
    ).toMatchObject({ ok: false });
    expect(
      await writeConfirmedAiSuggestion(suggestion, context({ consentGranted: false }), fake.result),
    ).toMatchObject({ ok: false });
    expect(fake.added).toHaveLength(0);
  });

  it('does not add an edge for missing nodes, self-loop or duplicate', async () => {
    const fake = writer();
    const suggestion = { source: 'a', target: 'b', relation: '相关' };
    expect(
      await writeConfirmedAiSuggestion(
        { ...suggestion, target: 'missing' },
        context({ hasNode: (id) => id === 'a' }),
        fake.result,
      ),
    ).toMatchObject({ ok: false });
    expect(
      await writeConfirmedAiSuggestion({ ...suggestion, target: 'a' }, context(), fake.result),
    ).toMatchObject({ ok: false });
    expect(
      await writeConfirmedAiSuggestion(suggestion, context({ hasEdge: () => true }), fake.result),
    ).toMatchObject({ ok: false });
    expect(fake.added).toHaveLength(0);
  });

  it('writes an ai/confirmed edge and only succeeds after flush', async () => {
    const fake = writer();
    const result = await writeConfirmedAiSuggestion(
      { source: 'a', target: 'b', relation: '相关' },
      context(),
      fake.result,
    );

    expect(result).toEqual({ ok: true });
    expect(fake.added).toHaveLength(1);
    expect(fake.added[0]).toMatchObject({
      source: 'a',
      target: 'b',
      relation: '相关',
      origin: 'ai',
      status: 'confirmed',
      evidence: ['AI 建议，用户确认'],
    });
    expect(fake.flushed()).toBe(1);
  });

  it('does not report success when add or flush fails', async () => {
    const addFailure = writer({
      addEdge: () => {
        throw new Error('duplicate-edge');
      },
    });
    expect(
      await writeConfirmedAiSuggestion(
        { source: 'a', target: 'b', relation: '相关' },
        context(),
        addFailure.result,
      ),
    ).toMatchObject({ ok: false });

    const flushFailure = writer({
      flush: async () => {
        throw new Error('disk full');
      },
    });
    expect(
      await writeConfirmedAiSuggestion(
        { source: 'a', target: 'b', relation: '相关' },
        context(),
        flushFailure.result,
      ),
    ).toMatchObject({ ok: false });
    expect(flushFailure.removed).toHaveLength(1);

    const saveFailed = writer({ saveFailed: () => true });
    expect(
      await writeConfirmedAiSuggestion(
        { source: 'a', target: 'b', relation: '相关' },
        context(),
        saveFailed.result,
      ),
    ).toMatchObject({ ok: false });
  });
});
