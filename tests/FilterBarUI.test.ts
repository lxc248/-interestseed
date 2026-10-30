// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FilterBar } from '../src/ui/FilterBar';

type ElInfo = { cls?: string; text?: string; attr?: Record<string, string | number | boolean> };

function shim(name: string, fn: (...args: never[]) => unknown) {
  Object.defineProperty(HTMLElement.prototype, name, {
    configurable: true,
    writable: true,
    value: fn,
  });
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
shim('setText', function setText(this: HTMLElement, value: string) {
  this.textContent = value;
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

afterEach(() => {
  vi.useRealTimers();
});

describe('FilterBar UI', () => {
  it('renders labelled inputs and a polite live summary', () => {
    const host = document.createElement('div');
    const bar = new FilterBar(host, () => {});

    const search = host.querySelector('.interestseed-search') as HTMLInputElement;
    const summary = host.querySelector('.interestseed-summary') as HTMLElement;
    expect(search?.getAttribute('aria-label')).toBe('搜索节点');
    expect(summary?.getAttribute('aria-live')).toBe('polite');
    expect(host.querySelectorAll('.interestseed-chip').length).toBeGreaterThan(0);
    bar.destroy();
  });

  it('debounces changes and resets cleanly', () => {
    vi.useFakeTimers();
    const host = document.createElement('div');
    let changed = 0;
    const bar = new FilterBar(host, () => { changed += 1; });

    const search = host.querySelector('.interestseed-search') as HTMLInputElement;
    search.value = 'focus';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    expect(changed).toBe(0);

    vi.advanceTimersByTime(150);
    expect(changed).toBe(1);
    expect(bar.getFilter().query).toBe('focus');

    bar.reset();
    expect(bar.getFilter().query).toBe('');
    expect(search.value).toBe('');

    bar.destroy();
    expect(host.childElementCount).toBe(0);
  });
});
