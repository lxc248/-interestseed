import { Modal, Notice } from 'obsidian';
import type { App } from 'obsidian';

import type { DiscoveryCorrection } from '../discovery/types';

export interface DiscoveryCorrectionModalDeps {
  onSubmit(correction: DiscoveryCorrection): Promise<void>;
}

/**
 * Obsidian 原生修正输入。Electron 的 window.prompt 不可靠，
 * 因此修正内容必须通过 Modal 收集，再交给正式反馈保存链。
 */
export class DiscoveryCorrectionModal extends Modal {
  private titleInput!: HTMLInputElement;
  private descriptionInput!: HTMLTextAreaElement;
  private statusEl!: HTMLElement;
  private submitButton!: HTMLButtonElement;
  private submitting = false;

  constructor(
    app: App,
    private readonly initialTitle: string,
    private readonly initialDescription: string,
    private readonly deps: DiscoveryCorrectionModalDeps,
  ) {
    super(app);
  }

  override onOpen(): void {
    this.titleEl.setText('修正发现');
    this.contentEl.empty();
    this.contentEl.createEl('p', {
      text: '修正内容会单独保存，不会覆盖原始发现、证据或 ID；不会自动应用到图谱。',
    });

    this.contentEl.createEl('label', {
      text: '修正后的标题',
      cls: 'interestseed-correction-label',
    });
    this.titleInput = this.contentEl.createEl('input', {
      type: 'text',
      value: this.initialTitle,
    });
    this.titleInput.addClass('interestseed-correction-title');

    this.contentEl.createEl('label', {
      text: '修正后的描述',
      cls: 'interestseed-correction-label',
    });
    this.descriptionInput = this.contentEl.createEl('textarea', {
      text: this.initialDescription,
    });
    this.descriptionInput.addClass('interestseed-correction-description');

    this.statusEl = this.contentEl.createDiv({
      cls: 'interestseed-apply-status',
      text: '请核对标题和描述。',
    });

    const actions = this.contentEl.createDiv({ cls: 'interestseed-apply-actions' });
    const cancel = actions.createEl('button', {
      text: '取消',
      cls: 'interestseed-modal-button',
      attr: { type: 'button' },
    });
    cancel.addEventListener('click', () => this.close());
    this.submitButton = actions.createEl('button', {
      text: '保存修正',
      cls: 'interestseed-modal-button is-primary',
      attr: { type: 'button' },
    });
    this.submitButton.addEventListener('click', () => void this.submit());
  }

  override onClose(): void {
    this.contentEl.empty();
  }

  private async submit(): Promise<void> {
    if (this.submitting) return;
    const title = this.titleInput.value.trim();
    const description = this.descriptionInput.value.trim();
    if (!title || !description) {
      this.statusEl.setText('标题和描述都不能为空。');
      this.statusEl.addClass('is-error');
      return;
    }
    this.submitting = true;
    this.submitButton.disabled = true;
    this.statusEl.removeClass('is-error');
    this.statusEl.setText('保存中…');
    try {
      await this.deps.onSubmit({
        title,
        description,
        createdAt: new Date().toISOString(),
      });
      this.statusEl.setText('已保存修正。');
      this.close();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.statusEl.setText(`保存失败：${message}`);
      this.statusEl.addClass('is-error');
      new Notice(`InterestSeed：修正保存失败——${message}`, 8000);
      this.submitting = false;
      this.submitButton.disabled = false;
    }
  }
}
