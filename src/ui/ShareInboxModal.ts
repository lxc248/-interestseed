import { Modal, Notice, setIcon } from 'obsidian';
import type { App } from 'obsidian';
import type InterestSeedPlugin from '../main';
import { analyzeShareText } from '../services/shareAnalysis';
import type { ShareInboxItem } from '../inbox/ShareInbox';

/**
 * Focus Deck for unjudged shares.
 *
 * One card, one decision, swipe or press. The queue never becomes a wall of
 * cards; adding another share is deliberately tucked away below the card.
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
    const pending = this.plugin.getPendingInboxItems();
    const shell = root.createDiv({ cls: 'interestseed-inbox-deck-shell' });

    const header = shell.createDiv({ cls: 'interestseed-inbox-header' });
    const mark = header.createDiv({ cls: 'interestseed-inbox-mark' });
    setIcon(mark, 'inbox');
    const copy = header.createDiv({ cls: 'interestseed-inbox-header-copy' });
    copy.createDiv({ cls: 'interestseed-inbox-kicker', text: 'FOCUS DECK / SHARE INBOX' });
    copy.createEl('h2', {
      cls: 'interestseed-inbox-title',
      text: pending.length > 0 ? '一条一条来。' : '先放进来。',
    });
    copy.createEl('p', {
      cls: 'interestseed-inbox-lede',
      text:
        pending.length > 0
          ? '只看这一条。滑走，或留下并连接。'
          : '下一次刷到让你停下来的内容，先放进来，再决定它是不是你的兴趣。',
    });
    const count = header.createDiv({ cls: 'interestseed-inbox-count' });
    count.createSpan({ text: String(pending.length) });
    count.createSpan({ cls: 'interestseed-inbox-count-label', text: '待判断' });

    if (pending.length === 0) {
      this.renderAdd(shell, true);
      this.renderEmpty(shell);
      return;
    }

    const first = pending[0];
    if (first) this.renderCard(shell, first, pending.length);

    const add = shell.createEl('details', { cls: 'interestseed-inbox-add-details' });
    add.createEl('summary', { text: '再放一条进来' });
    this.renderAdd(add, false);
  }

  private renderCard(host: HTMLElement, item: ShareInboxItem, total: number): void {
    const analysis = analyzeShareText(item.text);
    const stage = host.createDiv({ cls: 'interestseed-inbox-stage' });
    const progress = stage.createDiv({ cls: 'interestseed-inbox-progress' });
    progress.createDiv({ cls: 'interestseed-inbox-progress-bar' });
    progress.createSpan({ cls: 'interestseed-inbox-progress-text', text: `01 / ${String(total).padStart(2, '0')}` });

    const card = stage.createDiv({
      cls: 'interestseed-inbox-card',
      attr: { tabindex: '0', role: 'group', 'aria-label': '待判断分享' },
    });
    const top = card.createDiv({ cls: 'interestseed-inbox-item-top' });
    top.createSpan({ cls: 'interestseed-inbox-platform', text: analysis.platformLabel });
    top.createSpan({
      cls: 'interestseed-inbox-item-date',
      text: item.addedAt ? item.addedAt.slice(0, 10) : '',
    });

    const title = card.createDiv({ cls: 'interestseed-inbox-item-title', text: analysis.title });
    title.setAttribute('title', analysis.title);
    card.createDiv({ cls: 'interestseed-inbox-item-raw', text: item.text });
    if (analysis.topics.length > 0) {
      const topics = card.createDiv({ cls: 'interestseed-inbox-topics' });
      for (const topic of analysis.topics) topics.createSpan({ text: topic });
    }

    const hint = card.createDiv({ cls: 'interestseed-inbox-swipe-hint' });
    setIcon(hint.createSpan({ cls: 'interestseed-inbox-swipe-icon' }), 'move-horizontal');
    hint.createSpan({ text: '左滑路过 · 右滑留下' });

    const actions = card.createDiv({ cls: 'interestseed-inbox-actions' });
    const pass = actions.createEl('button', {
      cls: 'interestseed-inbox-pass',
      attr: { type: 'button', 'aria-label': '只是路过，不保存' },
    });
    setIcon(pass.createSpan({ cls: 'interestseed-inbox-action-icon' }), 'arrow-left');
    pass.createSpan({ text: '只是路过' });
    pass.addEventListener('click', () => this.pass(item));

    const process = actions.createEl('button', {
      cls: 'mod-cta interestseed-inbox-keep',
      attr: { type: 'button', 'aria-label': '留下并连接' },
    });
    process.createSpan({ text: '留下并连接' });
    setIcon(process.createSpan({ cls: 'interestseed-inbox-action-icon' }), 'arrow-right');
    process.addEventListener('click', () => this.keep(item));

    let startX = 0;
    let deltaX = 0;
    let dragging = false;
    const reset = () => {
      dragging = false;
      deltaX = 0;
      card.removeClass('is-dragging');
      card.style.removeProperty('transform');
      card.style.removeProperty('opacity');
    };
    card.addEventListener('pointerdown', (event) => {
      if ((event.target as HTMLElement).closest('button')) return;
      startX = event.clientX;
      dragging = true;
      card.addClass('is-dragging');
      card.setPointerCapture?.(event.pointerId);
    });
    card.addEventListener('pointermove', (event) => {
      if (!dragging) return;
      deltaX = event.clientX - startX;
      const tilt = Math.max(-8, Math.min(8, deltaX / 18));
      card.style.transform = `translateX(${deltaX}px) rotate(${tilt}deg)`;
      card.style.opacity = String(Math.max(0.55, 1 - Math.abs(deltaX) / 520));
    });
    card.addEventListener('pointerup', () => {
      if (!dragging) return;
      if (deltaX > 70) {
        card.addClass('is-keeping');
        window.setTimeout(() => this.keep(item), 120);
        return;
      }
      if (deltaX < -70) {
        card.addClass('is-passing');
        window.setTimeout(() => this.pass(item), 120);
        return;
      }
      reset();
    });
    card.addEventListener('pointercancel', reset);
    card.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        this.pass(item);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        this.keep(item);
      }
    });
    card.focus();
  }

  private renderAdd(host: HTMLElement, empty: boolean): void {
    const add = host.createDiv({ cls: `interestseed-inbox-add${empty ? ' is-empty' : ''}` });
    const input = add.createEl('textarea', {
      cls: 'interestseed-inbox-input',
      attr: {
        rows: '2',
        placeholder: '粘贴一条抖音 / 小红书分享，或一行一句话……',
      },
    });
    const addButton = add.createEl('button', {
      cls: 'mod-cta interestseed-sprint-primary',
      text: '放进来',
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
      new Notice(result.duplicate ? '这条已经在收件箱里了。' : '已放进收件箱。');
      this.render();
    });
  }

  private renderEmpty(host: HTMLElement): void {
    const empty = host.createDiv({ cls: 'interestseed-inbox-empty' });
    empty.createDiv({ cls: 'interestseed-inbox-empty-icon', text: '✦' });
    empty.createDiv({ cls: 'interestseed-inbox-empty-title', text: '收件箱是空的' });
    empty.createDiv({
      cls: 'interestseed-inbox-empty-copy',
      text: '下一次刷到让你停下来的内容，先放进来。一次只看一条，不让收件箱变成收藏夹。',
    });
  }

  private keep(item: ShareInboxItem): void {
    this.close();
    this.plugin.openSparkCapture(item.text, item.id);
  }

  private pass(item: ShareInboxItem): void {
    this.plugin.resolveInboxItem(item.id, 'passed');
    this.render();
  }
}
