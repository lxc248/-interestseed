type ElInfo = { cls?: string; text?: string; attr?: Record<string, string | number | boolean> };

function shim(name: string, fn: (...args: never[]) => unknown) {
  Object.defineProperty(HTMLElement.prototype, name, {
    configurable: true,
    writable: true,
    value: fn,
  });
}

export function installDomShims(): void {
  shim('empty', function empty(this: HTMLElement) {
    while (this.firstChild) this.removeChild(this.firstChild);
  });
  shim('addClass', function addClass(this: HTMLElement, value: string) {
    this.classList.add(...value.split(/\s+/).filter(Boolean));
  });
  shim('removeClass', function removeClass(this: HTMLElement, value: string) {
    this.classList.remove(...value.split(/\s+/).filter(Boolean));
  });
  shim('toggleClass', function toggleClass(this: HTMLElement, value: string, force?: boolean) {
    this.classList.toggle(value, force);
  });
  shim('setText', function setText(this: HTMLElement, value: string) {
    this.textContent = value;
  });
  shim('setAttr', function setAttr(this: HTMLElement, key: string, value: string) {
    this.setAttribute(key, value);
  });
  shim('createEl', function createEl(this: HTMLElement, tag: string, options?: ElInfo) {
    const el = document.createElement(tag);
    if (options?.cls) el.className = options.cls;
    if (options?.text !== undefined) el.textContent = String(options.text);
    if (options?.attr) {
      for (const [key, value] of Object.entries(options.attr)) {
        el.setAttribute(key, String(value));
      }
    }
    this.appendChild(el);
    return el;
  });
  shim('createDiv', function createDiv(this: HTMLElement, options?: ElInfo) {
    return (this as unknown as { createEl(tag: string, o?: ElInfo): HTMLElement }).createEl('div', options);
  });
  shim('createSpan', function createSpan(this: HTMLElement, options?: ElInfo) {
    return (this as unknown as { createEl(tag: string, o?: ElInfo): HTMLElement }).createEl('span', options);
  });
}
