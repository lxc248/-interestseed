import { MAX_AI_RELATION_LENGTH, type AiRelationSuggestion } from './ModelProvider';

export interface AiSuggestionWriteContext {
  aiEnabled: boolean;
  consentGranted: boolean;
  hasNode(id: string): boolean;
  hasEdge(source: string, target: string, relation: string): boolean;
}

export interface AiSuggestionWriteCheck {
  ok: boolean;
  reason?: string;
}

/** 确认前的重新校验；不写入、不联网。 */
export function validateAiSuggestionForWrite(
  suggestion: AiRelationSuggestion,
  context: AiSuggestionWriteContext,
): AiSuggestionWriteCheck {
  if (!context.aiEnabled || !context.consentGranted) {
    return { ok: false, reason: 'AI 已关闭或授权已撤销，未写入。' };
  }
  const source = suggestion.source.trim();
  const target = suggestion.target.trim();
  const relation = suggestion.relation.trim();
  if (!source || !target || !relation) {
    return { ok: false, reason: '建议字段为空，未写入。' };
  }
  if (relation.length > MAX_AI_RELATION_LENGTH) {
    return { ok: false, reason: '关系名过长，未写入。' };
  }
  if (source === target) {
    return { ok: false, reason: '不支持自环关系，未写入。' };
  }
  if (!context.hasNode(source) || !context.hasNode(target)) {
    return { ok: false, reason: '来源或目标节点已失效，未写入。' };
  }
  if (context.hasEdge(source, target, relation)) {
    return { ok: false, reason: '该关系已存在，未重复新增。' };
  }
  return { ok: true };
}
