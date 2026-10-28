import { ItemView, MarkdownRenderer, setIcon } from 'obsidian';
import type { WorkspaceLeaf } from 'obsidian';
import type { existsSync } from 'node:fs';

import type InterestSeedPlugin from '../main';
import {
  DshAcpClient,
  type DshAgentEvent,
  type DshPermissionRequest,
} from '../agent/DshAcpClient';
import { QwenChatClient, type QwenChatMessage } from '../agent/QwenChatClient';
import {
  QWEN_CONFIG,
} from '../services/ModelProvider';

export const INTERESTSEED_AGENT_VIEW_TYPE = 'interestseed-agent-view';

/**
 * Embedded DSH agent workspace.
 *
 * The conversation surface belongs to InterestSeed; the agent, model, tools,
 * sandbox and approvals belong to DSH. No model key is stored here.
 */
export class AgentView extends ItemView {
  private client: DshAcpClient | null = null;
  private qwenClient: QwenChatClient | null = null;
  private qwenMessages: QwenChatMessage[] = [];
  private transcript: HTMLElement | null = null;
  private composer: HTMLTextAreaElement | null = null;
  private sendButton: HTMLButtonElement | null = null;
  private stopButton: HTMLButtonElement | null = null;
  private statusEl: HTMLElement | null = null;
  private permissionHost: HTMLElement | null = null;
  private streamEl: HTMLElement | null = null;
  private streamText = '';
  private busy = false;
  private disposed = false;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: InterestSeedPlugin,
  ) {
    super(leaf);
  }

  override getViewType(): string {
    return INTERESTSEED_AGENT_VIEW_TYPE;
  }

  override getDisplayText(): string {
    return 'InterestSeed Agent';
  }

  override getIcon(): string {
    return 'sparkles';
  }

  override async onOpen(): Promise<void> {
    this.contentEl.empty();
    this.contentEl.addClass('interestseed-agent-root');
    this.renderHeader();
    this.renderTranscript();
    this.renderComposer();
    if (this.isQwen()) {
      this.setStatus(
        this.plugin.getAiApiKey() ? 'idle' : 'warning',
        this.plugin.getAiApiKey() ? '千问已就绪' : '未配置千问密钥',
      );
    } else if (!this.plugin.settings.enableDshAgent) {
      this.renderSetup();
    } else {
      this.setStatus('idle', 'DSH Agent 已启用');
    }
    // Obsidian may restore the agent leaf before loadData() finishes.
    window.setTimeout(() => {
      if (!this.disposed) this.refreshMode();
    }, 250);
    const modeTimer = window.setInterval(() => {
      if (this.disposed || this.isQwen()) {
        window.clearInterval(modeTimer);
        if (!this.disposed) this.refreshMode();
      }
    }, 500);
    window.setTimeout(() => window.clearInterval(modeTimer), 10_000);
  }

  private refreshMode(): void {
    const qwen = this.isQwen();
    this.syncModeButtons();
    const subtitle = this.contentEl.querySelector('.interestseed-agent-subtitle');
    if (subtitle instanceof HTMLElement) {
      subtitle.setText(
        qwen
          ? '千问 DashScope · 直接对话 · 不执行本地工具'
          : 'DSH 运行时 · 工具、沙箱与权限由 Harness 管理',
      );
    }
    if (this.composer) {
      this.composer.placeholder = qwen
        ? '问千问任何关于兴趣、项目或下一步的问题…'
        : '问 DSH 任何关于你 Vault 的问题…';
      this.composer.setAttribute(
        'aria-label',
        qwen ? '给千问的消息' : '给 DSH Agent 的消息',
      );
    }
    if (qwen) {
      this.permissionHost?.empty();
      this.transcript?.empty();
      this.renderEmptyState();
      this.setStatus(
        this.plugin.getAiApiKey() ? 'idle' : 'warning',
        this.plugin.getAiApiKey() ? '千问已就绪' : '未配置千问密钥',
      );
    } else if (!this.plugin.settings.enableDshAgent) {
      this.renderSetup();
      this.setStatus('closed', 'DSH Agent 未启用');
    } else {
      this.setStatus('idle', 'DSH Agent 已启用');
    }
  }

  private isQwen(): boolean {
    return this.plugin.settings.agentMode !== 'dsh';
  }

  private syncModeButtons(): void {
    for (const button of Array.from(
      this.contentEl.querySelectorAll<HTMLElement>('.interestseed-agent-mode-button'),
    )) {
      const active = button.dataset.mode === this.plugin.settings.agentMode;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    }
  }

  override async onClose(): Promise<void> {
    this.disposed = true;
    await this.client?.dispose();
    this.qwenClient?.dispose();
    this.client = null;
    this.qwenClient = null;
    this.contentEl.empty();
  }

  private renderHeader(): void {
    const header = this.contentEl.createDiv({ cls: 'interestseed-agent-header' });
    const identity = header.createDiv({ cls: 'interestseed-agent-identity' });
    const icon = identity.createDiv({ cls: 'interestseed-agent-icon' });
    setIcon(icon, 'sparkles');
    const copy = identity.createDiv();
    copy.createDiv({ cls: 'interestseed-agent-title', text: 'InterestSeed Agent' });
    copy.createDiv({
      cls: 'interestseed-agent-subtitle',
      text: this.isQwen()
        ? '千问 DashScope · 直接对话 · 不执行本地工具'
        : 'DSH 运行时 · 工具、沙箱与权限由 Harness 管理',
    });

    this.statusEl = header.createDiv({ cls: 'interestseed-agent-status is-idle' });
    this.statusEl.createSpan({ cls: 'interestseed-agent-status-dot' });
    this.statusEl.createSpan({ text: '未连接' });

    const actions = header.createDiv({ cls: 'interestseed-agent-header-actions' });
    const newChat = actions.createEl('button', {
      cls: 'interestseed-agent-icon-button',
      attr: { type: 'button', 'aria-label': '新建会话' },
    });
    setIcon(newChat, 'plus');
    newChat.addEventListener('click', () => void this.resetSession());
  }

  private renderTranscript(): void {
    const scroll = this.contentEl.createDiv({ cls: 'interestseed-agent-scroll' });
    this.transcript = scroll.createDiv({ cls: 'interestseed-agent-transcript' });
    this.permissionHost = scroll.createDiv({ cls: 'interestseed-agent-permission-host' });
    this.renderEmptyState();
  }

  private renderEmptyState(): void {
    if (!this.transcript || this.transcript.childElementCount > 0) return;
    const empty = this.transcript.createDiv({ cls: 'interestseed-agent-empty' });
    const mark = empty.createDiv({ cls: 'interestseed-agent-empty-mark' });
    setIcon(mark, 'sparkles');
    empty.createEl('h4', { text: '从一个问题开始' });
    empty.createEl('p', {
      text: this.isQwen()
        ? '直接连接千问，把模糊兴趣变成可执行的下一步；不读取 Vault，不执行工具。'
        : '让 DSH 读取你的 Vault、搜索相关笔记，或把一个模糊的兴趣变成下一步行动。',
    });
    const suggestions = empty.createDiv({ cls: 'interestseed-agent-suggestions' });
    for (const text of [
      '总结我最近在关注的三个主题',
      '找出跨项目重复出现的概念',
      '把这个兴趣拆成这周能做的三步',
    ]) {
      const button = suggestions.createEl('button', {
        cls: 'interestseed-agent-suggestion',
        text,
        attr: { type: 'button' },
      });
      button.addEventListener('click', () => {
        if (!this.composer) return;
        this.composer.value = text;
        this.composer.focus();
      });
    }
  }

  private renderComposer(): void {
    const footer = this.contentEl.createDiv({ cls: 'interestseed-agent-composer-wrap' });
    const box = footer.createDiv({ cls: 'interestseed-agent-composer' });
    this.composer = box.createEl('textarea', {
      cls: 'interestseed-agent-input',
      attr: {
        placeholder: this.isQwen()
          ? '问千问任何关于兴趣、项目或下一步的问题…'
          : '问 DSH 任何关于你 Vault 的问题…',
        rows: '3',
        'aria-label': this.isQwen() ? '给千问的消息' : '给 DSH Agent 的消息',
      },
    });
    this.composer.addEventListener('keydown', (event) => {
      if (event.isComposing) return;
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        void this.send();
      }
    });

    const toolbar = box.createDiv({ cls: 'interestseed-agent-toolbar' });
    const hint = toolbar.createSpan({
      cls: 'interestseed-agent-hint',
      text: 'Enter 发送 · Shift+Enter 换行',
    });
    hint.setAttribute('aria-hidden', 'true');
    const actions = toolbar.createDiv({ cls: 'interestseed-agent-send-actions' });
    this.stopButton = actions.createEl('button', {
      cls: 'interestseed-agent-stop',
      text: '停止',
      attr: { type: 'button' },
    });
    this.stopButton.disabled = true;
    this.stopButton.addEventListener('click', () => void this.stop());
    this.sendButton = actions.createEl('button', {
      cls: 'interestseed-agent-send',
      attr: { type: 'button', 'aria-label': '发送给 DSH Agent' },
    });
    setIcon(this.sendButton, 'arrow-up');
    this.sendButton.addEventListener('click', () => void this.send());
    this.updateSendState();
  }

  private renderSetup(): void {
    if (!this.transcript) return;
    this.transcript.empty();
    const setup = this.transcript.createDiv({ cls: 'interestseed-agent-setup' });
    const mark = setup.createDiv({ cls: 'interestseed-agent-setup-mark' });
    setIcon(mark, 'terminal');
    setup.createEl('h4', { text: 'DSH Agent 还没有启用' });
    setup.createEl('p', {
      text: 'InterestSeed 通过 DSH 的 ACP profile 启动 Agent。请先在设置里启用 DSH Agent，并确认 DSH 命令路径。',
    });
    const actions = setup.createDiv({ cls: 'interestseed-agent-setup-actions' });
    const openSettings = actions.createEl('button', {
      cls: 'interestseed-modal-button is-primary',
      text: '打开设置',
      attr: { type: 'button' },
    });
    openSettings.addEventListener('click', () => {
      const setting = (this.app as unknown as {
        setting?: { open(): void; openTabById(id: string): void };
      }).setting;
      setting?.open();
      setting?.openTabById(this.plugin.manifest.id);
    });
  }

  private async ensureClient(): Promise<DshAcpClient> {
    if (this.client?.isRunning) return this.client;
    if (!this.plugin.settings.enableDshAgent) {
      throw new Error('DSH Agent 未启用；请先在 InterestSeed 设置中启用。');
    }
    const adapter = this.app.vault.adapter as unknown as { getBasePath?: () => string };
    const cwd = adapter.getBasePath?.() ?? '';
    this.client = new DshAcpClient({
      command: await this.resolveDshCommand(),
      profile: this.plugin.settings.dshProfile || 'acp',
      model: this.plugin.settings.dshModel,
      cwd,
      onEvent: (event) => this.handleEvent(event),
    });
    await this.client.start();
    return this.client;
  }

  private async resolveDshCommand(): Promise<string> {
    const configured = this.plugin.settings.dshCommand.trim();
    if (configured && configured !== 'dsh') return configured;
    const envCommand = (globalThis as { process?: { env?: Record<string, string> } }).process?.env?.DSH_COMMAND;
    if (envCommand) return envCommand;
    if ((globalThis as { process?: { platform?: string } }).process?.platform === 'win32') {
      const candidates = ['D:\\dsh\\resources\\runtime\\cli\\bin\\dsh.cmd'];
      // Obsidian desktop plugins are CJS; dynamic import('node:fs') fails in the renderer.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('fs') as { existsSync: typeof existsSync };
      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) return candidate;
      }
    }
    return configured || 'dsh';
  }

  private async send(): Promise<void> {
    const text = this.composer?.value.trim() ?? '';
    if (!text || this.busy) return;
    if (this.composer) this.composer.value = '';
    this.busy = true;
    this.updateSendState();
    this.appendUser(text);
    this.streamEl = null;
    this.streamText = '';
    try {
      if (this.isQwen()) {
        await this.sendQwen(text);
      } else {
        const client = await this.ensureClient();
        await client.prompt(text);
      }
      if (this.streamEl) await this.renderFinalMarkdown(this.streamEl, this.streamText);
      this.setStatus('idle', '待命');
    } catch (error) {
      this.appendError(error instanceof Error ? error.message : String(error));
      this.setStatus('closed', this.isQwen() ? '千问请求失败' : '连接中断');
    } finally {
      this.busy = false;
      this.updateSendState();
      this.streamEl = null;
    }
  }

  private async sendQwen(text: string): Promise<void> {
    if (!this.qwenMessages.length) {
      this.qwenMessages.push({
        role: 'system',
        content:
          '你是 InterestSeed 的兴趣探索助手。请用简体中文回答，' +
          '帮助用户把模糊兴趣拆成具体、可验证的下一步。' +
          '你不知道用户的 Vault 内容，也不能声称读取了笔记或执行了工具；' +
          '信息不足时先提出一个简短澄清问题。',
      });
    }
    this.qwenMessages.push({ role: 'user', content: text });
    this.qwenClient ??= new QwenChatClient(
      {
        ...QWEN_CONFIG,
        baseUrl: this.plugin.settings.aiBaseUrl.trim() || QWEN_CONFIG.baseUrl,
        model: this.plugin.settings.aiModel.trim() || QWEN_CONFIG.model,
      },
      this.plugin.getAiApiKey(),
    );
    this.setStatus('working', '千问正在回答');
    const answer = await this.qwenClient.complete(this.qwenMessages);
    this.qwenMessages.push({ role: 'assistant', content: answer });
    this.appendAssistantDelta(answer);
  }

  private async stop(): Promise<void> {
    if (this.isQwen()) {
      this.qwenClient?.cancel();
    } else {
      await this.client?.cancel();
    }
    this.busy = false;
    this.updateSendState();
    this.setStatus('idle', '已请求停止');
  }

  private async resetSession(): Promise<void> {
    await this.client?.dispose();
    this.qwenClient?.dispose();
    this.client = null;
    this.qwenClient = null;
    this.qwenMessages = [];
    this.streamEl = null;
    this.streamText = '';
    this.permissionHost?.empty();
    this.transcript?.empty();
    this.renderEmptyState();
    this.setStatus(
      this.isQwen() && !this.plugin.getAiApiKey() ? 'warning' : 'idle',
      this.isQwen()
        ? this.plugin.getAiApiKey()
          ? '千问已就绪'
          : '未配置千问密钥'
        : '新会话',
    );
  }

  private handleEvent(event: DshAgentEvent): void {
    if (this.disposed) return;
    switch (event.type) {
      case 'status':
        this.setStatus(event.status, event.detail ?? event.status);
        break;
      case 'message':
        this.appendAssistantDelta(event.text);
        break;
      case 'thought':
        this.appendThought(event.text);
        break;
      case 'tool':
        this.appendTool(event.id, event.title, event.kind, event.status);
        break;
      case 'permission':
        this.appendPermission(event.request);
        break;
      case 'error':
        this.appendError(event.message);
        this.setStatus('closed', '错误');
        break;
    }
  }

  private appendUser(text: string): void {
    if (!this.transcript) return;
    this.transcript.createDiv({ cls: 'interestseed-agent-msg is-user', text });
    this.scrollToBottom();
  }

  private appendAssistantDelta(text: string): void {
    if (!this.transcript) return;
    if (!this.streamEl) {
      this.streamEl = this.transcript.createDiv({ cls: 'interestseed-agent-msg is-assistant is-streaming' });
      this.streamEl.setText('');
    }
    this.streamText += text;
    this.streamEl.setText(this.streamText);
    this.scrollToBottom();
  }

  private appendThought(text: string): void {
    if (!this.transcript) return;
    const details = this.transcript.createEl('details', { cls: 'interestseed-agent-thought' });
    details.createEl('summary', { text: '思考过程' });
    details.createEl('div', { text });
    this.scrollToBottom();
  }

  private appendTool(id: string, title: string, kind: string, status: string): void {
    if (!this.transcript) return;
    const card = this.transcript.createDiv({ cls: 'interestseed-agent-tool' });
    card.dataset.toolId = id;
    const head = card.createDiv({ cls: 'interestseed-agent-tool-head' });
    const icon = head.createSpan({ cls: 'interestseed-agent-tool-icon' });
    setIcon(icon, kind === 'execute' ? 'terminal' : kind === 'edit' ? 'pencil' : 'wrench');
    head.createSpan({ cls: 'interestseed-agent-tool-title', text: title });
    head.createSpan({ cls: `interestseed-agent-tool-status is-${status}`, text: status });
    this.scrollToBottom();
  }

  private appendPermission(request: DshPermissionRequest): void {
    if (!this.permissionHost) return;
    const card = this.permissionHost.createDiv({ cls: 'interestseed-agent-permission' });
    card.createDiv({ cls: 'interestseed-agent-permission-kicker', text: 'DSH 请求权限' });
    card.createEl('h4', { text: request.title });
    card.createDiv({ cls: 'interestseed-agent-permission-kind', text: `类型：${request.kind}` });
    const actions = card.createDiv({ cls: 'interestseed-agent-permission-actions' });
    for (const option of request.options) {
      const button = actions.createEl('button', {
        cls: option.kind.startsWith('allow') ? 'interestseed-modal-button is-primary' : 'interestseed-modal-button',
        text: option.name,
        attr: { type: 'button' },
      });
      button.addEventListener('click', () => {
        this.client?.respondPermission(request.requestId, option.optionId);
        card.remove();
      });
    }
    const reject = actions.createEl('button', {
      cls: 'interestseed-modal-button',
      text: '拒绝',
      attr: { type: 'button' },
    });
    reject.addEventListener('click', () => {
      this.client?.respondPermission(request.requestId, null);
      card.remove();
    });
    this.scrollToBottom();
  }

  private appendError(message: string): void {
    if (!this.transcript) return;
    this.transcript.createDiv({ cls: 'interestseed-agent-error', text: message });
    this.scrollToBottom();
  }

  private async renderFinalMarkdown(el: HTMLElement, text: string): Promise<void> {
    if (!text.trim()) return;
    el.empty();
    el.removeClass('is-streaming');
    try {
      await MarkdownRenderer.render(this.app, text, el, '', this);
    } catch {
      el.setText(text);
    }
  }

  private setStatus(status: string, detail: string): void {
    if (!this.statusEl) return;
    this.statusEl.className = `interestseed-agent-status is-${status}`;
    this.statusEl.empty();
    this.statusEl.createSpan({ cls: 'interestseed-agent-status-dot' });
    this.statusEl.createSpan({ text: detail });
    this.statusEl.setAttribute('title', detail);
  }

  private updateSendState(): void {
    if (this.sendButton) this.sendButton.disabled = this.busy;
    if (this.stopButton) this.stopButton.disabled = !this.busy;
  }

  private scrollToBottom(): void {
    const scroller = this.transcript?.parentElement;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }
}
