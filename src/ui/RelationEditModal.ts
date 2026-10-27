import { Modal, Notice, Setting } from 'obsidian';
import type { App } from 'obsidian';

/** 修改关系名称；关系 ID 由调用方保持不变。 */
export class RelationEditModal extends Modal {
  private relation: string;
  private readonly previousFocus: HTMLElement | null;

  constructor(
    app: App,
    currentRelation: string,
    private readonly onSubmit: (relation: string) => void,
  ) {
    super(app);
    this.relation = currentRelation;
    this.previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }

  override onOpen(): void {
    this.titleEl.setText('编辑关系名称');
    const { contentEl } = this;
    contentEl.empty();
    let inputEl: HTMLInputElement | null = null;

    new Setting(contentEl).setName('关系名称').addText((text) => {
      inputEl = text.inputEl;
      text.inputEl.setAttribute('aria-label', '关系名称');
      text
        .setPlaceholder('例如：references、related-to、about')
        .setValue(this.relation)
        .onChange((value) => {
          this.relation = value.trim();
        });
      text.inputEl.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') this.submit();
      });
    });
    window.setTimeout(() => inputEl?.focus(), 0);

    new Setting(contentEl)
      .setDesc('只修改关系名称，关系的 ID、来源和状态保持不变。')
      .addButton((button) =>
        button
          .setButtonText('保存')
          .setCta()
          .onClick(() => this.submit()),
      )
      .addButton((button) =>
        button.setButtonText('取消').onClick(() => this.close()),
      );
  }

  override onClose(): void {
    this.contentEl.empty();
    if (this.previousFocus?.isConnected) this.previousFocus.focus();
  }

  private submit(): void {
    const relation = this.relation.trim();
    if (!relation) {
      new Notice('关系名称不能为空。');
      return;
    }
    this.onSubmit(relation);
    this.close();
  }
}
