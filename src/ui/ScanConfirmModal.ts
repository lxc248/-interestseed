import { Modal, Setting } from 'obsidian';
import type { App } from 'obsidian';

export interface ScanScopeSummary {
  count: number;
  includeFolders: string[];
  excludeFolders: string[];
  includeTags: string[];
}

function foldersText(folders: string[]): string {
  return folders.length > 0 ? folders.join('、') : '整个 vault';
}

/** 重新扫描前展示范围与预计操作，避免误操作。 */
export class ScanConfirmModal extends Modal {
  constructor(
    app: App,
    private readonly summary: ScanScopeSummary,
    private readonly onConfirm: () => void,
  ) {
    super(app);
  }

  override onOpen(): void {
    this.titleEl.setText('重新扫描知识地图');
    const { contentEl } = this;
    contentEl.empty();

    const list = contentEl.createDiv({ cls: 'interestseed-scan-summary' });
    const rows: Array<[string, string]> = [
      ['包含文件夹', foldersText(this.summary.includeFolders)],
      ['排除文件夹', foldersText(this.summary.excludeFolders)],
      [
        '标签过滤',
        this.summary.includeTags.length > 0
          ? this.summary.includeTags.map((tag) => `#${tag}`).join('、')
          : '不过滤',
      ],
      ['预计读取', `${this.summary.count} 篇 Markdown 笔记`],
    ];

    for (const [label, value] of rows) {
      const row = list.createDiv({ cls: 'interestseed-scan-row' });
      row.createSpan({ cls: 'interestseed-scan-label', text: label });
      row.createSpan({ cls: 'interestseed-scan-value', text: value });
    }

    contentEl.createEl('p', {
      cls: 'setting-item-description',
      text: '扫描只会读取上述范围，保留手动创建的节点与关系、已确认 / 已拒绝的关系；不会修改任何源笔记。',
    });
    contentEl.createEl('p', {
      cls: 'setting-item-description',
      text: this.summary.count === 0
        ? '当前范围没有 Markdown 笔记，请先在设置里调整包含目录。'
        : '扫描完成后，新的候选关系会以“建议”形式出现，需要你确认才会生效。',
    });

    new Setting(contentEl)
      .addButton((button) => button.setButtonText('取消').onClick(() => this.close()))
      .addButton((button) =>
        button
          .setButtonText('开始扫描')
          .setCta()
          .onClick(() => {
            this.onConfirm();
            this.close();
          }),
      );
  }

  override onClose(): void {
    this.contentEl.empty();
  }
}
