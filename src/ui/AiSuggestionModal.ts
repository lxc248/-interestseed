import { Modal, Notice, type App } from 'obsidian';
import type { AiRelationSuggestion } from '../services/ModelProvider';
import {
  AI_SUGGESTION_STATUS_LABELS,
  createAiSuggestionRows,
  type AiSuggestionRow,
  type AiSuggestionStatus,
} from './aiSuggestionPresentation';

export interface AiSuggestionModalActions {
  getNodeTitle(id: string): string | null;
  confirm(suggestion: AiRelationSuggestion): Promise<{ ok: boolean; message?: string }>;
  onUndo?(): boolean;
}

/**
 * AI 候选关系列表。每一行只代表候选，不写入图谱；
 * 只有用户点击“确认”且正式写入成功后，才显示“已接受”。
 * 写入后提供“撤销这次写入”，避免弹窗留下无法解释的“已接受”状态。
 */
export class AiSuggestionModal extends Modal {
  private rows: AiSuggestionRow[];
  private lastAcceptedRowId: string | null = null;

  constructor(
    app: App,
    suggestions: AiRelationSuggestion[],
    private readonly actions: AiSuggestionModalActions,
  ) {
    super(app);
    this.rows = createAiSuggestionRows(
      [...suggestions].sort((left, right) => (right.confidence ?? 0) - (left.confidence ?? 0)),
      (id) => actions.getNodeTitle(id),
    );
  }

  override onOpen(): void {
    this.titleEl.setText('AI 关系建议');
    this.render();
  }

  override onClose(): void {
    this.lastAcceptedRowId = null;
    this.contentEl.empty();
  }

  private render(): void {
    this.contentEl.empty();

    if (this.lastAcceptedRowId) this.renderWriteBanner();

    this.contentEl.createEl('p', {
      cls: 'interestseed-ai-suggestion-summary',
      text: this.summary(),
    });

    if (this.rows.some((row) => row.status === 'pending' && typeof row.confidence !== 'number')) {
      this.contentEl.createEl('p', {
        cls: 'interestseed-ai-suggestion-note',
        text: '模型没有返回置信度；候选按返回顺序展示，关系名可以在确认前改。',
      });
    }

    if (this.rows.length === 0) {
      this.contentEl.createEl('p', {
        cls: 'interestseed-ai-suggestion-empty',
        text: '模型没有返回任何候选关系。',
      });
      return;
    }

    const list = this.contentEl.createDiv({ cls: 'interestseed-ai-suggestion-list' });
    for (const row of this.rows) {
      this.renderRow(list, row);
    }
  }

  private renderWriteBanner(): void {
    const banner = this.contentEl.createDiv({ cls: 'interestseed-ai-suggestion-banner' });
    const text = banner.createDiv({ cls: 'interestseed-ai-suggestion-banner-text' });
    text.createEl('strong', { text: '已写入 1 条 AI 关系' });
    text.createEl('span', { text: '可以现在撤销，或关闭后在图谱里撤销。' });
    const actions = banner.createDiv({ cls: 'interestseed-ai-suggestion-banner-actions' });
    actions.createEl('button', { text: '撤销这次写入' }).addEventListener('click', () => {
      this.undoLastWrite();
    });
    actions.createEl('button', { text: '完成' }).addEventListener('click', () => this.close());
  }

  private undoLastWrite(): void {
    const ok = this.actions.onUndo?.() ?? false;
    if (!ok) {
      new Notice('没有可撤销的图谱操作。');
      return;
    }
    const row = this.rows.find((item) => item.id === this.lastAcceptedRowId);
    if (row) {
      row.status = 'undone';
      row.message = '已撤销这次写入，图谱恢复原状。';
    }
    this.lastAcceptedRowId = null;
    this.render();
  }

  private summary(): string {
    const count = (status: AiSuggestionStatus): number =>
      this.rows.filter((row) => row.status === status).length;
    return `共 ${this.rows.length} 条候选 · 确认后才写入图谱。待确认 ${count(
      'pending',
    )} · 已接受 ${count('accepted')} · 已撤销 ${count('undone')} · 已忽略 ${count(
      'ignored',
    )} · 失败 ${count('failed')} · 已失效 ${count('invalid')}`;
  }

  private renderRow(parent: HTMLElement, row: AiSuggestionRow): void {
    const card = parent.createDiv({ cls: 'interestseed-ai-suggestion-card' });
    card.setAttr('data-ai-suggestion-id', row.id);

    const source = this.actions.getNodeTitle(row.source);
    const target = this.actions.getNodeTitle(row.target);
    const head = card.createDiv({ cls: 'interestseed-ai-suggestion-head' });
    head.createEl('strong', {
      text: `${source ?? '已删除节点'} → ${target ?? '已删除节点'}`,
    });
    if (typeof row.confidence === 'number') {
      head.createEl('span', {
        cls: 'interestseed-ai-suggestion-confidence',
        text: `${Math.round(row.confidence * 100)}%`,
      });
    }

    if (row.status === 'pending') {
      const relationRow = card.createDiv({ cls: 'interestseed-ai-suggestion-relation-row' });
      relationRow.createEl('label', { text: '关系名' });
      const input = relationRow.createEl('input', {
        cls: 'interestseed-ai-suggestion-relation-input',
        attr: { type: 'text', maxlength: '120' },
      });
      input.value = row.relation.slice(0, 120);
      input.addEventListener('change', () => {
        const value = input.value.trim();
        if (value) row.relation = value.slice(0, 120);
        else input.value = row.relation;
      });
    } else {
      card.createEl('p', {
        cls: 'interestseed-ai-suggestion-relation',
        // 模型输出是不可信内容，只作为文本显示；长度在 provider 已限制。
        text: `关系：${row.relation.slice(0, 120)}`,
      });
    }

    if (row.reason) {
      card.createEl('p', {
        cls: 'interestseed-ai-suggestion-reason',
        text: `理由：${row.reason.slice(0, 160)}`,
      });
    }
    card.createEl('span', {
      cls: `interestseed-ai-suggestion-status ${row.status}`,
      text: AI_SUGGESTION_STATUS_LABELS[row.status],
    });
    if (row.message) {
      card.createEl('p', {
        cls: 'interestseed-ai-suggestion-message',
        text: row.message,
      });
    }

    if (row.status !== 'pending') return;

    const actions = card.createDiv({ cls: 'interestseed-ai-suggestion-actions' });
    const confirm = actions.createEl('button', { text: '确认' });
    confirm.addEventListener('click', () => {
      if (row.status !== 'pending') return;
      row.status = 'confirming';
      row.message = undefined;
      this.render();
      void this.actions
        .confirm({
          source: row.source,
          target: row.target,
          relation: row.relation,
          ...(row.reason ? { reason: row.reason } : {}),
          ...(typeof row.confidence === 'number' ? { confidence: row.confidence } : {}),
        })
        .then((result) => {
          if (row.status !== 'confirming') return;
          row.status = result.ok ? 'accepted' : 'failed';
          row.message = result.message;
          if (result.ok) this.lastAcceptedRowId = row.id;
          this.render();
        })
        .catch((error: unknown) => {
          if (row.status !== 'confirming') return;
          row.status = 'failed';
          row.message = error instanceof Error ? error.message : String(error);
          this.render();
        });
    });

    const ignore = actions.createEl('button', { text: '忽略' });
    ignore.addEventListener('click', () => {
      if (row.status !== 'pending') return;
      row.status = 'ignored';
      row.message = '仅忽略本条建议，未修改图谱。';
      this.render();
    });
  }
}
