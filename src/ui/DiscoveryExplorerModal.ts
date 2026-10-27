import { Modal } from 'obsidian';
import type { App } from 'obsidian';

import type { DiscoveryExplorerData, ExplorationTheme } from '../discovery/exploration';
import { UNCATEGORIZED_THEME } from '../discovery/exploration';
import type { DiscoveryOverview } from '../discovery/overview';
import {
  activityTotal,
  buildLocalExplorationInsights,
  type LocalExplorationInsight,
  type LocalInsightKind,
} from '../discovery/insights';
import type {
  ExplorationInsight,
  ExplorationRequest,
} from '../services/ModelProvider';

export interface DiscoveryExplorerModalDeps {
  onThemeSelect(theme: string): void;
  aiAvailable?: boolean;
  onGenerateAi?(request: ExplorationRequest): Promise<ExplorationInsight>;
}

const FEEDBACK_LABELS: Record<string, string> = {
  accepted: '已接受',
  corrected: '已修正',
  'low-value': '低价值',
  rejected: '已拒绝',
  'needs-verification': '待验证',
};

const INSIGHT_LABELS: Record<LocalInsightKind, string> = {
  bridge: '跨项目连接',
  momentum: '势能',
  quality: '质量边界',
  coverage: '覆盖缺口',
};

function percent(value: number): string {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

function themeHash(theme: ExplorationTheme): string {
  return themeKeyText(theme.key);
}

function themeKeyText(key: string): string {
  if (key === UNCATEGORIZED_THEME) return UNCATEGORIZED_THEME;
  return /^[\u0020-\u007E]+$/.test(key) ? `#${key}` : key;
}

/** 只读兴趣探索：本地洞察优先，矩阵/趋势可交互，AI 只做可解释解释。 */
export class DiscoveryExplorerModal extends Modal {
  private closed = false;

  constructor(
    app: App,
    private readonly data: DiscoveryExplorerData,
    private readonly overview: DiscoveryOverview,
    private readonly deps: DiscoveryExplorerModalDeps,
  ) {
    super(app);
  }

  override onOpen(): void {
    this.closed = false;
    this.modalEl.addClass('interestseed-insight-modal');
    this.modalEl.setAttribute('aria-label', '兴趣探索工作台');
    this.titleEl.setText('兴趣探索');
    this.contentEl.empty();
    this.contentEl.addClass('interestseed-overview');
    this.contentEl.addClass('interestseed-explorer');
    this.contentEl.addClass('interestseed-insight-shell');

    this.renderHero();
    this.renderTabs();
    this.renderOverview();
    this.renderThemes();
    this.renderMatrix();
    this.renderActivity();
    this.renderAi();
  }

  override onClose(): void {
    this.closed = true;
    this.contentEl.empty();
  }

  private renderHero(): void {
    const hero = this.contentEl.createDiv({ cls: 'interestseed-insight-hero' });
    const top = hero.createDiv({ cls: 'interestseed-insight-hero-top' });
    const eyebrow = top.createDiv({ cls: 'interestseed-insight-eyebrow' });
    eyebrow.createSpan({ cls: 'interestseed-insight-live-dot' });
    eyebrow.createSpan({ text: 'INTEREST SEED / EXPLORATION' });
    top.createSpan({ cls: 'interestseed-insight-readonly', text: '只读 · 本地计算 · AI 可选' });

    hero.createEl('h1', {
      cls: 'interestseed-insight-title',
      text: '你的兴趣，正在形成一张地图',
    });
    hero.createEl('p', {
      cls: 'interestseed-insight-subtitle',
      text: `从 ${this.data.totals.discoveries} 条发现中识别 ${this.data.totals.themes} 个主题，连接 ${this.data.totals.projects} 个项目。先看本地信号，再决定是否让 AI 解释。`,
    });

    const stats = hero.createDiv({ cls: 'interestseed-insight-stats' });
    this.stat(stats, '发现', this.data.totals.discoveries, '全部记录');
    this.stat(stats, '活动', this.data.totals.active, '尚未抑制');
    this.stat(stats, '跨项目主题', this.data.totals.crossProjectThemes, '连接 2+ 项目');
    this.stat(stats, '7 天反馈', activityTotal(this.overview), '最近节奏');
    this.renderOrbit(hero);
  }

  /** 真实数据驱动的主题-项目关系图，而不是装饰性插画。 */
  private renderOrbit(hero: HTMLElement): void {
    const themes = this.data.matrix.themes.slice(0, 6);
    const projects = this.data.matrix.projects.slice(0, 5);
    if (themes.length === 0) return;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 260 170');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('interestseed-insight-orbit');

    const projectPoint = (index: number): { x: number; y: number } => ({
      x: 34 + (index * 192) / Math.max(1, projects.length - 1),
      y: 148,
    });
    const themePoint = (index: number): { x: number; y: number } => {
      const angle = -Math.PI * 0.86 + (index * Math.PI * 1.34) / Math.max(1, themes.length - 1);
      return { x: 130 + Math.cos(angle) * 88, y: 76 + Math.sin(angle) * 48 };
    };

    for (const [themeIndex, theme] of themes.entries()) {
      const from = themePoint(themeIndex);
      for (const [projectIndex, project] of projects.entries()) {
        if ((this.data.matrix.cells[theme.key]?.[project] ?? 0) === 0) continue;
        const to = projectPoint(projectIndex);
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', String(from.x));
        line.setAttribute('y1', String(from.y));
        line.setAttribute('x2', String(to.x));
        line.setAttribute('y2', String(to.y));
        line.setAttribute('stroke', 'var(--interactive-accent)');
        line.setAttribute('stroke-opacity', '0.16');
        svg.appendChild(line);
      }
    }

    for (const [index, project] of projects.entries()) {
      const point = projectPoint(index);
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('cx', String(point.x));
      dot.setAttribute('cy', String(point.y));
      dot.setAttribute('r', '3');
      dot.setAttribute('fill', 'var(--text-faint)');
      svg.appendChild(dot);
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', String(point.x));
      label.setAttribute('y', '164');
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('class', 'interestseed-insight-orbit-label');
      label.textContent = project.slice(0, 9);
      svg.appendChild(label);
    }

    for (const [index, theme] of themes.entries()) {
      const point = themePoint(index);
      const halo = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      halo.setAttribute('cx', String(point.x));
      halo.setAttribute('cy', String(point.y));
      halo.setAttribute('r', String(8 + theme.signal * 10));
      halo.setAttribute('fill', 'var(--interactive-accent)');
      halo.setAttribute('fill-opacity', '0.10');
      svg.appendChild(halo);
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('cx', String(point.x));
      dot.setAttribute('cy', String(point.y));
      dot.setAttribute('r', String(3 + theme.signal * 3));
      dot.setAttribute('fill', 'var(--interactive-accent)');
      dot.setAttribute('fill-opacity', '0.85');
      svg.appendChild(dot);
    }
    hero.appendChild(svg);
  }

  private renderTabs(): void {
    const tabs = this.contentEl.createDiv({ cls: 'interestseed-insight-tabs' });
    tabs.setAttribute('role', 'tablist');
    const items: Array<[string, string]> = [
      ['interestseed-insight-overview', '洞察'],
      ['interestseed-insight-themes', '主题'],
      ['interestseed-insight-matrix', '矩阵'],
      ['interestseed-insight-trend', '节奏'],
      ['interestseed-insight-ai', 'AI 解读'],
    ];
    for (const [id, label] of items) {
      const button = tabs.createEl('button', {
        cls: `interestseed-insight-tab${id === items[0]?.[0] ? ' is-active' : ''}`,
        text: label,
        attr: { type: 'button', role: 'tab', 'aria-selected': id === items[0]?.[0] ? 'true' : 'false' },
      });
      button.addEventListener('click', () => {
        for (const sibling of tabs.querySelectorAll('.interestseed-insight-tab')) {
          const active = sibling === button;
          sibling.classList.toggle('is-active', active);
          sibling.setAttribute('aria-selected', active ? 'true' : 'false');
        }
        this.contentEl.querySelector(`#${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }

  private renderOverview(): void {
    const section = this.section('interestseed-insight-overview', '01 / SIGNALS', '先看结论', '这些结论完全来自本地聚合，不依赖 AI。');
    const local = buildLocalExplorationInsights(this.data, this.overview);
    const grid = section.createDiv({ cls: 'interestseed-insight-list' });
    if (local.length === 0) {
      grid.createDiv({ cls: 'interestseed-insight-empty', text: '数据还不足以形成洞察。先接受或拒绝几条发现，让系统开始学习你的边界。' });
      return;
    }
    for (const [index, insight] of local.entries()) this.insightCard(grid, insight, index);
  }

  private renderThemes(): void {
    const section = this.section('interestseed-insight-themes', '02 / THEMES', '主题入口', '按活动量和跨项目扩散排序；点击进入发现列表。');
    if (this.data.matrix.themes.length === 0) {
      section.createDiv({ cls: 'interestseed-insight-empty', text: '还没有可探索的主题。' });
      return;
    }
    const list = section.createDiv({ cls: 'interestseed-insight-theme-grid' });
    const visibleThemes = this.data.matrix.themes.slice(0, 12);
    for (const theme of visibleThemes) {
      const button = list.createEl('button', {
        cls: `interestseed-insight-theme-card${theme.active === 0 ? ' is-dormant' : ''}`,
        attr: {
          type: 'button',
          'aria-label': `查看主题 ${theme.label} 的相关发现`,
          title: `查看 ${theme.label} 的发现`,
        },
      });
      button.disabled = theme.active === 0;
      const head = button.createDiv({ cls: 'interestseed-insight-theme-head' });
      head.createSpan({ cls: 'interestseed-insight-theme-name', text: themeHash(theme) });
      head.createSpan({ cls: 'interestseed-insight-theme-score', text: `信号 ${percent(theme.signal)}` });
      const meta = button.createDiv({ cls: 'interestseed-insight-theme-meta' });
      meta.createSpan({ text: `${theme.active} 活动` });
      meta.createSpan({ text: `${theme.projectCount} 项目` });
      if (theme.projectCount >= 2) meta.createSpan({ cls: 'is-bridge', text: '跨项目' });
      if (theme.accepted > 0) meta.createSpan({ cls: 'is-positive', text: `${theme.accepted} 接受` });
      if (theme.lowValue > 0) meta.createSpan({ cls: 'is-warning', text: `${theme.lowValue} 低价值` });
      if (theme.active === 0) meta.createSpan({ cls: 'is-dormant-label', text: '仅历史' });
      const bar = button.createDiv({ cls: 'interestseed-insight-theme-bar' });
      const fill = bar.createDiv({ cls: 'interestseed-insight-theme-bar-fill' });
      fill.style.width = `${Math.max(0, Math.round(theme.signal * 100))}%`;
      button.addEventListener('click', () => this.openTheme(theme.key));
    }
    if (this.data.matrix.themes.length > visibleThemes.length) {
      section.createDiv({
        cls: 'interestseed-insight-truncated',
        text: `仅显示信号最高的 ${visibleThemes.length} 个主题，共 ${this.data.matrix.themes.length} 个。`,
      });
    }
  }

  private renderMatrix(): void {
    const section = this.section('interestseed-insight-matrix', '03 / MATRIX', '主题 × 项目', '颜色越亮，代表这个主题在该项目中的发现越多；点击单元格可筛选主题。');
    if (this.data.matrix.projects.length === 0 || this.data.matrix.themes.length === 0) {
      section.createDiv({ cls: 'interestseed-insight-empty', text: '还没有足够的项目分组数据。' });
      return;
    }

    const visibleThemes = this.data.matrix.themes.slice(0, 12);
    const maxCell = Math.max(
      1,
      ...visibleThemes.flatMap((theme) =>
        Object.values(this.data.matrix.cells[theme.key] ?? {}).filter((value) =>
          Number.isFinite(value),
        ),
      ),
    );
    const wrap = section.createDiv({ cls: 'interestseed-explorer-matrix-wrap' });
    const table = wrap.createEl('table', { cls: 'interestseed-explorer-matrix interestseed-insight-matrix' });
    const legend = section.createDiv({ cls: 'interestseed-insight-matrix-legend' });
    legend.createSpan({ text: '少' });
    for (const heat of [0.18, 0.46, 0.78]) {
      const swatch = legend.createSpan({ cls: 'interestseed-insight-heat-swatch' });
      swatch.style.setProperty('--is-heat', String(heat));
    }
    legend.createSpan({ text: '多' });
    const head = table.createEl('thead');
    const headRow = head.createEl('tr');
    headRow.createEl('th', { text: '主题', attr: { scope: 'col' } });
    for (const project of this.data.matrix.projects) {
      headRow.createEl('th', { text: project, attr: { scope: 'col' } });
    }

    const body = table.createEl('tbody');
    for (const theme of visibleThemes) {
      const row = body.createEl('tr', { cls: theme.active === 0 ? 'is-dormant' : '' });
      const label = row.createEl('th', { attr: { scope: 'row' } });
      const button = label.createEl('button', {
        cls: 'interestseed-explorer-theme-link',
        text: themeHash(theme),
        attr: { type: 'button', 'aria-label': `查看主题 ${theme.label} 的相关发现` },
      });
      button.addEventListener('click', () => this.openTheme(theme.key));
      for (const project of this.data.matrix.projects) {
        const count = this.data.matrix.cells[theme.key]?.[project] ?? 0;
        const cell = row.createEl('td', {
          cls: count > 0 ? 'is-hit' : 'is-empty',
          attr: {
            'aria-label': `${theme.label} 在 ${project}：${count} 条`,
            title: `${theme.label} × ${project}：${count} 条发现`,
          },
        });
        if (count > 0) {
          const heat = 0.16 + (count / maxCell) * 0.68;
          cell.style.setProperty('--is-heat', String(heat));
          const button = cell.createEl('button', {
            cls: 'interestseed-insight-cell',
            text: String(count),
            attr: {
              type: 'button',
              'aria-label': `查看主题 ${theme.label}（${project}）`,
            },
          });
          button.disabled = theme.active === 0;
          button.addEventListener('click', () => this.openTheme(theme.key));
        } else {
          cell.createSpan({ cls: 'interestseed-insight-cell-empty', text: '0' });
        }
      }
    }
    if (this.data.matrix.themes.length > visibleThemes.length) {
      section.createDiv({
        cls: 'interestseed-insight-truncated',
        text: `矩阵显示前 ${visibleThemes.length} 个主题；共 ${this.data.matrix.themes.length} 个。`,
      });
    }
  }

  private renderActivity(): void {
    const section = this.section('interestseed-insight-trend', '04 / RHYTHM', '近 7 天反馈节奏', '看的是反馈事件，不是阅读时长；用它判断探索是否在持续推进。');
    const max = Math.max(1, ...this.overview.activity.map((item) => item.count));
    const chart = section.createDiv({ cls: 'interestseed-insight-chart' });
    chart.setAttribute('role', 'img');
    chart.setAttribute(
      'aria-label',
      `近 7 天反馈：${this.overview.activity.map((item) => `${item.label} ${item.count} 条`).join('，')}`,
    );
    for (const item of this.overview.activity) {
      const column = chart.createDiv({ cls: 'interestseed-insight-chart-column' });
      const value = column.createSpan({
        cls: 'interestseed-insight-chart-value',
        text: String(item.count),
      });
      value.setAttribute('aria-hidden', 'true');
      const track = column.createDiv({ cls: 'interestseed-insight-chart-track' });
      const bar = track.createDiv({ cls: 'interestseed-insight-chart-bar' });
      if (item.count === 0) bar.style.display = 'none';
      else bar.style.height = `${Math.max(3, Math.round((item.count / max) * 100))}%`;
      column.createSpan({ cls: 'interestseed-insight-chart-label', text: item.label });
    }

    const footer = section.createDiv({ cls: 'interestseed-insight-chart-footer' });
    const total = activityTotal(this.overview);
    footer.createSpan({ text: `本周共 ${total} 次反馈` });
    const legend = footer.createDiv({ cls: 'interestseed-insight-feedback-legend' });
    for (const [key, value] of Object.entries(FEEDBACK_LABELS)) {
      const count = this.overview.feedback[key as keyof typeof this.overview.feedback] ?? 0;
      if (count > 0) legend.createSpan({ text: `${value} ${count}` });
    }
  }

  private renderAi(): void {
    const section = this.section('interestseed-insight-ai', '05 / EXPLAIN', 'AI 解读', '本地信号先成立，AI 只负责把信号翻译成可执行的下一步。');
    const note = section.createDiv({ cls: 'interestseed-insight-ai-note' });
    note.createSpan({ cls: 'interestseed-insight-ai-gate', text: '默认关闭' });
    note.createSpan({
      text: '只发送匿名化主题/项目别名、聚合计数和活动数据；不发送笔记正文、路径或证据原文。启用需在设置中授权。',
    });

    const actions = section.createDiv({ cls: 'interestseed-insight-ai-actions' });
    const button = actions.createEl('button', {
      cls: 'interestseed-modal-button is-primary interestseed-insight-ai-button',
      text: this.deps.aiAvailable === false ? 'AI 未启用' : '生成可解释解读',
      attr: { type: 'button' },
    });
    button.disabled = this.deps.aiAvailable === false;
    const status = actions.createDiv({ cls: 'interestseed-apply-status' });
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    if (this.deps.aiAvailable === false) {
      status.setText('AI 未启用；上方本地洞察仍然可用。');
    }
    const result = section.createDiv({ cls: 'interestseed-ai-result interestseed-insight-ai-result' });

    button.addEventListener('click', () => {
      if (!this.deps.onGenerateAi) {
        status.setText('当前未配置 AI 服务；上方本地洞察仍然可用。');
        status.addClass('is-error');
        return;
      }
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      status.removeClass('is-error');
      status.setText('正在读取聚合信号……');
      result.empty();

      const themeAliases = new Map(
        this.data.matrix.themes.slice(0, 12).map((theme, index) => [
          `theme_${index + 1}`,
          theme.key,
        ]),
      );
      const projectAliases = new Map(
        this.data.matrix.projects.slice(0, 20).map((project, index) => [
          `project_${index + 1}`,
          project,
        ]),
      );
      const request: ExplorationRequest = {
        themes: this.data.matrix.themes.slice(0, 12).map((theme, index) => ({
          key: `theme_${index + 1}`,
          active: theme.active,
          total: theme.total,
          projectCount: theme.projectCount,
          acceptanceRate: theme.acceptanceRate,
          signal: theme.signal,
        })),
        projects: [...projectAliases.keys()],
        activity: this.overview.activity,
      };
      const restoreAliases = (text: string): string => {
        let value = text;
        for (const [alias, real] of [...themeAliases].sort(
          (left, right) => right[0].length - left[0].length,
        )) {
          value = value.split(alias).join(real);
        }
        for (const [alias, real] of [...projectAliases].sort(
          (left, right) => right[0].length - left[0].length,
        )) {
          value = value.split(alias).join(real);
        }
        return value;
      };

      void Promise.resolve()
        .then(() => this.deps.onGenerateAi!(request))
        .then((rawInsight) => {
          if (this.closed) return;
          const insight = {
            ...rawInsight,
            confidence: Number.isFinite(rawInsight.confidence) ? rawInsight.confidence : 0.5,
            summary: restoreAliases(rawInsight.summary),
            reasoning: (rawInsight.reasoning ?? []).map(restoreAliases),
            opportunities: rawInsight.opportunities.map((item) => ({
              ...item,
              title: restoreAliases(item.title),
              why: restoreAliases(item.why),
              nextStep: restoreAliases(item.nextStep),
              evidence: (item.evidence ?? []).map(restoreAliases),
              themes: item.themes.map((theme) => themeAliases.get(theme) ?? theme),
            })),
          };
          status.setText('解读已生成；它只解释上方本地信号，不直接修改数据。');
          this.renderAiInsight(result, insight);
        })
        .catch((error: unknown) => {
          if (this.closed) return;
          status.setText(`AI 解读失败：${error instanceof Error ? error.message : String(error)}。本地洞察不受影响。`);
          status.addClass('is-error');
        })
        .finally(() => {
          button.disabled = false;
          button.setAttribute('aria-busy', 'false');
        });
    });
  }

  private renderAiInsight(parent: HTMLElement, insight: ExplorationInsight): void {
    const summary = parent.createDiv({ cls: 'interestseed-insight-ai-summary-card' });
    const summaryHead = summary.createDiv({ cls: 'interestseed-insight-ai-summary-head' });
    summaryHead.createSpan({ cls: 'interestseed-insight-kicker', text: 'AI SUMMARY' });
    summaryHead.createSpan({ cls: 'interestseed-insight-confidence', text: `模型自评 ${percent(insight.confidence)}` });
    summary.createEl('p', { cls: 'interestseed-ai-summary', text: insight.summary });

    if (insight.reasoning.length > 0) {
      const reasoning = parent.createDiv({ cls: 'interestseed-insight-reasoning' });
      reasoning.createDiv({ cls: 'interestseed-insight-kicker', text: 'REASONING PATH' });
      const list = reasoning.createEl('ol');
      for (const step of insight.reasoning) list.createEl('li', { text: step });
    }

    for (const item of insight.opportunities) {
      const card = parent.createDiv({ cls: 'interestseed-ai-opportunity interestseed-insight-ai-opportunity' });
      const head = card.createDiv({ cls: 'interestseed-insight-ai-opportunity-head' });
      head.createSpan({ cls: 'interestseed-ai-opportunity-title', text: item.title });
      head.createSpan({ cls: 'interestseed-insight-confidence', text: percent(item.confidence) });
      card.createDiv({ cls: 'interestseed-ai-opportunity-why', text: item.why });
      const next = card.createDiv({ cls: 'interestseed-ai-opportunity-next' });
      next.createSpan({ cls: 'interestseed-insight-next-label', text: '下一步' });
      next.createSpan({ text: item.nextStep });
      if (item.evidence.length > 0) {
        const evidence = card.createDiv({ cls: 'interestseed-insight-evidence' });
        for (const value of item.evidence) evidence.createSpan({ text: value });
      } else {
        card.createDiv({ cls: 'interestseed-insight-no-evidence', text: '未提供可核验的数字证据，仅作提示。' });
      }
      if (item.themes.length > 0) {
        const themes = card.createDiv({ cls: 'interestseed-ai-opportunity-themes' });
        for (const theme of item.themes) {
          const chip = themes.createEl('button', {
            cls: 'interestseed-insight-theme-chip',
            text: themeKeyText(theme),
            attr: { type: 'button', 'aria-label': `查看主题 ${theme}` },
          });
          chip.addEventListener('click', () => this.openTheme(theme));
        }
      }
    }
  }

  private insightCard(parent: HTMLElement, insight: LocalExplorationInsight, index: number): void {
    const card = parent.createDiv({ cls: `interestseed-insight-card is-${insight.kind}` });
    card.style.setProperty('--is-card-index', String(index));
    card.createDiv({ cls: 'interestseed-insight-card-index', text: String(index + 1).padStart(2, '0') });
    const body = card.createDiv({ cls: 'interestseed-insight-card-body' });
    const top = body.createDiv({ cls: 'interestseed-insight-card-top' });
    top.createSpan({ cls: 'interestseed-insight-kicker', text: INSIGHT_LABELS[insight.kind] });
    top.createSpan({ cls: 'interestseed-insight-confidence', text: `依据强度 ${percent(insight.confidence)}` });
    body.createEl('h4', { text: insight.title });
    body.createEl('p', { text: insight.why });
    const evidence = body.createDiv({ cls: 'interestseed-insight-evidence' });
    for (const item of insight.evidence) evidence.createSpan({ text: item });
    const next = body.createDiv({ cls: 'interestseed-ai-opportunity-next interestseed-insight-local-next' });
    next.createSpan({ cls: 'interestseed-insight-next-label', text: '下一步' });
    next.createSpan({ text: insight.nextStep });
    const action = body.createEl('button', {
      cls: 'interestseed-insight-inline-link',
      text: '查看相关主题 →',
      attr: { type: 'button' },
    });
    action.addEventListener('click', () => this.openTheme(insight.themes[0] ?? UNCATEGORIZED_THEME));
  }

  private section(id: string, kicker: string, title: string, description: string): HTMLElement {
    const section = this.contentEl.createDiv({ cls: 'interestseed-overview-section interestseed-insight-section' });
    section.id = id;
    const head = section.createDiv({ cls: 'interestseed-insight-section-head' });
    head.createSpan({ cls: 'interestseed-insight-kicker', text: kicker });
    head.createEl('h3', { text: title });
    section.createEl('p', { cls: 'interestseed-insight-section-desc', text: description });
    return section;
  }

  private openTheme(theme: string): void {
    this.close();
    this.deps.onThemeSelect(theme);
  }

  private stat(parent: HTMLElement, label: string, value: number, hint: string): void {
    const box = parent.createDiv({ cls: 'interestseed-insight-stat' });
    box.createSpan({ cls: 'interestseed-overview-stat-value', text: String(value) });
    box.createSpan({ cls: 'interestseed-overview-stat-label', text: label });
    box.createSpan({ cls: 'interestseed-insight-stat-hint', text: hint });
  }
}
