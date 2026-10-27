import { describe, expect, it } from 'vitest';
import { MAX_AI_RELATION_LENGTH } from '../src/services/ModelProvider';
import { validateAiSuggestionForWrite } from '../src/services/AiSuggestionValidation';

function context(overrides: Partial<Parameters<typeof validateAiSuggestionForWrite>[1]> = {}) {
  return {
    aiEnabled: true,
    consentGranted: true,
    hasNode: (id: string) => id === 'a' || id === 'b',
    hasEdge: () => false,
    ...overrides,
  };
}

describe('AI suggestion write validation', () => {
  it('accepts a valid suggestion', () => {
    expect(
      validateAiSuggestionForWrite({ source: 'a', target: 'b', relation: '相关' }, context()),
    ).toEqual({ ok: true });
  });

  it('rejects disabled AI or missing consent', () => {
    expect(
      validateAiSuggestionForWrite(
        { source: 'a', target: 'b', relation: '相关' },
        context({ aiEnabled: false }),
      ).ok,
    ).toBe(false);
    expect(
      validateAiSuggestionForWrite(
        { source: 'a', target: 'b', relation: '相关' },
        context({ consentGranted: false }),
      ).ok,
    ).toBe(false);
  });

  it('rejects missing nodes, self-loops, duplicates and overlong relations', () => {
    const base = { source: 'a', target: 'b', relation: '相关' };
    expect(
      validateAiSuggestionForWrite(
        { ...base, target: 'missing' },
        context({ hasNode: (id) => id === 'a' }),
      ).ok,
    ).toBe(false);
    expect(
      validateAiSuggestionForWrite({ ...base, target: 'a' }, context()).ok,
    ).toBe(false);
    expect(
      validateAiSuggestionForWrite(base, context({ hasEdge: () => true })).ok,
    ).toBe(false);
    expect(
      validateAiSuggestionForWrite(
        { ...base, relation: 'x'.repeat(MAX_AI_RELATION_LENGTH + 1) },
        context(),
      ).ok,
    ).toBe(false);
  });
});
