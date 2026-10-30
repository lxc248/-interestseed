export function setIcon(): void {}
export class Notice {}

export class Modal {
  app: unknown;
  private titleElement: HTMLElement | null = null;
  private bodyElement: HTMLElement | null = null;
  constructor(app: unknown) {
    this.app = app;
  }
  get titleEl(): HTMLElement {
    if (!this.titleElement) this.titleElement = document.createElement('div');
    return this.titleElement;
  }
  get contentEl(): HTMLElement {
    if (!this.bodyElement) this.bodyElement = document.createElement('div');
    return this.bodyElement;
  }
  get modalEl(): HTMLElement {
    return this.contentEl;
  }
  open(): void {
    (this as unknown as { onOpen?: () => void }).onOpen?.();
  }
  close(): void {
    (this as unknown as { onClose?: () => void }).onClose?.();
  }
}

export class ItemView {}

export class TextComponent {
  readonly inputEl: HTMLInputElement;
  constructor(container?: HTMLElement) {
    this.inputEl = document.createElement('input');
    container?.appendChild(this.inputEl);
  }
  setPlaceholder(value: string): this {
    this.inputEl.placeholder = value;
    return this;
  }
  setValue(value: string): this {
    this.inputEl.value = value;
    return this;
  }
  onChange(callback: (value: string) => void): this {
    this.inputEl.addEventListener('input', () => callback(this.inputEl.value));
    return this;
  }
  onChanged(callback: (value: string) => void): this {
    return this.onChange(callback);
  }
}

class DropdownComponent {
  readonly selectEl: HTMLSelectElement;
  constructor(container: HTMLElement) {
    this.selectEl = document.createElement('select');
    container.appendChild(this.selectEl);
  }
  addOption(value: string, label: string): this {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    this.selectEl.appendChild(option);
    return this;
  }
  setValue(value: string): this {
    this.selectEl.value = value;
    return this;
  }
  onChange(callback: (value: string) => void): this {
    this.selectEl.addEventListener('change', () => callback(this.selectEl.value));
    return this;
  }
}

class ButtonComponent {
  readonly buttonEl: HTMLButtonElement;
  constructor(container: HTMLElement) {
    this.buttonEl = document.createElement('button');
    container.appendChild(this.buttonEl);
  }
  setButtonText(value: string): this {
    this.buttonEl.textContent = value;
    return this;
  }
  setCta(): this {
    this.buttonEl.classList.add('mod-cta');
    return this;
  }
  onClick(callback: () => void): this {
    this.buttonEl.addEventListener('click', callback);
    return this;
  }
}

export class Setting {
  private readonly settingEl: HTMLElement;
  constructor(container: HTMLElement) {
    this.settingEl = document.createElement('div');
    container.appendChild(this.settingEl);
  }
  setName(value: string): this {
    const name = document.createElement('div');
    name.textContent = value;
    this.settingEl.appendChild(name);
    return this;
  }
  setDesc(value: string): this {
    const desc = document.createElement('div');
    desc.textContent = value;
    this.settingEl.appendChild(desc);
    return this;
  }
  addDropdown(callback: (dropdown: DropdownComponent) => void): this {
    callback(new DropdownComponent(this.settingEl));
    return this;
  }
  addText(callback: (text: TextComponent) => void): this {
    callback(new TextComponent(this.settingEl));
    return this;
  }
  addButton(callback: (button: ButtonComponent) => void): this {
    callback(new ButtonComponent(this.settingEl));
    return this;
  }
}

export class TFile {}
export function MarkdownRenderer(): void {}
