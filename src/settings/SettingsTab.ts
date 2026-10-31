import { Notice, PluginSettingTab, Setting } from 'obsidian';
import type { App } from 'obsidian';
import type InterestSeedPlugin from '../main';
import type { InterestSeedSettings } from '../types/graph';
import { DEEPSEEK_V4_PRO_CONFIG } from '../services/ModelProvider';
import { confirmAction } from '../ui/ConfirmModal';
import { sanitizeTags } from '../utils/validation';
import { sanitizeFolders } from './defaults';

export { DEFAULT_SETTINGS, normalizeSettings } from './defaults';

function foldersToText(folders: string[]): string {
  return folders.join('\n');
}

function parseFolders(text: string): string[] {
  return sanitizeFolders(text);
}

/**
 * 设置页：字段与 InterestSeedSettings 一一对应；
 * AI 连接参数单独存储，不进入设置模型。
 */
export class InterestSeedSettingsTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: InterestSeedPlugin,
  ) {
    super(app, plugin);
  }

  override display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'InterestSeed 设置' });
    containerEl.createEl('p', {
      cls: 'setting-item-description',
      text: '把 vault 里的项目、文档与主题整理成一张可确认的兴趣图谱。',
    });

    this.renderBuildSettings(containerEl);
    this.renderRuleSettings(containerEl);
    this.renderAiSettings(containerEl);
    this.renderDshAgentSettings(containerEl);
  }

  private renderBuildSettings(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: '构建' });

    new Setting(containerEl)
      .setName('打开时自动构建')
      .setDesc('启用插件且图谱为空时，自动扫描一次 vault。')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.autoBuildOnOpen).onChange(async (value) => {
          this.plugin.settings.autoBuildOnOpen = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName('包含文件夹')
      .setDesc('每行一个文件夹；留空表示整个 vault。')
      .addTextArea((text) =>
        text
          .setPlaceholder('Projects\nNotes')
          .setValue(foldersToText(this.plugin.settings.includeFolders))
          .onChange(async (value) => {
            this.plugin.settings.includeFolders = parseFolders(value);
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('排除文件夹')
      .setDesc('每行一个文件夹；优先级高于“包含文件夹”。')
      .addTextArea((text) =>
        text
          .setPlaceholder('.obsidian\n.trash')
          .setValue(foldersToText(this.plugin.settings.excludeFolders))
          .onChange(async (value) => {
            this.plugin.settings.excludeFolders = parseFolders(value);
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('只纳入这些标签')
      .setDesc('每行一个标签；媒体文件不受此限制。留空表示全部纳入。')
      .addTextArea((text) =>
        text
          .setPlaceholder('project\nresearch')
          .setValue(this.plugin.settings.includeTags.join('\n'))
          .onChange(async (value) => {
            this.plugin.settings.includeTags = sanitizeTags(value);
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('立即重建')
      .setDesc('重新扫描 vault，保留手动节点、已确认/已拒绝关系与视口；会先展示扫描范围。')
      .addButton((button) =>
        button.setButtonText('重新扫描').setCta().onClick(() => {
          this.plugin.promptRebuild();
        }),
      );

    new Setting(containerEl)
      .setName('清空图谱')
      .setDesc('删除当前图谱数据（可在图谱视图中撤销一次）。')
      .addButton((button) =>
        button
          .setWarning()
          .setButtonText('清空')
          .onClick(async () => {
            if (!(await confirmAction(this.app, '确定清空当前兴趣图谱吗？'))) return;
            await this.plugin.clearGraph();
          }),
      );

    const lastRebuilt = this.plugin.settingsLastRebuiltAt;
    containerEl.createEl('p', {
      cls: 'setting-item-description',
      text: lastRebuilt
        ? `上次重建：${new Date(lastRebuilt).toLocaleString()}`
        : '尚未重建过图谱。',
    });
  }

  private renderRuleSettings(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: '规则建议' });

    new Setting(containerEl)
      .setName('启用规则建议')
      .setDesc('根据共享标签与用户定义主题生成“建议”关系，确认后才会变成正式关系。')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableRuleSuggestions)
          .onChange(async (value) => {
            this.plugin.settings.enableRuleSuggestions = value;
            await this.plugin.saveSettings();
          }),
      );
  }

  private renderAiSettings(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: 'AI 关系建议' });
    containerEl.createEl('p', {
      cls: 'setting-item-description',
      text: '默认开启。只把节点 id、标题、标签发送给所选模型；不会发送笔记正文、完整 Vault 或个人记录。AI 只生成候选关系，你确认后才会写入图谱。',
    });

    new Setting(containerEl)
      .setName('启用 AI 关系建议')
      .setDesc('关闭后只使用本地规则建议，不发起任何模型请求。')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.enableAI).onChange(async (value) => {
          this.plugin.settings.enableAI = value;
          await this.plugin.saveSettings();
          this.display();
        }),
      );

    new Setting(containerEl)
      .setName('模型提供方')
      .setDesc('本地 DeepSeek 走 localhost:7863；Claudian 使用已安装的 Claudian 插件。')
      .addDropdown((dropdown) =>
        dropdown
          .addOption(DEEPSEEK_V4_PRO_CONFIG.model, '本地 DeepSeek V4 Pro')
          .addOption('claudian', 'Claudian')
          .setValue(this.plugin.settings.aiProvider)
          .onChange(async (value) => {
            this.plugin.settings.aiProvider =
              value === 'claudian' ? 'claudian' : DEEPSEEK_V4_PRO_CONFIG.model;
            await this.plugin.saveSettings();
            this.display();
          }),
      );

    new Setting(containerEl)
      .setName('允许发送关系请求字段')
      .setDesc('仅节点 id、标题、标签；不包含笔记正文、来源路径、观察全文或个人信息。')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.aiConsentGranted).onChange(async (value) => {
          this.plugin.settings.aiConsentGranted = value;
          await this.plugin.saveSettings();
          this.display();
        }),
      );

    let apiKeyDraft = '';
    new Setting(containerEl)
      .setName('本地服务 API Key（可选）')
      .setDesc('写入 Obsidian 安全存储，不进入 data.json；留空则使用 INTERESTSEED_AI_API_KEY 环境变量。')
      .addText((text) =>
        text
          .setPlaceholder('仅本地服务需要时填写')
          .onChange((value) => {
            apiKeyDraft = value;
          }),
      )
      .addButton((button) =>
        button.setButtonText('保存').onClick(async () => {
          await this.plugin.saveAiApiKey(apiKeyDraft);
          new Notice('AI API Key 已保存到安全存储。');
          this.display();
        }),
      )
      .addButton((button) =>
        button.setButtonText('清除').onClick(async () => {
          await this.plugin.saveAiApiKey('');
          new Notice('AI API Key 已清除。');
          this.display();
        }),
      );

    new Setting(containerEl)
      .setName('接入我的 API')
      .setDesc('打开引导窗口，填写本地服务 Key，或切换到 Claudian。')
      .addButton((button) =>
        button.setButtonText('打开接入引导').onClick(() => this.plugin.openAiSetup()),
      );

    const provider =
      this.plugin.settings.aiProvider === 'claudian'
        ? 'Claudian（使用其现有模型配置）'
        : `本地 DeepSeek V4 Pro · ${DEEPSEEK_V4_PRO_CONFIG.baseUrl}`;
    containerEl.createEl('p', {
      cls: 'setting-item-description',
      text: `当前模型：${provider}。本地服务需要先在电脑上启动；AI 不可用时会自动保留本地规则发现。`,
    });
  }

  private renderDshAgentSettings(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: 'DSH Agent 工作台（桌面）' });
    containerEl.createEl('p', {
      cls: 'setting-item-description',
      text: '通过 DSH 的 ACP profile 启动嵌入式 Agent。DSH 自己拥有模型、工具、沙箱和权限；InterestSeed 只提供会话界面。',
    });

    new Setting(containerEl)
      .setName('启用 DSH Agent')
      .setDesc('桌面端可用；关闭时不会启动任何子进程。')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.enableDshAgent).onChange(async (value) => {
          this.plugin.settings.enableDshAgent = value;
          await this.plugin.saveSettings();
          this.display();
        }),
      );

    new Setting(containerEl)
      .setName('DSH 命令')
      .setDesc('例如 dsh，或 D:\\dsh\\resources\\runtime\\cli\\bin\\dsh.cmd。使用当前 Vault 作为工作目录。')
      .addText((text) =>
        text
          .setPlaceholder('dsh')
          .setValue(this.plugin.settings.dshCommand)
          .onChange(async (value) => {
            this.plugin.settings.dshCommand = value.trim() || 'dsh';
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('DSH profile')
      .setDesc('默认 acp；这是 DSH 的 ACP stdio 自动化 profile。')
      .addText((text) =>
        text
          .setPlaceholder('acp')
          .setValue(this.plugin.settings.dshProfile)
          .onChange(async (value) => {
            this.plugin.settings.dshProfile = value.trim() || 'acp';
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('DSH 模型')
      .setDesc('provider/model，例如 deepseek-account/deepseek-flash；留空让 DSH 选择。')
      .addText((text) =>
        text
          .setPlaceholder('wodebody/cn:deepseek-v4.1-flash')
          .setValue(this.plugin.settings.dshModel)
          .onChange(async (value) => {
            this.plugin.settings.dshModel = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('打开 Agent 工作台')
      .setDesc('会话、工具调用和权限请求会在新视图中展示。')
      .addButton((button) =>
        button
          .setButtonText('打开')
          .setCta()
          .onClick(() => this.plugin.activateAgentView()),
      );

    new Setting(containerEl)
      .setName('安装 / 启用 Obsidian CLI')
      .setDesc('为 obsidian-cli skill 准备系统命令；会打开 Obsidian 官方的 CLI 注册流程。')
      .addButton((button) =>
        button.setButtonText('启用 CLI').onClick(async () => {
          const electron = (window as unknown as {
            electron?: {
              ipcRenderer?: {
                sendSync(channel: string, value: unknown): unknown;
                invoke(channel: string): Promise<{ success?: boolean; message?: string }>;
              };
            };
          }).electron;
          if (!electron?.ipcRenderer) {
            new Notice('当前不是 Obsidian 桌面环境，无法启用 CLI。');
            return;
          }
          electron.ipcRenderer.sendSync('cli', true);
          try {
            const result = await electron.ipcRenderer.invoke('register-cli');
            new Notice(result.success ? 'Obsidian CLI 已启用。请重启终端。' : (result.message ?? 'CLI 注册未完成。'));
          } catch (error) {
            new Notice(`CLI 注册失败：${error instanceof Error ? error.message : String(error)}`);
          }
        }),
      );
  }

}

export type { InterestSeedSettings };
