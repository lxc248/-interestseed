import type { InterestSeedGraph } from '../types/graph';
import type {
  Discovery,
  DiscoveryApplicationState,
  DiscoveryFeedbackStatus,
  DiscoveryFile,
} from './types';

export interface DiscoveryOverviewTheme {
  key: string;
  active: number;
  accepted: number;
  corrected: number;
  lowValue: number;
  applied: number;
}

export interface DiscoveryOverviewEdge {
  edgeId: string;
  source: string;
  target: string;
  relation: string;
  discoveryId: string;
}

export interface DiscoveryOverview {
  total: number;
  active: number;
  dismissed: number;
  superseded: number;
  feedback: Record<DiscoveryFeedbackStatus, number>;
  application: Record<DiscoveryApplicationState, number>;
  themes: DiscoveryOverviewTheme[];
  appliedEdges: DiscoveryOverviewEdge[];
  recent: Array<{
    id: string;
    title: string;
    feedback: DiscoveryFeedbackStatus;
    status: Discovery['status'];
    application: DiscoveryApplicationState;
  }>;
}

const EMPTY_FEEDBACK: Record<DiscoveryFeedbackStatus, number> = {
  none: 0,
  accepted: 0,
  rejected: 0,
  corrected: 0,
  'low-value': 0,
  'needs-verification': 0,
};

const EMPTY_APPLICATION: Record<DiscoveryApplicationState, number> = {
  none: 0,
  applying: 0,
  applied: 0,
  existing: 0,
  failed: 0,
  stale: 0,
  'recovery-required': 0,
};

function themeKey(discovery: Discovery): string {
  return discovery.subjectKeys.length > 0
    ? discovery.subjectKeys.join(' · ')
    : '未分类主题';
}

/**
 * 只读总览：不修改发现、反馈或图谱。
 * 仅聚合已有记录，作为“探索/回顾”入口。
 */
export function buildDiscoveryOverview(
  file: DiscoveryFile,
  graph: InterestSeedGraph,
): DiscoveryOverview {
  const feedback = { ...EMPTY_FEEDBACK };
  const application = { ...EMPTY_APPLICATION };
  const themeMap = new Map<string, DiscoveryOverviewTheme>();
  const edgeMap = new Map<string, DiscoveryOverviewEdge>();

  for (const item of file.discoveries) {
    feedback[item.feedbackStatus] += 1;
    const app = item.application?.state ?? 'none';
    application[app] += 1;

    const key = themeKey(item);
    const theme =
      themeMap.get(key) ??
      {
        key,
        active: 0,
        accepted: 0,
        corrected: 0,
        lowValue: 0,
        applied: 0,
      };
    if (item.status === 'active') theme.active += 1;
    if (item.feedbackStatus === 'accepted') theme.accepted += 1;
    if (item.feedbackStatus === 'corrected') theme.corrected += 1;
    if (item.feedbackStatus === 'low-value') theme.lowValue += 1;
    if (app === 'applied' || app === 'existing') theme.applied += 1;
    themeMap.set(key, theme);

    const edgeId = item.application?.edgeId;
    if ((app === 'applied' || app === 'existing') && edgeId) {
      const edge = graph.edges.find((candidate) => candidate.id === edgeId);
      if (edge) {
        edgeMap.set(edge.id, {
          edgeId: edge.id,
          source: edge.source,
          target: edge.target,
          relation: edge.relation,
          discoveryId: item.id,
        });
      }
    }
  }

  return {
    total: file.discoveries.length,
    active: file.discoveries.filter((item) => item.status === 'active').length,
    dismissed: file.discoveries.filter((item) => item.status === 'dismissed').length,
    superseded: file.discoveries.filter((item) => Boolean(item.supersededBy)).length,
    feedback,
    application,
    themes: [...themeMap.values()].sort(
      (left, right) =>
        right.active - left.active ||
        right.accepted - left.accepted ||
        left.key.localeCompare(right.key),
    ),
    appliedEdges: [...edgeMap.values()],
    recent: [...file.discoveries]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, 5)
      .map((item) => ({
        id: item.id,
        title: item.title,
        feedback: item.feedbackStatus,
        status: item.status,
        application: item.application?.state ?? 'none',
      })),
  };
}
