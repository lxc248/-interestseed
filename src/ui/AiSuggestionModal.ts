import { Modal, type App } from 'obsidian';
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
}

/**
 * AI 候选关系列表。每一行只代表候选，不写入图谱；
 * 只有用户点击“确认”且正式写入成功后，才显示“已接受”。
 */
export class AiSuggestionModal extends Modal {
  private rows: AiSuggestionRow[];

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
    this.contentEl.empty();
  }

  private render(): void {
    this.contentEl.empty();
    this.contentEl.createEl('p', {
      cls: 'interestseed-ai-suggestion-summary',
      text: this.summary(),
    });

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

  private summary(): string {
    const count = (status: AiSuggestionStatus): number =>
      this.rows.filter((row) => row.status === status).length;
    return `共 ${this.rows.length} 条候选 · 按可信度排序 · 确认后才写入图谱。待确认 ${count(
      'pending',
    )} · 已接受 ${count('accepted')} · 已忽略 ${count('ignored')} · 失败 ${count(
      'failed',
    )} · 已失效 ${count('invalid')}`;
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
    head.createEl('span', {
      cls: 'interestseed-ai-suggestion-confidence',
      text: `${Math.round((row.confidence ?? 0) * 100)}%`,
    });
    card.createEl('p', {
      cls: 'interestseed-ai-suggestion-relation',
      // 模型输出是不可信内容，只作为文本显示；长度在 provider 已限制。
      text: `关系：${row.relation.slice(0, 120)}`,
    });
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
        .confirm({ source: row.source, target: row.target, relation: row.relation })
        .then((result) => {
          if (row.status !== 'confirming') return;
          row.status = result.ok ? 'accepted' : 'failed';
          row.message = result.message;
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
