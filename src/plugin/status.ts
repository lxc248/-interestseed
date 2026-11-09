export interface InterestSeedStatus {
  scanning: boolean;
  lastError: string | null;
  blocked: boolean;
  blockedReason: string | null;
  saveFailed: boolean;
  nodes: number;
  edges: number;
  confirmed: number;
  suggested: number;
}

export interface StatusBarState {
  blocked?: boolean;
  blockedReason?: string | null;
  saveFailed?: boolean;
}

export interface StatusStats {
  nodes: number;
  edges: number;
  confirmed: number;
  suggested: number;
}

export function buildStatus(input: {
  scanning: boolean;
  lastError: string | null;
  state: StatusBarState | null | undefined;
  stats: StatusStats;
}): InterestSeedStatus {
  const state = input.state;
  return {
    scanning: input.scanning,
    lastError: input.lastError,
    blocked: state?.blocked ?? false,
    blockedReason: state?.blockedReason ?? null,
    saveFailed: state?.saveFailed ?? false,
    nodes: input.stats.nodes,
    edges: input.stats.edges,
    confirmed: input.stats.confirmed,
    suggested: input.stats.suggested,
  };
}

export function statusBarText(
  stats: StatusStats,
  state: StatusBarState | null | undefined,
  lastError: string | null,
): string {
  const suffix = state?.blocked
    ? ' · ⚠ 存储已暂停'
    : state?.saveFailed
      ? ' · ⚠ 未保存'
      : lastError
        ? ' · ⚠ 错误'
        : '';
  return `InterestSeed · ${stats.nodes} 节点 / ${stats.confirmed} 已确认 / ${stats.suggested} 建议${suffix}`;
}
