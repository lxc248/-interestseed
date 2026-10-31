import { ItemView, type WorkspaceLeaf } from 'obsidian';
import type InterestSeedPlugin from '../main';
import type { AiRelationSuggestion } from '../services/ModelProvider';
import { AiSuggestionPanel } from './aiSuggestionPanel';

export const INTERESTSEED_AI_VIEW_TYPE = 'interestseed-ai-view';

/**
 * Obsidian 原生 AI 侧边栏。
 * 图谱选中节点、当前笔记、命令面板都能把建议送进来；
 * 面板常驻，不再用一次性弹窗打断工作流。
 */
export class AiSuggestionView extends ItemView {
  private panel: AiSuggestionPanel | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: InterestSeedPlugin,
  ) {
    super(leaf);
  }

  override getViewType(): string {
    return INTERESTSEED_AI_VIEW_TYPE;
  }

  override getDisplayText(): string {
    return 'AI 建议';
  }

  override getIcon(): string {
    return 'sparkles';
  }

  override async onOpen(): Promise<void> {
    this.contentEl.empty();
    this.contentEl.addClass('interestseed-ai-view');
    this.showEmpty();
  }

  override async onClose(): Promise<void> {
    this.panel = null;
    this.contentEl.empty();
  }

  setSuggestions(suggestions: AiRelationSuggestion[]): void {
    this.contentEl.empty();
    this.panel = new AiSuggestionPanel(this.contentEl, suggestions, {
      getNodeTitle: (id) => this.plugin.store.getNode(id)?.title ?? null,
      confirm: (suggestion) => this.plugin.confirmAiSuggestion(suggestion),
      onUndo: () => this.plugin.undoAiSuggestion(),
      onDone: () => this.showEmpty(),
    });
    this.panel.render();
  }

  showEmpty(): void {
    this.panel = null;
    this.contentEl.empty();

    const header = this.contentEl.createDiv({ cls: 'interestseed-ai-view-header' });
    header.createEl('div', { cls: 'interestseed-ai-model-eyebrow', text: 'LOCAL AI' });
    header.createEl('h3', { text: 'AI 建议' });
    header.createEl('p', {
      text: '从当前笔记或图谱里的选中节点，找到一条最值得验证的连接。一次只给一条。',
    });

    const actions = this.contentEl.createDiv({ cls: 'interestseed-ai-view-actions' });
    actions
      .createEl('button', { cls: 'mod-cta', text: '从当前笔记找连接' })
      .addEventListener('click', () => {
        void this.plugin.suggestForActiveNote();
      });
    actions
      .createEl('button', { text: '从选中节点找连接' })
      .addEventListener('click', () => {
        void this.plugin.suggestForSelectedNode();
      });
    actions
      .createEl('button', { text: '接入设置' })
      .addEventListener('click', () => this.plugin.openAiSetup());

    this.contentEl.createEl('p', {
      cls: 'interestseed-ai-view-note',
      text: '只发送节点 id、标题、标签；Key 存在本机安全存储。',
    });
  }
}
