export function setIcon(): void {}
export class Notice {}
export class Modal {
  app: unknown;
  private title: HTMLElement | null = null;
  private body: HTMLElement | null = null;
  constructor(app: unknown) {
    this.app = app;
  }
  get titleEl(): HTMLElement {
    if (!this.title) this.title = document.createElement('div');
    return this.title;
  }
  get contentEl(): HTMLElement {
    if (!this.body) this.body = document.createElement('div');
    return this.body;
  }
  open(): void {
    (this as unknown as { onOpen?: () => void }).onOpen?.();
  }
  close(): void {
    (this as unknown as { onClose?: () => void }).onClose?.();
  }
}
export class ItemView {}
export class Setting {
  constructor(_container: unknown) {}
  addText(): unknown { return new TextComponent(); }
  addButton(): unknown { return { setButtonText: () => {}, onClick: () => {} }; }
}
export class TextComponent {
  setPlaceholder(): this { return this; }
  setValue(): this { return this; }
  onChanged(): this { return this; }
}
export class TFile {}
export function MarkdownRenderer(): void {}
