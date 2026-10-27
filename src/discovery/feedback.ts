import type {
  Discovery,
  DiscoveryCorrection,
  DiscoveryFeedbackAction,
  DiscoveryFeedbackEvent,
  DiscoveryFeedbackStatus,
  DiscoveryFile,
} from './types';

function feedbackStatus(action: DiscoveryFeedbackAction): DiscoveryFeedbackStatus {
  if (action === 'accepted') return 'accepted';
  if (action === 'rejected') return 'rejected';
  if (action === 'corrected') return 'corrected';
  if (action === 'low-value') return 'low-value';
  return 'needs-verification';
}

function nextStatus(action: DiscoveryFeedbackAction): Discovery['status'] {
  return action === 'rejected' || action === 'low-value' ? 'dismissed' : 'active';
}

function eventId(item: Discovery, action: string, now: string, length: number): string {
  return `${item.id}:${action}:${now}:${length}`;
}

/** 应用一次反馈；修正内容作为独立数据保存，不覆盖原始发现文本。 */
export function applyDiscoveryFeedback(
  file: DiscoveryFile,
  id: string,
  action: DiscoveryFeedbackAction,
  now: string = new Date().toISOString(),
  correction?: DiscoveryCorrection,
): DiscoveryFile {
  let changed = false;
  const discoveries: Discovery[] = file.discoveries.map((item) => {
    if (item.id !== id) return item;
    const appState = item.application?.state;
    if (appState === 'applying' || appState === 'recovery-required') return item;
    // 系统自动收敛的记录不能被普通反馈重新激活；否则会产生
    // status=active + supersededBy 的非法形状，导致后续保存校验失败。
    if (item.supersededBy) return item;
    changed = true;
    const history = item.feedbackHistory ?? [];
    const normalizedCorrection =
      action === 'corrected'
        ? {
            title: correction?.title?.trim() || item.title,
            description: correction?.description?.trim() || item.description,
            createdAt: correction?.createdAt ?? now,
          }
        : item.correction;
    const event: DiscoveryFeedbackEvent = {
      id: eventId(item, action, now, history.length),
      action,
      at: now,
      previousStatus: item.feedbackStatus,
      ...(action === 'corrected' && normalizedCorrection
        ? { correction: normalizedCorrection }
        : {}),
    };
    return {
      ...item,
      status: nextStatus(action),
      feedbackStatus: feedbackStatus(action),
      correction: normalizedCorrection,
      feedbackHistory: [...history, event],
      updatedAt: now,
    };
  });

  if (!changed) return file;
  return {
    ...file,
    updatedAt: now,
    discoveries,
  };
}

/**
 * 软撤销：只恢复当前反馈到 none，不删除记录/证据/历史，不删除图谱关系。
 * 应用处于 applying/recovery-required 时拒绝撤销，避免把未完成应用误恢复为可应用。
 */
export function undoDiscoveryFeedback(
  file: DiscoveryFile,
  id: string,
  now: string = new Date().toISOString(),
): DiscoveryFile {
  let changed = false;
  const discoveries: Discovery[] = file.discoveries.map((item) => {
    if (item.id !== id || item.feedbackStatus === 'none') return item;
    const appState = item.application?.state;
    if (appState === 'applying' || appState === 'recovery-required') return item;
    if (item.supersededBy) return item;
    changed = true;
    const history = item.feedbackHistory ?? [];
    const event: DiscoveryFeedbackEvent = {
      id: eventId(item, 'undo', now, history.length),
      action: 'undo',
      at: now,
      previousStatus: item.feedbackStatus,
    };
    return {
      ...item,
      status: 'active',
      feedbackStatus: 'none',
      correction: item.correction,
      feedbackHistory: [...history, event],
      updatedAt: now,
    };
  });

  if (!changed) return file;
  return {
    ...file,
    updatedAt: now,
    discoveries,
  };
}
