import type { Discovery } from '../discovery/types';
import { pathFromUri } from '../utils/paths';

export interface DiscoveryDisplayMetrics {
  nodeCount: number;
  evidenceCount: number;
  sourceEvidenceCount: number;
  sharedTagEvidenceCount: number;
  confirmedEvidenceCount: number;
  sourceComplete: boolean;
  traceableEvidenceCount: number;
}

/**
 * sourceUri 的内部约定：非空，且能解析为非空 vault 相对路径。
 * 不要求 HTTP/HTTPS；显式外部 URL 不属于当前内部来源约定。
 */
export function isValidSourceUri(uri: string | undefined): boolean {
  if (typeof uri !== 'string') return false;
  const trimmed = uri.trim();
  if (!trimmed) return false;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return false;
  const raw = trimmed.toLowerCase().startsWith('vault:')
    ? trimmed.slice('vault:'.length)
    : trimmed;
  if (raw.startsWith('/') || raw.startsWith('\\')) return false;
  if (/^[a-z]:[\\/]/i.test(raw)) return false;
  return pathFromUri(trimmed).length > 0;
}

/** 仅用于展示的同主题分组键；不改变发现身份。 */
export function discoveryThemeKey(discovery: Discovery): string {
  return [...discovery.subjectKeys].sort().join('\u0000');
}

/** 按共享主题分组，但保留每个发现的独立身份与反馈。 */
export function groupDiscoveriesByTheme(
  discoveries: Discovery[],
): Map<string, Discovery[]> {
  const groups = new Map<string, Discovery[]>();
  for (const discovery of discoveries) {
    const key = discoveryThemeKey(discovery);
    const list = groups.get(key);
    if (list) list.push(discovery);
    else groups.set(key, [discovery]);
  }
  return groups;
}

/**
 * 同主题活动候选计数。
 *
 * 只统计 `status === 'active'`；`dismissed` 视为已抑制，不进入计数。
 * feedbackStatus 与 application.state 是其他维度，不改变活动计数。
 */
export function activeThemePeerCounts(
  discoveries: Discovery[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const discovery of discoveries) {
    if (discovery.status !== 'active') continue;
    const key = discoveryThemeKey(discovery);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/**
 * 展示型计数，不是质量评分。
 * 只统计现有 Discovery.evidence 和 nodeIds 中可直接核验的事实。
 */
export function discoveryDisplayMetrics(
  discovery: Discovery,
): DiscoveryDisplayMetrics {
  const sourceEvidence = discovery.evidence.filter(
    (item) => item.kind === 'source',
  );
  const sharedTagEvidence = discovery.evidence.filter(
    (item) => item.kind === 'shared-tag',
  );
  const confirmedEvidence = discovery.evidence.filter(
    (item) => item.kind === 'confirmed-edge',
  );
  const sourceComplete =
    discovery.nodeIds.length > 0 &&
    discovery.nodeIds.every((nodeId) =>
      sourceEvidence.some(
        (item) => item.nodeId === nodeId && isValidSourceUri(item.sourceUri),
      ),
    );
  const traceableEvidence = discovery.evidence.filter((item) => {
    if (!discovery.nodeIds.includes(item.nodeId)) return false;
    if (!item.text.trim()) return false;
    if (item.kind === 'source') return isValidSourceUri(item.sourceUri);
    return true;
  });

  return {
    nodeCount: discovery.nodeIds.length,
    evidenceCount: discovery.evidence.length,
    sourceEvidenceCount: sourceEvidence.length,
    sharedTagEvidenceCount: sharedTagEvidence.length,
    confirmedEvidenceCount: confirmedEvidence.length,
    sourceComplete,
    traceableEvidenceCount: traceableEvidence.length,
  };
}
