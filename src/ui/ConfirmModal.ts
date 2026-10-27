import { Modal } from 'obsidian';
import type { App } from 'obsidian';

/**
 * Obsidian/Electron 中 window.confirm 不可靠，统一用 Modal 做确认。
 */
export class ConfirmModal extends Modal {
  private resolved = false;

  constructor(
    app: App,
    private readonly message: string,
    private readonly onResult: (value: boolean) => void,
    private readonly confirmLabel = '确认',
  ) {
    super(app);
  }

  override onOpen(): void {
    this.titleEl.setText('请确认');
    this.contentEl.empty();
    this.contentEl.createEl('p', { text: this.message });
    const actions = this.contentEl.createDiv({ cls: 'interestseed-apply-actions' });
    const cancel = actions.createEl('button', {
      text: '取消',
      cls: 'interestseed-modal-button',
      attr: { type: 'button' },
    });
    cancel.addEventListener('click', () => this.finish(false));
    const confirm = actions.createEl('button', {
      text: this.confirmLabel,
      cls: 'interestseed-modal-button is-primary',
      attr: { type: 'button' },
    });
    confirm.addEventListener('click', () => this.finish(true));
  }

  override onClose(): void {
    if (!this.resolved) this.finish(false);
    this.contentEl.empty();
  }

  private finish(value: boolean): void {
    if (this.resolved) return;
    this.resolved = true;
    this.onResult(value);
    this.close();
  }
}

export function confirmAction(
  app: App,
  message: string,
  confirmLabel = '确认',
): Promise<boolean> {
  return new Promise((resolve) => {
    new ConfirmModal(app, message, resolve, confirmLabel).open();
  });
}
