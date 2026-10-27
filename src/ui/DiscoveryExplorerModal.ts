import { Modal } from 'obsidian';
import type { App } from 'obsidian';

import type { DiscoveryExplorerData } from '../discovery/exploration';
import type { DiscoveryOverview } from '../discovery/overview';
import type {
  ExplorationInsight,
  ExplorationRequest,
} from '../services/ModelProvider';

export interface DiscoveryExplorerModalDeps {
  onThemeSelect(theme: string): void;
  onGenerateAi?(request: ExplorationRequest): Promise<ExplorationInsight>;
}

const FEEDBACK_LABELS: Record<string, string> = {
  accepted: '已接受',
  corrected: '已修正',
  'low-value': '低价值',
  rejected: '已拒绝',
};

/** 只读兴趣探索：主题 × 项目矩阵与活动趋势。 */
export class DiscoveryExplorerModal extends Modal {
  constructor(
    app: App,
    private readonly data: DiscoveryExplorerData,
    private readonly overview: DiscoveryOverview,
    private readonly deps: DiscoveryExplorerModalDeps,
  ) {
    super(app);
  }

  override onOpen(): void {
    this.titleEl.setText('兴趣探索');
    this.contentEl.empty();
    this.contentEl.addClass('interestseed-overview');
    this.contentEl.addClass('interestseed-explorer');

    this.contentEl.createEl('p', {
      cls: 'interestseed-overview-note',
      text: '只读探索：从主题、项目和反馈节奏理解你的兴趣结构；点击主题可回到发现面板筛选。',
    });

    const stats = this.contentEl.createDiv({ cls: 'interestseed-overview-stats' });
    this.stat(stats, '发现', this.overview.total);
    this.stat(stats, '活动', this.overview.active);
    this.stat(stats, '主题', this.data.matrix.themes.length);
    this.stat(stats, '项目', this.data.matrix.projects.length);

    this.renderThemes();
    this.renderMatrix();
    this.renderActivity();
    this.renderAi();
  }

  override onClose(): void {
    this.contentEl.empty();
  }

  private renderThemes(): void {
    const section = this.contentEl.createDiv({ cls: 'interestseed-overview-section' });
    section.createEl('h3', { text: '主题入口' });
    if (this.data.matrix.themes.length === 0) {
      section.createDiv({ text: '还没有可探索的主题。' });
      return;
    }
    const list = section.createDiv({ cls: 'interestseed-explorer-themes' });
    for (const theme of this.data.matrix.themes.slice(0, 12)) {
      const button = list.createEl('button', {
        cls: 'interestseed-explorer-theme',
        attr: {
          'aria-label': `查看主题 ${theme.key} 的相关发现`,
          title: `查看主题 ${theme.key} 的相关发现`,
        },
      });
      button.createSpan({ cls: 'interestseed-explorer-theme-key', text: `#${theme.key}` });
      button.createSpan({
        cls: 'interestseed-explorer-theme-meta',
        text: `${theme.active} 活动 · ${theme.total} 总计`,
      });
      button.addEventListener('click', () => {
        this.close();
        this.deps.onThemeSelect(theme.key);
      });
    }
  }

  private renderMatrix(): void {
    const section = this.contentEl.createDiv({ cls: 'interestseed-overview-section' });
    section.createEl('h3', { text: '主题 × 项目' });
    if (this.data.matrix.projects.length === 0) {
      section.createDiv({ text: '还没有项目分组数据。' });
      return;
    }

    const wrap = section.createDiv({ cls: 'interestseed-explorer-matrix-wrap' });
    const table = wrap.createEl('table', { cls: 'interestseed-explorer-matrix' });
    const head = table.createEl('thead');
    const headRow = head.createEl('tr');
    headRow.createEl('th', { text: '主题' });
    for (const project of this.data.matrix.projects) {
      headRow.createEl('th', { text: project });
    }

    const body = table.createEl('tbody');
    for (const theme of this.data.matrix.themes.slice(0, 10)) {
      const row = body.createEl('tr');
      const label = row.createEl('th');
      const button = label.createEl('button', {
        cls: 'interestseed-explorer-theme-link',
        text: `#${theme.key}`,
        attr: { 'aria-label': `查看主题 ${theme.key} 的相关发现` },
      });
      button.addEventListener('click', () => {
        this.close();
        this.deps.onThemeSelect(theme.key);
      });
      for (const project of this.data.matrix.projects) {
        const count = this.data.matrix.cells[theme.key]?.[project] ?? 0;
        row.createEl('td', {
          text: count > 0 ? String(count) : '·',
          cls: count > 0 ? 'is-hit' : 'is-empty',
        });
      }
    }
  }

  private renderActivity(): void {
    const section = this.contentEl.createDiv({ cls: 'interestseed-overview-section' });
    section.createEl('h3', { text: '近 7 天反馈活动' });
    const max = Math.max(1, ...this.overview.activity.map((item) => item.count));
    for (const item of this.overview.activity) {
      const row = section.createDiv({ cls: 'interestseed-activity-row' });
      row.createSpan({ cls: 'interestseed-activity-label', text: item.label });
      const track = row.createDiv({ cls: 'interestseed-activity-track' });
      const bar = track.createDiv({ cls: 'interestseed-activity-bar' });
      bar.style.width = `${Math.max(3, (item.count / max) * 100)}%`;
      row.createSpan({ cls: 'interestseed-activity-value', text: String(item.count) });
    }

    const legend = section.createDiv({ cls: 'interestseed-explorer-legend' });
    for (const [key, value] of Object.entries(FEEDBACK_LABELS)) {
      const count = this.overview.feedback[key as keyof typeof this.overview.feedback] ?? 0;
      if (count > 0) legend.createSpan({ text: `${value} ${count}` });
    }
  }

  private renderAi(): void {
    const section = this.contentEl.createDiv({ cls: 'interestseed-overview-section interestseed-ai-section' });
    section.createEl('h3', { text: 'AI 探索解读' });
    section.createEl('p', {
      cls: 'interestseed-ai-note',
      text: '只发送主题、项目名称和聚合计数；不发送笔记正文、路径或原始证据。需在设置中启用 AI 并授权。',
    });

    const button = section.createEl('button', {
      cls: 'interestseed-modal-button is-primary',
      text: '生成 AI 探索解读',
      attr: { type: 'button' },
    });
    const status = section.createDiv({ cls: 'interestseed-apply-status' });
    const result = section.createDiv({ cls: 'interestseed-ai-result' });

    button.addEventListener('click', () => {
      if (!this.deps.onGenerateAi) {
        status.setText('当前未配置 AI 服务。');
        status.addClass('is-error');
        return;
      }
      button.disabled = true;
      status.removeClass('is-error');
      status.setText('正在生成……');
      result.empty();
      const request: ExplorationRequest = {
        themes: this.data.matrix.themes.slice(0, 12).map((theme) => ({
          key: theme.key,
          active: theme.active,
          total: theme.total,
        })),
        projects: this.data.matrix.projects.slice(0, 20),
        activity: this.overview.activity,
      };
      void this.deps
        .onGenerateAi(request)
        .then((insight) => {
          status.setText('AI 解读已生成。');
          result.createEl('p', { cls: 'interestseed-ai-summary', text: insight.summary });
          for (const item of insight.opportunities) {
            const card = result.createDiv({ cls: 'interestseed-ai-opportunity' });
            card.createDiv({ cls: 'interestseed-ai-opportunity-title', text: item.title });
            card.createDiv({ cls: 'interestseed-ai-opportunity-why', text: item.why });
            card.createDiv({ cls: 'interestseed-ai-opportunity-next', text: `下一步：${item.nextStep}` });
            if (item.themes.length > 0) {
              card.createDiv({ cls: 'interestseed-ai-opportunity-themes', text: item.themes.join(' · ') });
            }
          }
        })
        .catch((error: unknown) => {
          status.setText(`AI 解读失败：${error instanceof Error ? error.message : String(error)}`);
          status.addClass('is-error');
        })
        .finally(() => {
          button.disabled = false;
        });
    });
  }

  private stat(parent: HTMLElement, label: string, value: number): void {
    const box = parent.createDiv({ cls: 'interestseed-overview-stat' });
    box.createSpan({ cls: 'interestseed-overview-stat-value', text: String(value) });
    box.createSpan({ cls: 'interestseed-overview-stat-label', text: label });
  }
}
