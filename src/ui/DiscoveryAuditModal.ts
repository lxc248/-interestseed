import { Modal, Notice, Setting, TFile } from 'obsidian';
import type { App } from 'obsidian';

import { AUDIT_MAX_ACTIVE, AUDIT_MAX_DISMISSED } from '../discovery/audit';
import type { DiscoveryAuditScope } from '../discovery/audit';
import type { AuditVaultBinding } from '../discovery/auditBinding';
import { normalizeAuditReportPath, saveAuditReport } from './auditReport';

export interface AuditScopeModalDeps {
  binding: AuditVaultBinding;
  projectKeys: string[];
  onConfirm(scope: DiscoveryAuditScope): void;
}

/** 范围选择与确认；确认前不读取发现数据。 */
export class DiscoveryAuditScopeModal extends Modal {
  private selected = new Set<string>();
  private fromInput!: HTMLInputElement;
  private toInput!: HTMLInputElement;
  private includeDismissed = false;
  private errorEl!: HTMLElement;

  constructor(
    app: App,
    private readonly deps: AuditScopeModalDeps,
  ) {
    super(app);
  }

  override onOpen(): void {
    this.titleEl.setText('生成发现聚合审计');
    this.contentEl.empty();

    this.contentEl.createEl('p', {
      cls: 'setting-item-description',
      text: '审计只读取当前 Vault 的发现元数据，不读取 Markdown 正文；结果只包含聚合数字。',
    });
    this.contentEl.createEl('p', {
      cls: 'setting-item-description',
      text: `当前 Vault 已绑定。active 上限 ${AUDIT_MAX_ACTIVE} 条，纳入 dismissed 时上限 ${AUDIT_MAX_DISMISSED} 条。`,
    });

    const range = this.contentEl.createDiv({ cls: 'interestseed-audit-range' });
    range.createEl('strong', { text: '顶层项目范围' });
    if (this.deps.projectKeys.length === 0) {
      range.createEl('p', { text: '当前没有可审计的顶层项目范围。' });
    }
    for (const key of this.deps.projectKeys) {
      const label = range.createEl('label');
      const checkbox = label.createEl('input', { type: 'checkbox' });
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) this.selected.add(key);
        else this.selected.delete(key);
      });
      label.createSpan({ text: ` ${key}` });
    }

    const time = this.contentEl.createDiv({ cls: 'interestseed-audit-range' });
    time.createEl('strong', { text: '发现记录更新时间范围（可选）' });
    this.fromInput = time.createEl('input', { type: 'datetime-local' });
    this.toInput = time.createEl('input', { type: 'datetime-local' });

    new Setting(this.contentEl)
      .setName('纳入 dismissed')
      .setDesc('仅在你需要检查被抑制候选时开启。')
      .addToggle((toggle) =>
        toggle.setValue(false).onChange((value) => {
          this.includeDismissed = value;
        }),
      );

    this.errorEl = this.contentEl.createDiv({ cls: 'interestseed-audit-error' });

    new Setting(this.contentEl)
      .addButton((button) => button.setButtonText('取消').onClick(() => this.close()))
      .addButton((button) =>
        button
          .setButtonText('确认并生成预览')
          .setCta()
          .onClick(() => this.confirm()),
      );
  }

  override onClose(): void {
    this.contentEl.empty();
  }

  private confirm(): void {
    if (this.selected.size === 0) {
      this.errorEl.setText('请至少选择一个顶层项目范围。');
      return;
    }
    const from = this.dateValue(this.fromInput.value);
    const to = this.dateValue(this.toInput.value);
    if (from === null || to === null) {
      this.errorEl.setText('时间范围无效。');
      return;
    }
    if (from && to && from > to) {
      this.errorEl.setText('开始时间不能晚于结束时间。');
      return;
    }
    this.deps.onConfirm({
      binding: this.deps.binding,
      rangeConfirmed: true,
      projectKeys: [...this.selected].sort(),
      from: from ?? undefined,
      to: to ?? undefined,
      includeDismissed: this.includeDismissed,
      maxActive: AUDIT_MAX_ACTIVE,
      maxDismissed: AUDIT_MAX_DISMISSED,
    });
    this.close();
  }

  private dateValue(value: string): string | null | undefined {
    if (!value.trim()) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  }
}

export interface AuditPreviewModalDeps {
  text: string;
  onSave(): void;
  onClose(): void;
}

/** 只显示聚合预览；保存按钮由用户再次主动触发。 */
export class DiscoveryAuditPreviewModal extends Modal {
  constructor(
    app: App,
    private readonly deps: AuditPreviewModalDeps,
  ) {
    super(app);
  }

  override onOpen(): void {
    this.titleEl.setText('发现聚合审计预览');
    this.contentEl.empty();
    this.contentEl.createEl('p', {
      cls: 'setting-item-description',
      text: '以下只是当前范围的内存聚合预览；不会自动保存，也不会写回发现数据或图谱。',
    });
    this.contentEl.createEl('pre', {
      cls: 'interestseed-audit-preview',
      text: this.deps.text,
    });

    new Setting(this.contentEl)
      .addButton((button) => button.setButtonText('关闭').onClick(() => this.close()))
      .addButton((button) =>
        button
          .setButtonText('保存报告')
          .setCta()
          .onClick(() => this.deps.onSave()),
      );
  }

  override onClose(): void {
    this.contentEl.empty();
    this.deps.onClose();
  }
}

export interface AuditSaveModalDeps {
  text: string;
  defaultName: string;
  onSaved(): void;
  canSave(): boolean;
}

/** 报告保存独立于发现数据；默认不覆盖已有文件。 */
export class DiscoveryAuditSaveModal extends Modal {
  private nameInput!: HTMLInputElement;
  private overwriteInput!: HTMLInputElement;
  private errorEl!: HTMLElement;

  constructor(
    app: App,
    private readonly deps: AuditSaveModalDeps,
  ) {
    super(app);
  }

  override onOpen(): void {
    this.titleEl.setText('保存聚合审计报告');
    this.contentEl.empty();
    this.contentEl.createEl('p', {
      cls: 'setting-item-description',
      text: '报告只包含聚合白名单字段，不包含单条发现的标题、路径、URI、ID、标签或证据文本。',
    });

    this.nameInput = this.contentEl.createEl('input', {
      type: 'text',
      value: this.deps.defaultName,
    });
    this.nameInput.addClass('interestseed-audit-filename');

    const overwrite = this.contentEl.createEl('label');
    this.overwriteInput = overwrite.createEl('input', { type: 'checkbox' });
    overwrite.createSpan({ text: ' 允许覆盖同名报告' });

    this.errorEl = this.contentEl.createDiv({ cls: 'interestseed-audit-error' });

    new Setting(this.contentEl)
      .addButton((button) => button.setButtonText('取消').onClick(() => this.close()))
      .addButton((button) =>
        button
          .setButtonText('保存')
          .setCta()
          .onClick(() => void this.save()),
      );
  }

  override onClose(): void {
    this.contentEl.empty();
  }

  private async save(): Promise<void> {
    if (!this.deps.canSave()) {
      this.errorEl.setText('审计任务已失效，未保存报告。');
      new Notice('InterestSeed：审计任务已失效，未保存报告。', 8000);
      return;
    }
    const path = normalizeAuditReportPath(this.nameInput.value);
    if (!path) {
      this.errorEl.setText('请输入 Vault 相对 Markdown 文件名。');
      return;
    }
    const existing = this.app.vault.getAbstractFileByPath(path);
    const storage = {
      exists: (candidate: string) =>
        this.app.vault.getAbstractFileByPath(candidate) !== null,
      isFile: (candidate: string) => {
        const file = this.app.vault.getAbstractFileByPath(candidate);
        return file instanceof TFile;
      },
      create: (candidate: string, text: string) =>
        this.app.vault.create(candidate, text).then(() => undefined),
      modify: (candidate: string, text: string) => {
        const file = this.app.vault.getAbstractFileByPath(candidate);
        if (!(file instanceof TFile)) return Promise.reject(new Error('not a file'));
        return this.app.vault.modify(file, text);
      },
    };
    if (existing && !this.overwriteInput.checked) {
      this.errorEl.setText('同名报告已存在；确认后才允许覆盖。');
      return;
    }
    const result = await saveAuditReport(
      storage,
      path,
      this.deps.text,
      this.overwriteInput.checked,
    );
    if (!result.ok) {
      this.errorEl.setText(
        result.reason === 'exists'
          ? '同名报告已存在；确认后才允许覆盖。'
          : result.reason === 'not-file'
            ? '目标路径不是 Markdown 文件。'
            : '审计报告保存失败。',
      );
      new Notice('InterestSeed：审计报告保存失败。', 8000);
      return;
    }
    new Notice(`InterestSeed：审计报告已保存到 ${result.path}。`, 8000);
    this.deps.onSaved();
    this.close();
  }
}
