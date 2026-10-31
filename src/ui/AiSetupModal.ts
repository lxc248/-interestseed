import { Modal, Notice, type App } from 'obsidian';

export interface AiSetupModalOptions {
  endpoint: string;
  providerLabel: string;
  enabled: boolean;
  consentGranted: boolean;
  hasKey: boolean;
  onSaveKey(key: string): Promise<void>;
  onOpenSettings(): void;
}

/**
 * AI 接入引导。只负责解释和保存本地服务 Key；
 * 不发起模型请求，也不把 Key 写进 data.json。
 */
export class AiSetupModal extends Modal {
  private keyDraft = '';

  constructor(
    app: App,
    private readonly options: AiSetupModalOptions,
  ) {
    super(app);
  }

  override onOpen(): void {
    this.titleEl.setText('把 AI 推荐接上');
    this.render();
  }

  override onClose(): void {
    this.keyDraft = '';
    this.contentEl.empty();
  }

  private render(): void {
    this.contentEl.empty();
    this.contentEl.addClass('interestseed-ai-setup');

    this.contentEl.createEl('p', {
      cls: 'interestseed-ai-setup-lede',
      text: this.options.enabled && this.options.consentGranted
        ? 'AI 关系建议已经开启，但本地模型服务需要你自己的 API Key。填一次，之后就能直接在图谱里用。'
        : 'AI 关系建议需要先开启并授权，再填入你自己的本地服务 API Key。',
    });

    const facts = this.contentEl.createDiv({ cls: 'interestseed-ai-setup-facts' });
    this.fact(facts, '当前模型', this.options.providerLabel);
    this.fact(facts, '服务地址', this.options.endpoint);
    this.fact(
      facts,
      '当前状态',
      !this.options.enabled
        ? 'AI 已关闭'
        : !this.options.consentGranted
          ? '尚未授权发送字段'
          : this.options.hasKey
            ? '已保存 Key'
            : '还没有保存 Key',
    );

    const privacy = this.contentEl.createDiv({ cls: 'interestseed-ai-setup-note' });
    privacy.createEl('strong', { text: '只会发送这些字段' });
    privacy.createEl('p', {
      text: '节点 id、标题、标签。不会发送笔记正文、来源路径、完整观察或 Vault 内容。',
    });

    const keyRow = this.contentEl.createDiv({ cls: 'interestseed-ai-setup-key' });
    keyRow.createEl('label', {
      text: '本地服务 API Key',
      attr: { for: 'interestseed-ai-key-input' },
    });
    const input = keyRow.createEl('input', {
      cls: 'interestseed-ai-setup-input',
      attr: {
        id: 'interestseed-ai-key-input',
        type: 'password',
        placeholder: this.options.hasKey
          ? '已保存 Key，留空保持不变；输入新 Key 可替换'
          : '粘贴你的本地服务 Key',
        autocomplete: 'off',
        spellcheck: 'false',
      },
    });
    input.addEventListener('input', () => {
      this.keyDraft = input.value;
    });

    const save = keyRow.createEl('button', {
      cls: 'interestseed-ai-setup-save',
      text: '保存 Key',
      attr: { type: 'button' },
    });
    save.addEventListener('click', () => {
      void this.save();
    });
    if (this.options.hasKey) {
      keyRow.createEl('p', {
        cls: 'interestseed-ai-setup-key-saved',
        text: '已保存 Key，出于安全不回显。留空保存不会覆盖原 Key。',
      });
    }

    const actions = this.contentEl.createDiv({ cls: 'interestseed-ai-setup-actions' });
    if (this.options.hasKey) {
      actions.createEl('button', {
        text: '清除已保存 Key',
        attr: { type: 'button' },
      }).addEventListener('click', () => {
        void this.clearKey();
      });
    }
    actions.createEl('button', {
      text: '打开设置',
      attr: { type: 'button' },
    }).addEventListener('click', () => {
      this.options.onOpenSettings();
      this.close();
    });

    actions.createEl('button', {
      text: '稍后',
      attr: { type: 'button' },
    }).addEventListener('click', () => this.close());

    this.contentEl.createEl('p', {
      cls: 'interestseed-ai-setup-footnote',
      text: 'Key 只保存在本机 Obsidian SecretStorage，不写入 data.json，也不会随图谱导出。',
    });
  }

  private fact(parent: HTMLElement, label: string, value: string): void {
    const row = parent.createDiv({ cls: 'interestseed-ai-setup-fact' });
    row.createEl('span', { text: label });
    row.createEl('strong', { text: value });
  }

  private async save(): Promise<void> {
    const value = this.keyDraft.trim();
    if (!value) {
      if (this.options.hasKey) {
        this.close();
        return;
      }
      new Notice('先填入本地服务 API Key。');
      return;
    }
    await this.options.onSaveKey(value);
    new Notice('AI API Key 已保存到 Obsidian 安全存储。');
    this.close();
  }

  private async clearKey(): Promise<void> {
    await this.options.onSaveKey('');
    new Notice('AI API Key 已清除。');
    this.close();
  }
}
