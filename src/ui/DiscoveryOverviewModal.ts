import { Modal } from 'obsidian';
import type { App } from 'obsidian';

import type { DiscoveryOverview } from '../discovery/overview';

const FEEDBACK_LABELS: Record<string, string> = {
  none: '未反馈',
  accepted: '已接受',
  rejected: '已拒绝',
  corrected: '已修正',
  'low-value': '低价值',
  'needs-verification': '待验证',
};

/** 只读兴趣总览；不修改发现或图谱。 */
export class DiscoveryOverviewModal extends Modal {
  constructor(app: App, private readonly overview: DiscoveryOverview) {
    super(app);
  }

  override onOpen(): void {
    this.modalEl.addClass('interestseed-overview-modal');
    this.titleEl.setText('兴趣总览');
    this.contentEl.empty();
    this.contentEl.addClass('interestseed-overview');
    this.contentEl.createEl('p', {
      cls: 'interestseed-overview-note',
      text: '只读汇总：发现反馈、主题分布、已应用关系和最近变化；不会修改图谱。',
    });

    const stats = this.contentEl.createDiv({ cls: 'interestseed-overview-stats' });
    this.stat(stats, '发现', this.overview.total);
    this.stat(stats, '活动', this.overview.active);
    this.stat(stats, '已抑制', this.overview.dismissed);
    this.stat(stats, '自动收敛', this.overview.superseded);

    const activity = this.contentEl.createDiv({ cls: 'interestseed-overview-section' });
    activity.createEl('h3', { text: '近 7 天反馈活动' });
    const maxActivity = Math.max(1, ...this.overview.activity.map((item) => item.count));
    for (const item of this.overview.activity) {
      const row = activity.createDiv({ cls: 'interestseed-activity-row' });
      row.createSpan({ cls: 'interestseed-activity-label', text: item.label });
      const track = row.createDiv({ cls: 'interestseed-activity-track' });
      const bar = track.createDiv({ cls: 'interestseed-activity-bar' });
      bar.style.width = `${Math.max(3, (item.count / maxActivity) * 100)}%`;
      bar.setAttr('aria-label', `${item.date}：${item.count} 次反馈`);
      row.createSpan({ cls: 'interestseed-activity-value', text: String(item.count) });
    }

    const feedback = this.contentEl.createDiv({ cls: 'interestseed-overview-section' });
    feedback.createEl('h3', { text: '反馈分布' });
    for (const [key, count] of Object.entries(this.overview.feedback)) {
      if (count > 0) {
        feedback.createDiv({
          text: `${FEEDBACK_LABELS[key] ?? key}：${count}`,
        });
      }
    }

    const application = this.contentEl.createDiv({ cls: 'interestseed-overview-section' });
    application.createEl('h3', { text: '图谱应用' });
    for (const [key, count] of Object.entries(this.overview.application)) {
      if (count > 0) {
        application.createDiv({ text: `${key}：${count}` });
      }
    }

    const themes = this.contentEl.createDiv({ cls: 'interestseed-overview-section' });
    themes.createEl('h3', { text: '主题分布' });
    for (const theme of this.overview.themes.slice(0, 8)) {
      themes.createDiv({
        cls: 'interestseed-overview-row',
        text: `${theme.key}：活动 ${theme.active} / 接受 ${theme.accepted} / 修正 ${theme.corrected} / 低价值 ${theme.lowValue}`,
      });
    }

    const edges = this.contentEl.createDiv({ cls: 'interestseed-overview-section' });
    edges.createEl('h3', { text: '已应用关系' });
    if (this.overview.appliedEdges.length === 0) {
      edges.createDiv({ text: '暂无已应用关系。' });
    } else {
      for (const edge of this.overview.appliedEdges) {
        edges.createDiv({
          cls: 'interestseed-overview-row',
          text: `${edge.source} → ${edge.target}（${edge.relation}）`,
        });
      }
    }

    const recent = this.contentEl.createDiv({ cls: 'interestseed-overview-section' });
    recent.createEl('h3', { text: '最近变化' });
    for (const item of this.overview.recent) {
      recent.createDiv({
        cls: 'interestseed-overview-row',
        text: `${item.title} · ${FEEDBACK_LABELS[item.feedback] ?? item.feedback} · ${item.application}`,
      });
    }
  }

  override onClose(): void {
    this.contentEl.empty();
  }

  private stat(parent: HTMLElement, label: string, value: number): void {
    const box = parent.createDiv({ cls: 'interestseed-overview-stat' });
    box.createSpan({ cls: 'interestseed-overview-stat-value', text: String(value) });
    box.createSpan({ cls: 'interestseed-overview-stat-label', text: label });
  }
}
