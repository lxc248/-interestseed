import { Notice, PluginSettingTab, Setting } from 'obsidian';
import type { App } from 'obsidian';
import type InterestSeedPlugin from '../main';
import type { InterestSeedSettings } from '../types/graph';
import { DEEPSEEK_V4_PRO_CONFIG } from '../services/ModelProvider';
import { hasClaudianApi } from '../services/ClaudianProvider';
import { confirmAction } from '../ui/ConfirmModal';
import { isRecord, sanitizeTags } from '../utils/validation';

export const DEFAULT_SETTINGS: InterestSeedSettings = {
  autoBuildOnOpen: true,
  includeFolders: [],
  excludeFolders: ['.obsidian', '.trash'],
  includeTags: [],
  enableRuleSuggestions: true,
  enableAI: false,
  aiProvider: 'offline',
  aiConsentGranted: false,
  enableDshAgent: false,
  dshCommand: 'dsh',
  dshProfile: 'acp',
  dshModel: 'deepseek-account/deepseek-flash',
};

export function normalizeSettings(raw: unknown): InterestSeedSettings {
  const source = isRecord(raw) ? raw : {};
  return {
    autoBuildOnOpen:
      typeof source.autoBuildOnOpen === 'boolean'
        ? source.autoBuildOnOpen
        : DEFAULT_SETTINGS.autoBuildOnOpen,
    includeFolders: sanitizeFolders(source.includeFolders),
    excludeFolders:
      source.excludeFolders === undefined
        ? [...DEFAULT_SETTINGS.excludeFolders]
        : sanitizeFolders(source.excludeFolders),
    includeTags: sanitizeTags(source.includeTags),
    enableRuleSuggestions:
      typeof source.enableRuleSuggestions === 'boolean'
        ? source.enableRuleSuggestions
        : DEFAULT_SETTINGS.enableRuleSuggestions,
    enableAI:
      typeof source.enableAI === 'boolean' ? source.enableAI : DEFAULT_SETTINGS.enableAI,
    aiProvider:
      typeof source.aiProvider === 'string' && source.aiProvider.trim()
        ? source.aiProvider.trim()
        : DEFAULT_SETTINGS.aiProvider,
    aiConsentGranted:
      typeof source.aiConsentGranted === 'boolean'
        ? source.aiConsentGranted
        : DEFAULT_SETTINGS.aiConsentGranted,
    enableDshAgent:
      typeof source.enableDshAgent === 'boolean'
        ? source.enableDshAgent
        : DEFAULT_SETTINGS.enableDshAgent,
    dshCommand:
      typeof source.dshCommand === 'string' && source.dshCommand.trim()
        ? source.dshCommand.trim()
        : DEFAULT_SETTINGS.dshCommand,
    dshProfile:
      typeof source.dshProfile === 'string' && source.dshProfile.trim()
        ? source.dshProfile.trim()
        : DEFAULT_SETTINGS.dshProfile,
    dshModel:
      typeof source.dshModel === 'string' && source.dshModel.trim()
        ? source.dshModel.trim()
        : DEFAULT_SETTINGS.dshModel,
  };
}

function sanitizeFolders(input: unknown): string[] {
  const source = Array.isArray(input)
    ? input
    : typeof input === 'string'
      ? input.split(/[\n,，]+/)
      : [];
  const seen = new Set<string>();
  const folders: string[] = [];
  for (const entry of source) {
    if (typeof entry !== 'string') continue;
    const folder = entry.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').trim();
    if (!folder || seen.has(folder)) continue;
    seen.add(folder);
    folders.push(folder);
  }
  return folders;
}

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
    this.renderAISettings(containerEl);
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
          .setPlaceholder('deepseek-account/deepseek-flash')
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
  private renderAISettings(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: 'AI（实验，默认关闭）' });
    containerEl.createEl('p', {
      cls: 'setting-item-description',
      text: 'Obsidian 核心没有公开的原生生成式 AI API；这里支持两种可选后端：本地 OpenAI-compatible 服务，或已安装并启用的 Claudian 插件 API。',
    });
    containerEl.createEl('p', {
      cls: 'setting-item-description',
      text: `本地后端：${DEEPSEEK_V4_PRO_CONFIG.displayName} / ${DEEPSEEK_V4_PRO_CONFIG.model} / ${DEEPSEEK_V4_PRO_CONFIG.baseUrl}。API Key 从现有本地环境复用，不在此输入、保存或显示。Claudian 后端使用其 v1 实验 API，需先在 Claudian 打开一个会话。`,
    });
    containerEl.createEl('p', {
      cls: 'setting-item-description',
      text: '只发送匿名化主题/项目别名、聚合计数和活动数据；不会发送笔记正文、路径、摘要或完整 Vault。调用失败不会自动重试或切换模型，本地规则发现继续可用。',
    });

    new Setting(containerEl)
      .setName('启用实验 AI')
      .setDesc('默认关闭。关闭时 ModelProvider 始终为禁用实现，不发起网络请求。')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.enableAI).onChange(async (value) => {
          this.plugin.settings.enableAI = value;
          if (!value) {
            this.plugin.settings.aiProvider = 'offline';
            this.plugin.settings.aiConsentGranted = false;
          } else if (this.plugin.settings.aiProvider !== 'claudian') {
            this.plugin.settings.aiProvider = DEEPSEEK_V4_PRO_CONFIG.model;
          }
          await this.plugin.saveSettings();
          this.display();
        }),
      );

    new Setting(containerEl)
      .setName('AI 运行后端')
      .setDesc(
        hasClaudianApi(this.app)
          ? '检测到 Claudian，可选择用它的当前会话来解释探索数据。'
          : '未检测到 Claudian；仍可使用本地 OpenAI-compatible 服务。',
      )
      .addDropdown((dropdown) =>
        dropdown
          .addOption('local', '本地 OpenAI-compatible')
          .addOption('claudian', 'Claudian 插件 API（实验）')
          .setValue(this.plugin.settings.aiProvider === 'claudian' ? 'claudian' : 'local')
          .setDisabled(!this.plugin.settings.enableAI)
          .onChange(async (value) => {
            this.plugin.settings.aiProvider =
              value === 'claudian' ? 'claudian' : DEEPSEEK_V4_PRO_CONFIG.model;
            await this.plugin.saveSettings();
            this.display();
          }),
      );

    new Setting(containerEl)
      .setName('确认 AI 数据发送边界')
      .setDesc('必须同时开启此项，实验 AI 才会读取本地服务并发送节点 id、标题、标签。')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.aiConsentGranted)
          .setDisabled(!this.plugin.settings.enableAI)
          .onChange(async (value) => {
            this.plugin.settings.aiConsentGranted = value;
            await this.plugin.saveSettings();
            this.display();
          }),
      );
  }
}

export type { InterestSeedSettings };
