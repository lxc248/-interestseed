/** 确定性字典序比较，避免依赖 locale。 */
export function compareText(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}
