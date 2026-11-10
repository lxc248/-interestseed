/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Copyright (C) 2026 aicoder
 */
import { Modal, Notice, Setting, type App } from 'obsidian';

import { parseImport } from '../services/importers';

/**
 * Paste an exported favourites file and turn it into inbox items.
 *
 * A paste box rather than a file picker: Obsidian mobile has no OS file dialog,
 * and every platform's export can be copied as text.
 */
export class ImportFavoritesModal extends Modal {
  private text = '';

  constructor(
    app: App,
    private readonly onSubmit: (text: string) => { added: number; duplicates: number; skipped: number },
  ) {
    super(app);
  }

  override onOpen(): void {
    this.contentEl.empty();
    this.contentEl.createEl('h3', { text: '批量导入收藏' });

    const hint = this.contentEl.createEl('p', {
      cls: 'setting-item-description',
      text: '粘贴浏览器书签 HTML、B 站收藏 JSON、CSV（含 url 列）或纯链接列表。导入先进收件箱，再逐条判断保留或放弃。',
    });
    hint.style.marginBottom = '0.5em';

    const textarea = this.contentEl.createEl('textarea', {
      cls: 'interestseed-import-input',
      attr: { rows: '10', placeholder: '把导出文件的内容粘在这里…' },
    });
    textarea.style.width = '100%';
    textarea.style.fontFamily = 'var(--font-monospace)';

    const preview = this.contentEl.createEl('p', { cls: 'setting-item-description' });
    const renderPreview = (): void => {
      this.text = textarea.value;
      if (!this.text.trim()) {
        preview.setText('');
        return;
      }
      const parsed = parseImport(this.text);
      const detected: Record<string, string> = {
        'bookmarks-html': '浏览器书签 HTML',
        json: 'JSON',
        csv: 'CSV',
        urls: '链接列表',
        empty: '空内容',
        unknown: '无法识别',
      };
      const label = detected[parsed.format] ?? parsed.format;
      if (parsed.items.length === 0) {
        preview.setText(`识别为${label}，但没有解析出可导入的条目。`);
        return;
      }
      const extra: string[] = [];
      if (parsed.duplicates > 0) extra.push(`文件内重复 ${parsed.duplicates} 条`);
      if (parsed.truncated) extra.push('超出上限已截断');
      preview.setText(
        `识别为${label}，可导入 ${parsed.items.length} 条${extra.length > 0 ? `（${extra.join('，')}）` : ''}。`,
      );
    };
    textarea.addEventListener('input', renderPreview);

    new Setting(this.contentEl)
      .addButton((button) =>
        button
          .setButtonText('导入到收件箱')
          .setCta()
          .onClick(() => {
            const text = textarea.value.trim();
            if (!text) {
              new Notice('先粘贴导出文件的内容。');
              return;
            }
            const parsed = parseImport(text);
            if (parsed.items.length === 0) {
              new Notice('没有解析出可导入的条目，检查一下文件格式。');
              return;
            }
            const outcome = this.onSubmit(text);
            new Notice(`InterestSeed：导入 ${outcome.added} 条，重复 ${outcome.duplicates} 条`);
            this.close();
          }),
      )
      .addButton((button) => button.setButtonText('关闭').onClick(() => this.close()));
  }

  override onClose(): void {
    this.contentEl.empty();
  }
}
