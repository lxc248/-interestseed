import type {
  DiscoveryExplorerData,
  ExplorationTheme,
} from './exploration';
import type { DiscoveryOverview } from './overview';

export type LocalInsightKind = 'bridge' | 'momentum' | 'quality' | 'coverage';

export interface LocalExplorationInsight {
  id: string;
  kind: LocalInsightKind;
  title: string;
  why: string;
  nextStep: string;
  themes: string[];
  evidence: string[];
  confidence: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function themeEvidence(theme: ExplorationTheme): string[] {
  const evidence = [
    `${theme.active} 条活动发现 / ${theme.total} 条总发现`,
    `横跨 ${theme.projectCount} 个项目`,
  ];
  if (theme.accepted > 0) evidence.push(`${theme.accepted} 条已接受`);
  if (theme.rejected > 0) evidence.push(`${theme.rejected} 条已拒绝`);
  if (theme.lowValue > 0) evidence.push(`${theme.lowValue} 条低价值`);
  if (theme.corrected > 0) evidence.push(`${theme.corrected} 条修正`);
  return evidence;
}

function topTheme(themes: ExplorationTheme[], predicate: (theme: ExplorationTheme) => boolean): ExplorationTheme | undefined {
  return themes
    .filter(predicate)
    .sort(
      (left, right) =>
        right.signal - left.signal ||
        right.active - left.active ||
        right.total - left.total,
    )[0];
}

/**
 * 本地洞察先于 AI：完全由当前聚合数据计算，不联网、不猜测。
 * AI 只能解释这些可复核的信号，不能替代本地判断。
 */
export function buildLocalExplorationInsights(
  data: DiscoveryExplorerData,
  overview: DiscoveryOverview,
): LocalExplorationInsight[] {
  const themes = data.matrix.themes;
  if (themes.length === 0) return [];
  const insights: LocalExplorationInsight[] = [];
  const weeklyFeedback = overview.activity.reduce((sum, item) => sum + item.count, 0);

  const bridge = topTheme(themes, (theme) => theme.projectCount >= 2 && theme.active > 0);
  if (bridge) {
    insights.push({
      id: `bridge:${bridge.key}`,
      kind: 'bridge',
      title: `「${bridge.label}」正在跨项目连接`,
      why: `这个主题出现在 ${bridge.projectCount} 个项目里，且有 ${bridge.active} 条活动发现；它更像一条可复用的兴趣主线，而不是单篇笔记的偶然标签。`,
      nextStep: `查看「${bridge.label}」下的发现，挑一条最具体的，问自己：它能否变成下一次输出？`,
      themes: [bridge.key],
      evidence: [
        ...themeEvidence(bridge),
        ...(weeklyFeedback > 0 ? [`近 7 天共 ${weeklyFeedback} 次反馈`] : []),
      ],
      confidence: clamp01(0.52 + bridge.projectCount * 0.08 + bridge.active * 0.03),
    });
  }

  const acceptedTheme = topTheme(
    themes,
    (theme) => theme.accepted > 0 && theme.acceptanceRate >= 0.6,
  );
  if (acceptedTheme) {
    insights.push({
      id: `momentum:${acceptedTheme.key}`,
      kind: 'momentum',
      title: `「${acceptedTheme.label}」值得继续加注`,
      why: `它的接受率为 ${percent(acceptedTheme.acceptanceRate)}，说明你的反馈已经把它从“看起来相关”推向“确实有用”。`,
      nextStep: `围绕「${acceptedTheme.label}」再收集 2-3 条发现，验证它是否稳定。`,
      themes: [acceptedTheme.key],
      evidence: themeEvidence(acceptedTheme),
      confidence: clamp01(0.50 + acceptedTheme.acceptanceRate * 0.35),
    });
  }

  const lowQuality = topTheme(
    themes,
    (theme) =>
      theme.active > 0 &&
      (theme.lowValue >= 2 || (theme.total >= 3 && theme.lowValue / theme.total >= 0.34)),
  );
  if (lowQuality) {
    insights.push({
      id: `quality:${lowQuality.key}`,
      kind: 'quality',
      title: `「${lowQuality.label}」需要更窄的边界`,
      why: `这个主题的低价值反馈偏多（${lowQuality.lowValue}/${lowQuality.total}）。不是它不重要，而是当前发现太宽，难以指导下一步。`,
      nextStep: `把「${lowQuality.label}」收窄成一个更具体的问题，或者先补一条能说明“为什么相关”的证据。`,
      themes: [lowQuality.key],
      evidence: themeEvidence(lowQuality),
      confidence: clamp01(0.50 + (lowQuality.lowValue / Math.max(1, lowQuality.total)) * 0.4),
    });
  }

  const singleProject = topTheme(
    themes,
    (theme) => theme.projectCount === 1 && theme.active >= 2,
  );
  if (singleProject && insights.length < 4) {
    insights.push({
      id: `coverage:${singleProject.key}`,
      kind: 'coverage',
      title: `「${singleProject.label}」还只在单项目里发光`,
      why: `它有 ${singleProject.active} 条活动发现，但目前只连接到一个项目。它可能是下一个值得跨项目验证的主题。`,
      nextStep: `找一篇另一个项目的笔记，试着用「${singleProject.label}」解释它，看看能不能形成新的连接。`,
      themes: [singleProject.key],
      evidence: themeEvidence(singleProject),
      confidence: clamp01(0.45 + singleProject.active * 0.06),
    });
  }

  if (insights.length === 0) {
    const first = themes[0];
    if (first) {
      insights.push({
        id: `coverage:${first.key}`,
        kind: 'coverage',
        title: `从「${first.label}」开始建立第一条主线`,
        why: '当前反馈和跨项目信号还少，先从一个主题开始，比同时追很多标签更容易形成稳定结构。',
        nextStep: `查看「${first.label}」的相关发现，接受一条、拒绝一条，让系统开始学习你的边界。`,
        themes: [first.key],
        evidence: themeEvidence(first),
        confidence: 0.42,
      });
    }
  }

  // 同一主题只保留最强的一条判断，避免“跨项目连接”和“值得加注”
  // 同时指向同一主题，把其他主题挤出视野。
  const seen = new Set<string>();
  return insights
    .filter((insight) => {
      const key = insight.themes[0];
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 4);
}

/** 7 天活动的总量；用于头部 mini metric。 */
export function activityTotal(overview: DiscoveryOverview): number {
  return overview.activity.reduce((sum, item) => sum + item.count, 0);
}
