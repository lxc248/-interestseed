// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { EmptyState } from '../src/ui/EmptyState';

type ElInfo = { cls?: string; text?: string; attr?: Record<string, string | number | boolean> };

function shim(name: string, fn: (...args: never[]) => unknown) {
  Object.defineProperty(HTMLElement.prototype, name, { configurable: true, writable: true, value: fn });
}
shim('empty', function empty(this: HTMLElement) {
  while (this.firstChild) this.removeChild(this.firstChild);
});
shim('addClass', function addClass(this: HTMLElement, value: string) {
  this.classList.add(...value.split(/\s+/).filter(Boolean));
});
shim('toggleClass', function toggleClass(this: HTMLElement, value: string, force?: boolean) {
  this.classList.toggle(value, force);
});
shim('removeClass', function removeClass(this: HTMLElement, value: string) {
  this.classList.remove(...value.split(/\s+/).filter(Boolean));
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
shim('createSpan', function createSpan(this: HTMLElement, options?: ElInfo) {
  return (this as unknown as { createEl(tag: string, o?: ElInfo): HTMLElement }).createEl('span', options);
});

describe('EmptyState', () => {
  it('shows and hides with actions', () => {
    const host = document.createElement('div');
    const empty = new EmptyState(host);
    let clicked = 0;
    empty.show({
      title: '还没有建立地图',
      detail: '先选择一个范围',
      actions: [{ label: '开始', primary: true, onClick: () => { clicked += 1; } }],
    });
    expect(host.querySelector('.interestseed-empty')?.classList.contains('is-hidden')).toBe(false);
    expect(host.textContent).toContain('还没有建立地图');
    (host.querySelector('.interestseed-empty-actions button') as HTMLButtonElement)?.click();
    expect(clicked).toBe(1);
    empty.hide();
    expect(host.querySelector('.interestseed-empty')?.classList.contains('is-hidden')).toBe(true);
  });
});
