import type { Discovery } from './types';

/**
 * 反馈感知的确定性排序。
 *
 * 这不是模型分数，也不使用全局权重。它只是把“当前这条发现的状态”
 * 放到明确的优先级桶里，再沿用原来的强度/稳定 ID 顺序。
 *
 * 只影响展示顺序：
 * - 不改变发现 ID；
 * - 不改变证据或强度；
 * - 不把候选转成正式图谱关系；
 * - 不把拒绝解释为对主题的永久偏好。
 */

export type DiscoveryPriority = 0 | 1 | 2 | 3 | 4 | 5;

export function discoveryPriority(item: Discovery): DiscoveryPriority {
  if (
    item.status === 'dismissed' ||
    item.feedbackStatus === 'rejected' ||
    item.feedbackStatus === 'low-value'
  ) {
    return 5;
  }
  if (item.application?.state === 'applied' || item.application?.state === 'existing') {
    return 4;
  }
  if (item.feedbackStatus === 'accepted') return 0;
  if (item.feedbackStatus === 'corrected' || item.feedbackStatus === 'needs-verification') {
    return 1;
  }
  return 2;
}

export function discoveryPriorityLabel(item: Discovery): string {
  if (item.supersededBy) return '自动收敛';
  const priority = discoveryPriority(item);
  if (priority === 0) return '已接受，待处理';
  if (priority === 1) return item.feedbackStatus === 'corrected' ? '已修正' : '待验证';
  if (priority === 2) return '新发现';
  if (priority === 4) return '已应用/已存在关系';
  if (priority === 5) {
    return item.feedbackStatus === 'low-value' ? '已标记低价值' : '已拒绝/已抑制';
  }
  return '未分类';
}

function strengthRank(item: Discovery): number {
  if (item.strength === 'strong') return 0;
  if (item.strength === 'moderate') return 1;
  return 2;
}

export function compareDiscoveries(left: Discovery, right: Discovery): number {
  const priority = discoveryPriority(left) - discoveryPriority(right);
  if (priority !== 0) return priority;

  const strength = strengthRank(left) - strengthRank(right);
  if (strength !== 0) return strength;

  if (left.id === right.id) return 0;
  return left.id < right.id ? -1 : 1;
}

export function sortDiscoveries(discoveries: readonly Discovery[]): Discovery[] {
  return [...discoveries].sort(compareDiscoveries);
}
