import type { Discovery, DiscoveryFile } from './types';

export interface ExplorationTheme {
  key: string;
  total: number;
  active: number;
  accepted: number;
  corrected: number;
  lowValue: number;
  projects: string[];
}

export interface ExplorationMatrix {
  projects: string[];
  themes: ExplorationTheme[];
  cells: Record<string, Record<string, number>>;
}

export interface DiscoveryExplorerData {
  matrix: ExplorationMatrix;
  generatedAt: string;
}

function themeKey(discovery: Discovery): string {
  return discovery.subjectKeys.length > 0
    ? discovery.subjectKeys.join(' · ')
    : '未分类主题';
}

function projectKeys(discovery: Discovery): string[] {
  return discovery.projectKeys.length > 0
    ? [...new Set(discovery.projectKeys)]
    : ['未归类项目'];
}

/**
 * 只读探索矩阵：主题 × 项目。
 * 使用现有发现元数据，不读取正文，不写图谱。
 */
export function buildExploration(
  file: DiscoveryFile,
  now = new Date().toISOString(),
): DiscoveryExplorerData {
  const themes = new Map<string, ExplorationTheme>();
  const projects = new Set<string>();
  const cells: Record<string, Record<string, number>> = {};

  for (const discovery of file.discoveries) {
    const theme = themeKey(discovery);
    const projectsForDiscovery = projectKeys(discovery);
    for (const project of projectsForDiscovery) projects.add(project);

    const entry =
      themes.get(theme) ??
      {
        key: theme,
        total: 0,
        active: 0,
        accepted: 0,
        corrected: 0,
        lowValue: 0,
        projects: [],
      };
    entry.total += 1;
    if (discovery.status === 'active') entry.active += 1;
    if (discovery.feedbackStatus === 'accepted') entry.accepted += 1;
    if (discovery.feedbackStatus === 'corrected') entry.corrected += 1;
    if (discovery.feedbackStatus === 'low-value') entry.lowValue += 1;
    themes.set(theme, entry);

    for (const project of projectsForDiscovery) {
      if (!entry.projects.includes(project)) entry.projects.push(project);
      cells[theme] ??= {};
      cells[theme][project] = (cells[theme][project] ?? 0) + 1;
    }
  }

  return {
    generatedAt: now,
    matrix: {
      projects: [...projects].sort((left, right) => left.localeCompare(right)),
      themes: [...themes.values()].sort(
        (left, right) =>
          right.active - left.active ||
          right.total - left.total ||
          left.key.localeCompare(right.key),
      ),
      cells,
    },
  };
}
