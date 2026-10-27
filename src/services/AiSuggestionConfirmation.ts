import { edgeIdFor } from '../utils/ids';
import type { InterestSeedEdge } from '../types/graph';
import type { AiRelationSuggestion } from './ModelProvider';
import {
  validateAiSuggestionForWrite,
  type AiSuggestionWriteContext,
} from './AiSuggestionValidation';

export interface AiSuggestionWriter {
  addEdge(edge: InterestSeedEdge): void;
  removeEdge?(edgeId: string): void;
  flush(): Promise<void>;
  saveFailed(): boolean;
}

export interface AiSuggestionConfirmResult {
  ok: boolean;
  message?: string;
}

/**
 * 将一条已由用户确认的候选写入正式图谱，并在持久化成功后才返回 ok。
 * 失败不会自动重试；调用方负责把结果映射到 UI 状态。
 */
export async function writeConfirmedAiSuggestion(
  suggestion: AiRelationSuggestion,
  context: AiSuggestionWriteContext,
  writer: AiSuggestionWriter,
): Promise<AiSuggestionConfirmResult> {
  const check = validateAiSuggestionForWrite(suggestion, context);
  if (!check.ok) return { ok: false, message: check.reason };

  const name = suggestion.relation.trim();
  const now = new Date().toISOString();
  const edge: InterestSeedEdge = {
    id: edgeIdFor(suggestion.source, suggestion.target, name),
    source: suggestion.source,
    target: suggestion.target,
    relation: name,
    origin: 'ai',
    status: 'confirmed',
    evidence: ['AI 建议，用户确认'],
    createdAt: now,
    updatedAt: now,
  };

  let added = false;
  try {
    writer.addEdge(edge);
    added = true;
    await writer.flush();
    if (writer.saveFailed()) {
      writer.removeEdge?.(edge.id);
      return { ok: false, message: '写入图谱失败，未标记为已接受。' };
    }
    return { ok: true };
  } catch (error) {
    if (added) writer.removeEdge?.(edge.id);
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
