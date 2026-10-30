import type { InterestSeedGraphStore } from '../core/GraphStore';
import type { InterestSeedEdge, InterestSeedNode } from '../types/graph';
import { compareText } from '../utils/text';

export interface SuggestionRow {
  edge: InterestSeedEdge;
  source: InterestSeedNode | undefined;
  target: InterestSeedNode | undefined;
}

export type SuggestionStore = Pick<InterestSeedGraphStore, 'getNode' | 'listEdges'>;

/**
 * 收件箱数据源：全图谱所有 suggested 边，不做 Top N 截断。
 * 关系身份始终是 edge.id；端点缺失时仍保留行，由 UI 安全降级显示。
 */
export function collectSuggestedEdges(store: SuggestionStore): SuggestionRow[] {
  return store
    .listEdges()
    .filter((edge) => edge.status === 'suggested')
    .sort(
      (left, right) =>
        (right.confidence ?? 0) - (left.confidence ?? 0) ||
        compareText(left.id, right.id),
    )
    .map((edge) => ({
      edge,
      source: store.getNode(edge.source),
      target: store.getNode(edge.target),
    }));
}
