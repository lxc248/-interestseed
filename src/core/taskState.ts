export type InterestTaskState =
  | 'captured'
  | 'judged'
  | 'connected'
  | 'experimenting'
  | 'reviewed';

export const TASK_STATE_LABELS: Record<InterestTaskState, string> = {
  captured: '已捕获',
  judged: '已判断',
  connected: '已连接',
  experimenting: '验证中',
  reviewed: '已复盘',
};

export function isInterestTaskState(value: unknown): value is InterestTaskState {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(TASK_STATE_LABELS, value)
  );
}

/** Infer a state for old graphs that predate taskState metadata. */
export function resolveTaskState(
  metadata: Record<string, unknown> | undefined,
  hasConnection: boolean,
): InterestTaskState {
  const explicit = isInterestTaskState(metadata?.taskState) ? metadata.taskState : null;
  if (explicit === 'experimenting' || explicit === 'reviewed') return explicit;
  if (metadata?.nextStep === true) return 'experimenting';
  if (hasConnection) return 'connected';
  if (explicit) return explicit;
  return 'captured';
}
