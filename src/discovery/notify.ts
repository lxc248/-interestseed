/** 逐个通知发现监听器；单个监听器异常不阻断其他监听器。 */
export function notifyDiscoveryListenersSafely(
  listeners: Iterable<() => void>,
  onError: (error: unknown) => void = (error) => {
    console.error('[InterestSeed] 发现监听器执行失败', error);
  },
): void {
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch (error) {
      try {
        onError(error);
      } catch {
        // 错误记录自身异常也不能阻断其他监听器或调用方。
      }
    }
  }
}
