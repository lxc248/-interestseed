import { Modal, Notice, setIcon } from 'obsidian';
import type { App } from 'obsidian';
import type InterestSeedPlugin from '../main';
import { analyzeShareText } from '../services/shareAnalysis';
import type { ShareInboxItem } from '../inbox/ShareInbox';

/**
 * One queue for shares that are not judged yet.
 * It deliberately shows one candidate at a time instead of a wall of cards.
 */
export class ShareInboxModal extends Modal {
  constructor(
    app: App,
    private readonly plugin: InterestSeedPlugin,
  ) {
    super(app);
    this.modalEl.addClass('interestseed-inbox-modal');
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
    root.addClass('interestseed-share-inbox');
    const header = root.createDiv({ cls: 'interestseed-inbox-header' });
    const mark = header.createDiv({ cls: 'interestseed-inbox-mark' });
    setIcon(mark, 'inbox');
    const copy = header.createDiv();
    copy.createDiv({ cls: 'interestseed-inbox-kicker', text: 'SHARE INBOX' });
    copy.createEl('h2', { cls: 'interestseed-inbox-title', text: '先放进来，再一次判断。' });
    copy.createEl('p', {
      cls: 'interestseed-inbox-lede',
      text: '刷到的内容不必当场处理。一次只看一条，决定留下或只是路过。',
    });

    const pending = this.plugin.getPendingInboxItems();
    const meta = root.createDiv({ cls: 'interestseed-inbox-meta' });
    meta.createSpan({ text: `${pending.length} 条待判断` });

    const add = root.createDiv({ cls: 'interestseed-inbox-add' });
    const input = add.createEl('textarea', {
      cls: 'interestseed-inbox-input',
      attr: {
        rows: '2',
        placeholder: '粘贴一条抖音/小红书分享，或一行一句……',
      },
    });
    const addButton = add.createEl('button', {
      cls: 'mod-cta interestseed-sprint-primary',
      text: '加入收件箱',
      attr: { type: 'button' },
    });
    addButton.addEventListener('click', () => {
      const value = input.value.trim();
      if (!value) return;
      const result = this.plugin.enqueueShare(value);
      if (!result) {
        new Notice('先写下一句话，或粘贴一个分享链接。');
        return;
      }
      new Notice(result.duplicate ? '这条已经在收件箱里了。' : '已加入收件箱。');
      this.render();
    });

    if (pending.length === 0) {
      const empty = root.createDiv({ cls: 'interestseed-inbox-empty' });
      empty.createDiv({ cls: 'interestseed-inbox-empty-icon', text: '✦' });
      empty.createDiv({ cls: 'interestseed-inbox-empty-title', text: '收件箱是空的' });
      empty.createDiv({
        cls: 'interestseed-inbox-empty-copy',
        text: '下一次刷到让你停下来的内容，先放进来，再决定它是不是你的兴趣。',
      });
      return;
    }

    const list = root.createDiv({ cls: 'interestseed-inbox-list' });
    for (const item of pending.slice(0, 40)) {
      this.renderItem(list, item);
    }
  }

  private renderItem(host: HTMLElement, item: ShareInboxItem): void {
    const analysis = analyzeShareText(item.text);
    const row = host.createDiv({ cls: 'interestseed-inbox-item' });
    const top = row.createDiv({ cls: 'interestseed-inbox-item-top' });
    top.createSpan({ cls: 'interestseed-inbox-platform', text: analysis.platformLabel });
    top.createSpan({
      cls: 'interestseed-inbox-item-date',
      text: item.addedAt ? item.addedAt.slice(0, 10) : '',
    });
    row.createDiv({ cls: 'interestseed-inbox-item-title', text: analysis.title });
    row.createDiv({ cls: 'interestseed-inbox-item-raw', text: item.text });
    if (analysis.topics.length > 0) {
      const topics = row.createDiv({ cls: 'interestseed-inbox-topics' });
      for (const topic of analysis.topics) topics.createSpan({ text: topic });
    }
    const actions = row.createDiv({ cls: 'interestseed-inbox-actions' });
    const process = actions.createEl('button', {
      cls: 'mod-cta',
      text: '处理这一条',
      attr: { type: 'button' },
    });
    process.addEventListener('click', () => {
      this.close();
      this.plugin.openSparkCapture(item.text, item.id);
    });
    const pass = actions.createEl('button', {
      cls: 'interestseed-inbox-pass',
      text: '只是路过',
      attr: { type: 'button' },
    });
    pass.addEventListener('click', () => {
      this.plugin.resolveInboxItem(item.id, 'passed');
      this.render();
    });
  }
}
