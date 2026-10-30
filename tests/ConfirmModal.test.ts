// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { ConfirmModal } from '../src/ui/ConfirmModal';

type ElInfo = { cls?: string; text?: string; attr?: Record<string, string | number | boolean> };

function shim(name: string, fn: (...args: never[]) => unknown) {
  Object.defineProperty(HTMLElement.prototype, name, { configurable: true, writable: true, value: fn });
}
shim('empty', function empty(this: HTMLElement) {
  while (this.firstChild) this.removeChild(this.firstChild);
});
shim('setText', function setText(this: HTMLElement, value: string) {
  this.textContent = value;
});
shim('createEl', function createEl(this: HTMLElement, tag: string, options?: ElInfo) {
  const el = document.createElement(tag);
  if (options?.cls) el.className = options.cls;
  if (options?.text !== undefined) el.textContent = String(options.text);
  if (options?.attr) for (const [key, value] of Object.entries(options.attr)) el.setAttribute(key, String(value));
  this.appendChild(el);
  return el;
});
shim('createDiv', function createDiv(this: HTMLElement, options?: ElInfo) {
  return (this as unknown as { createEl(tag: string, o?: ElInfo): HTMLElement }).createEl('div', options);
});

describe('ConfirmModal', () => {
  it('resolves true on confirm click', () => {
    let value: boolean | null = null;
    const modal = new ConfirmModal({} as never, '确定删除？', (result) => { value = result; });
    modal.open();
    const buttons = modal.contentEl.querySelectorAll('button');
    expect(buttons.length).toBe(2);
    (buttons[1] as HTMLButtonElement).click();
    expect(value).toBe(true);
  });
});
