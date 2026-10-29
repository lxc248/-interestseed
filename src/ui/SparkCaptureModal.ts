import { Modal, Notice, setIcon } from 'obsidian';
import type { App } from 'obsidian';
import type InterestSeedPlugin from '../main';
import { analyzeShareText } from '../services/shareAnalysis';

/**
 * 兴趣火花：把短视频、文章、一次对话里让你停下来的东西，
 * 变成一个待确认的兴趣种子。它不是书签，而是图谱的入口。
 */
export class SparkCaptureModal extends Modal {
  private text = '';
  private targetId = '';
  private why = '';
  private previewEl: HTMLElement | null = null;
  private submitEl: HTMLButtonElement | null = null;

  constructor(
    app: App,
    private readonly plugin: InterestSeedPlugin,
    initialText = '',
  ) {
    super(app);
    this.text = initialText.trim();
    this.modalEl.addClass('interestseed-spark-modal');
  }

  override onOpen(): void {
    this.modalEl.setAttribute('aria-label', '记录兴趣火花');
    this.render();
  }

  override onClose(): void {
    this.contentEl.empty();
  }

  private render(): void {
    const root = this.contentEl;
    root.empty();
    root.addClass('interestseed-spark');
    const header = root.createDiv({ cls: 'interestseed-spark-header' });
    const mark = header.createDiv({ cls: 'interestseed-spark-mark' });
    setIcon(mark, 'sparkles');
    const copy = header.createDiv();
    copy.createDiv({ cls: 'interestseed-spark-kicker', text: 'CAPTURE A SPARK' });
    copy.createEl('h2', { cls: 'interestseed-spark-title', text: '把一个好奇，留成种子。' });
    copy.createEl('p', {
      cls: 'interestseed-spark-lede',
      text: '刷到一条视频、读到一句话、听到一个问题——先记下它，再决定它和你的哪条兴趣有关。',
    });

    const flow = root.createDiv({ cls: 'interestseed-spark-flow' });
    for (const [index, label] of ['识别平台', '提炼兴趣', '你来决定', '进入星图'].entries()) {
      const step = flow.createDiv({ cls: 'interestseed-spark-flow-step' });
      step.createSpan({ cls: 'interestseed-spark-flow-index', text: String(index + 1) });
      step.createSpan({ text: label });
    }

    const input = root.createEl('textarea', {
      cls: 'interestseed-spark-input',
      attr: {
        placeholder: '粘贴一个链接，或写下让你停下来的那句话……',
        rows: '5',
      },
    });
    input.addEventListener('input', () => {
      this.text = input.value;
      this.updatePreview();
    });
    input.value = this.text;
    input.focus();

    const target = root.createEl('select', { cls: 'interestseed-spark-target' });
    target.createEl('option', { text: '先放收件箱，作为新种子', attr: { value: '' } });
    const nodes = this.plugin.store
      .listNodes()
      .filter((node) => !node.metadata?.spark)
      .sort((left, right) => left.title.localeCompare(right.title, 'zh'))
      .slice(0, 40);
    for (const node of nodes) {
      target.createEl('option', { text: node.title, attr: { value: node.id } });
    }
    target.addEventListener('change', () => {
      this.targetId = target.value;
    });

    const whyLabel = root.createEl('label', { cls: 'interestseed-spark-why' });
    whyLabel.createSpan({ text: '为什么留下？（可选，帮下一次判断）' });
    whyLabel.createEl('input', {
      cls: 'interestseed-spark-why-input',
      attr: {
        type: 'text',
        placeholder: '例如：不是想学这个工具，而是想让我做的东西更容易被看见',
      },
    }).addEventListener('input', (event) => {
      this.why = (event.target as HTMLInputElement).value;
    });

    const preview = root.createDiv({ cls: 'interestseed-spark-preview' });
    this.previewEl = preview;
    this.updatePreview();

    const footer = root.createDiv({ cls: 'interestseed-spark-footer' });
    const cancel = footer.createEl('button', {
      cls: 'interestseed-sprint-secondary interestseed-spark-pass',
      text: '只是路过',
      attr: {
        type: 'button',
        title: '不写入图谱，也不需要解释',
        'aria-label': '只是路过，不保存这个火花',
      },
    });
    cancel.addEventListener('click', () => {
      new Notice('没有写入图谱。下一次真正重要的内容，再留下。');
      this.close();
    });
    this.submitEl = footer.createEl('button', {
      cls: 'mod-cta interestseed-sprint-primary',
      text: '留下这个火花',
      attr: { type: 'button' },
    });
    this.submitEl.disabled = true;
    this.submitEl.addEventListener('click', () => this.submit());
    this.updatePreview();
  }

  private updatePreview(): void {
    if (!this.previewEl) return;
    const analysis = analyzeShareText(this.text);
    this.previewEl.empty();
    if (!this.text.trim()) {
      this.previewEl.addClass('is-empty');
      this.previewEl.createDiv({
        cls: 'interestseed-spark-preview-placeholder',
        text: '粘贴一条抖音/小红书分享链接，或写下一句让你停下来的话',
      });
      if (this.submitEl) this.submitEl.disabled = true;
      return;
    }
    this.previewEl.removeClass('is-empty');
    const top = this.previewEl.createDiv({ cls: 'interestseed-spark-preview-top' });
    const icon = top.createDiv({ cls: 'interestseed-spark-preview-icon' });
    setIcon(icon, analysis.platform === 'text' ? 'quote' : 'play');
    const platform = top.createDiv({ cls: 'interestseed-spark-platform', text: analysis.platformLabel });
    top.appendChild(platform);
    const copy = this.previewEl.createDiv();
    copy.createDiv({ cls: 'interestseed-spark-preview-kicker', text: 'CANDIDATE SPARK' });
    copy.createDiv({ cls: 'interestseed-spark-preview-title', text: analysis.title });
    if (analysis.topics.length > 0) {
      const topicRow = copy.createDiv({ cls: 'interestseed-spark-topics' });
      for (const topic of analysis.topics) {
        topicRow.createSpan({ text: topic });
      }
    }
    copy.createDiv({ cls: 'interestseed-spark-preview-detail', text: analysis.why });
    copy.createDiv({ cls: 'interestseed-spark-next-question', text: analysis.nextQuestion });
    if (this.submitEl) this.submitEl.disabled = false;
  }

  private submit(): void {
    const id = this.plugin.captureInterestSpark(this.text, this.targetId || undefined, this.why);
    if (!id) return;
    this.plugin.setSelectedNode(id);
    new Notice(
      this.targetId
        ? '火花已留下，并且连上了一个已有兴趣。去图谱看看这条连接。'
        : '火花已留下。下一步：给它选一个已有兴趣，或让它先待在收件箱。',
    );
    void this.plugin.activateView();
    this.close();
  }
}
