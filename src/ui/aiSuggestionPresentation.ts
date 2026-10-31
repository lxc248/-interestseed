import type { AiRelationSuggestion } from '../services/ModelProvider';

export type AiSuggestionStatus =
  | 'pending'
  | 'confirming'
  | 'accepted'
  | 'undone'
  | 'ignored'
  | 'failed'
  | 'invalid';

export interface AiSuggestionRow extends AiRelationSuggestion {
  id: string;
  status: AiSuggestionStatus;
  message?: string;
}

export const AI_SUGGESTION_STATUS_LABELS: Record<AiSuggestionStatus, string> = {
  pending: '待确认',
  confirming: '确认中',
  accepted: '已接受',
  undone: '已撤销',
  ignored: '已忽略',
  failed: '失败',
  invalid: '已失效',
};

export function aiSuggestionId(suggestion: AiRelationSuggestion): string {
  return `${suggestion.source}\u0000${suggestion.target}\u0000${suggestion.relation}`;
}

export function createAiSuggestionRows(
  suggestions: AiRelationSuggestion[],
  getNodeTitle: (id: string) => string | null,
): AiSuggestionRow[] {
  return suggestions.map((suggestion) => {
    const sourceMissing = getNodeTitle(suggestion.source) === null;
    const targetMissing = getNodeTitle(suggestion.target) === null;
    return {
      ...suggestion,
      id: aiSuggestionId(suggestion),
      status: sourceMissing || targetMissing ? 'invalid' : 'pending',
      message:
        sourceMissing || targetMissing
          ? '来源或目标节点已不存在，不能确认。'
          : undefined,
    };
  });
}
