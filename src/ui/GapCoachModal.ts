import { Modal, Notice, setIcon } from 'obsidian';
import type { App } from 'obsidian';
import type InterestSeedPlugin from '../main';
import type { Insight } from '../core/InsightEngine';

/**
 * 图谱缺口教练：把“图谱洞察”变成一次具体的补充，而不是又一张静态卡片。
 * 用户写下一个观察，系统只生成一个候选连接，仍然需要用户在图谱里确认/编辑。
 */
export class GapCoachModal extends Modal {
  private text = '';

  constructor(
    app: App,
    private readonly plugin: InterestSeedPlugin,
    private readonly insight: Insight,
  ) {
    super(app);
    this.modalEl.addClass('interestseed-gap-modal');
  }

  override onOpen(): void {
    this.render();
  }

  override onClose(): void {
    this.contentEl.empty();
  }

  private render(): void {
    const root = this.contentEl;
    root.empty();
    root.addClass('interestseed-gap');
    const header = root.createDiv({ cls: 'interestseed-gap-header' });
    const mark = header.createDiv({ cls: 'interestseed-gap-mark' });
    setIcon(mark, 'git-branch');
    const copy = header.createDiv();
    copy.createDiv({ cls: 'interestseed-gap-kicker', text: 'GAP COACH' });
    copy.createEl('h2', { cls: 'interestseed-gap-title', text: this.insight.title });
    copy.createEl('p', { cls: 'interestseed-gap-lede', text: this.insight.detail });

    const prompt = root.createDiv({ cls: 'interestseed-gap-prompt' });
    prompt.createDiv({ cls: 'interestseed-gap-label', text: '给它一个具体的观察' });
    prompt.createDiv({
      cls: 'interestseed-gap-hint',
      text: '可以是一个例子、一段经历、一个你想验证的问题。越具体，越容易长成下一条真实连接。',
    });
    const input = root.createEl('textarea', {
      cls: 'interestseed-gap-input',
      attr: { rows: '4', placeholder: '例如：我最近在三个不同项目里都反复遇到“如何让人愿意开始”这个问题……' },
    });
    input.addEventListener('input', () => {
      this.text = input.value;
    });
    input.focus();

    const footer = root.createDiv({ cls: 'interestseed-gap-footer' });
    const cancel = footer.createEl('button', {
      cls: 'interestseed-sprint-secondary',
      text: '先不补',
      attr: { type: 'button' },
    });
    cancel.addEventListener('click', () => this.close());
    const submit = footer.createEl('button', {
      cls: 'mod-cta interestseed-sprint-primary',
      text: '种下这个观察',
      attr: { type: 'button' },
    });
    submit.addEventListener('click', () => {
      if (!this.text.trim()) {
        new Notice('写一句具体的观察，再种下它。');
        return;
      }
      this.plugin.captureGapSeed(this.insight, this.text);
      new Notice('观察已种下。去看看它和哪条连接最像。');
      void this.plugin.activateView();
      this.close();
    });
  }
}
