import { describe, expect, it } from 'vitest';
import { createAiSuggestionRows, aiSuggestionId } from '../src/ui/aiSuggestionPresentation';

describe('AI suggestion presentation', () => {
  it('creates stable rows with titles for existing nodes', () => {
    const suggestions = [
      { source: 'a', target: 'b', relation: '相关' },
      { source: 'a', target: 'c', relation: '延伸' },
    ];
    const rows = createAiSuggestionRows(
      suggestions,
      (id) => ({ a: 'A', b: 'B', c: 'C' })[id] ?? null,
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]?.id).toBe(aiSuggestionId(suggestions[0]!));
    expect(rows[0]?.status).toBe('pending');
    expect(rows[1]?.status).toBe('pending');
  });

  it('marks rows invalid when a source or target node is missing', () => {
    const rows = createAiSuggestionRows(
      [
        { source: 'a', target: 'missing', relation: '相关' },
        { source: 'missing', target: 'b', relation: '相关' },
      ],
      (id) => ({ a: 'A', b: 'B' })[id] ?? null,
    );

    expect(rows.every((row) => row.status === 'invalid')).toBe(true);
    expect(rows.every((row) => row.message?.includes('不存在'))).toBe(true);
  });

  it('keeps the same id for the same suggestion in a batch', () => {
    const suggestion = { source: 'a', target: 'b', relation: '相关' };
    const first = createAiSuggestionRows([suggestion], () => 'title')[0]!;
    const second = createAiSuggestionRows([suggestion], () => 'title')[0]!;
    expect(first.id).toBe(second.id);
  });
});
