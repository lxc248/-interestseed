import type { Discovery, DiscoveryFile } from './types';
import { compareText } from '../utils/text';

export interface ExplorationTheme {
  key: string;
  label: string;
  total: number;
  active: number;
  accepted: number;
  rejected: number;
  corrected: number;
  lowValue: number;
  projects: string[];
  projectCount: number;
  /** 0-1：接受 / (接受 + 拒绝 + 低价值 + 修正)，无反馈时为 0。 */
  acceptanceRate: number;
  /** 0-1：跨项目扩散与活动量的综合信号。 */
  signal: number;
}

export interface ExplorationMatrix {
  projects: string[];
  themes: ExplorationTheme[];
  cells: Record<string, Record<string, number>>;
}

export interface ExplorationTotals {
  discoveries: number;
  active: number;
  projects: number;
  themes: number;
  crossProjectThemes: number;
  accepted: number;
  lowValue: number;
}

export interface DiscoveryExplorerData {
  matrix: ExplorationMatrix;
  totals: ExplorationTotals;
  generatedAt: string;
}

export const UNCATEGORIZED_THEME = '未分类主题';
export const UNCATEGORIZED_PROJECT = '未归类项目';

const THEME_ALIASES: Record<string, string> = {
  ai: '人工智能',
  'artificial-intelligence': '人工智能',
  'machine-learning': '机器学习',
  ml: '机器学习',
  'deep-learning': '深度学习',
  llm: '大语言模型',
  'large-language-model': '大语言模型',
  'product-design': '产品设计',
  'ux-design': '用户体验',
  ux: '用户体验',
  'personal-knowledge-management': '个人知识管理',
  pkm: '个人知识管理',
  'knowledge-management': '知识管理',
  'note-taking': '笔记方法',
  'deep-work': '深度工作',
  focus: '专注',
  productivity: '生产力',
  'web-development': 'Web 开发',
  frontend: '前端',
  backend: '后端',
  writing: '写作',
  reading: '阅读',
  research: '研究',
};

/**
 * 把标签统一成稳定的主题 key。
 *
 * 这里不做“同义词猜测”，只做确定性的格式归一化 + 少量明确的通用别名。
 * 识别逻辑必须可解释、可测试，不能靠关键词玄学。
 */
export function normalizeThemeKey(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/^#+/, '')
    .replace(/[。！？!?，,；;：:]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  const ascii = cleaned.toLowerCase();
  return Object.prototype.hasOwnProperty.call(THEME_ALIASES, ascii)
    ? THEME_ALIASES[ascii]!
    : cleaned;
}

export function themeLabel(key: string): string {
  return key === UNCATEGORIZED_THEME ? UNCATEGORIZED_THEME : key;
}

/**
 * 一条发现可以属于多个主题；按单个主题识别，而不是把多个标签拼成
 * “a · b”这种只在当前数据上偶然成立的主题。
 */
export function getDiscoveryThemeKeys(discovery: Discovery): string[] {
  const keys = discovery.subjectKeys
    .map(normalizeThemeKey)
    .filter((key): key is string => Boolean(key));
  return [...new Set(keys)].sort(compareText);
}

export function getDiscoveryThemeKey(discovery: Discovery): string {
  return getDiscoveryThemeKeys(discovery)[0] ?? UNCATEGORIZED_THEME;
}

function projectKeys(discovery: Discovery): string[] {
  const keys = discovery.projectKeys
    .map((project) => project.trim())
    .filter(Boolean);
  return keys.length > 0 ? [...new Set(keys)].sort(compareText) : [UNCATEGORIZED_PROJECT];
}

function acceptanceRate(theme: ExplorationTheme): number {
  const decided =
    theme.accepted + theme.rejected + theme.lowValue + theme.corrected;
  return decided === 0 ? 0 : theme.accepted / decided;
}

function signalFor(theme: ExplorationTheme): number {
  const projectSpread = Math.min(1, theme.projectCount / 3);
  const activity = Math.min(1, theme.active / 6);
  const quality = acceptanceRate(theme);
  const penalty = theme.total === 0 ? 0 : theme.lowValue / theme.total;
  return Math.max(
    0,
    Math.min(1, 0.40 * projectSpread + 0.35 * activity + 0.25 * quality - 0.15 * penalty),
  );
}

/**
 * 只读探索矩阵：主题 × 项目。
 *
 * 识别规则：
 * - 每个 subjectKey 是独立主题（多标签发现会进入多个主题）；
 * - 空主题进入“未分类主题”，空项目进入“未归类项目”；
 * - 主题按活动量、跨项目扩散、总发现数排序。
 */
export function buildExploration(
  file: DiscoveryFile,
  now = new Date().toISOString(),
): DiscoveryExplorerData {
  const themes = new Map<string, ExplorationTheme>();
  const projects = new Set<string>();
  const cells: Record<string, Record<string, number>> = Object.create(null);
  let activeDiscoveries = 0;
  let accepted = 0;
  let lowValue = 0;

  for (const discovery of file.discoveries) {
    const themeKeys = getDiscoveryThemeKeys(discovery);
    const keys = themeKeys.length > 0 ? themeKeys : [UNCATEGORIZED_THEME];
    const projectsForDiscovery = projectKeys(discovery);
    for (const project of projectsForDiscovery) projects.add(project);
    if (discovery.status === 'active') activeDiscoveries += 1;
    if (discovery.feedbackStatus === 'accepted') accepted += 1;
    if (discovery.feedbackStatus === 'low-value') lowValue += 1;

    for (const key of keys) {
      const entry =
        themes.get(key) ??
        {
          key,
          label: themeLabel(key),
          total: 0,
          active: 0,
          accepted: 0,
          rejected: 0,
          corrected: 0,
          lowValue: 0,
          projects: [],
          projectCount: 0,
          acceptanceRate: 0,
          signal: 0,
        };
      entry.total += 1;
      if (discovery.status === 'active') entry.active += 1;
      if (discovery.feedbackStatus === 'accepted') entry.accepted += 1;
      if (discovery.feedbackStatus === 'rejected') entry.rejected += 1;
      if (discovery.feedbackStatus === 'corrected') entry.corrected += 1;
      if (discovery.feedbackStatus === 'low-value') entry.lowValue += 1;
      themes.set(key, entry);

      for (const project of projectsForDiscovery) {
        if (!entry.projects.includes(project)) entry.projects.push(project);
        cells[key] ??= Object.create(null) as Record<string, number>;
        cells[key]![project] = (cells[key]![project] ?? 0) + 1;
      }
    }
  }

  for (const entry of themes.values()) {
    entry.projects.sort(compareText);
    // “未归类项目”只用于矩阵兜底，不应把单项目主题伪装成跨项目主题。
    entry.projectCount = entry.projects.filter(
      (project) => project !== UNCATEGORIZED_PROJECT,
    ).length;
    entry.acceptanceRate = acceptanceRate(entry);
    entry.signal = signalFor(entry);
  }

  const orderedThemes = [...themes.values()].sort(
    (left, right) =>
      right.signal - left.signal ||
      right.active - left.active ||
      right.projectCount - left.projectCount ||
      right.total - left.total ||
      compareText(left.key, right.key),
  );
  const orderedProjects = [...projects].sort(compareText);

  return {
    generatedAt: now,
    totals: {
      discoveries: file.discoveries.length,
      active: activeDiscoveries,
      projects: orderedProjects.length,
      themes: orderedThemes.length,
      crossProjectThemes: orderedThemes.filter((theme) => theme.projectCount >= 2).length,
      accepted,
      lowValue,
    },
    matrix: {
      projects: orderedProjects,
      themes: orderedThemes,
      cells,
    },
  };
}
