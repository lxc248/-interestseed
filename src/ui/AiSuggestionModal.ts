import { Modal, Notice, type App } from 'obsidian';
import type { AiRelationSuggestion } from '../services/ModelProvider';
import { createAiSuggestionRows, type AiSuggestionRow } from './aiSuggestionPresentation';

export interface AiSuggestionModalActions {
  getNodeTitle(id: string): string | null;
  confirm(suggestion: AiRelationSuggestion): Promise<{ ok: boolean; message?: string }>;
  onUndo?(): boolean;
}

/**
 * 一次只呈现一条 AI 建议：
 * 连上 / 换一个 / 先不用。
 * 不展示批量“待确认”列表，写入后提供撤销。
 */
export class AiSuggestionModal extends Modal {
  private rows: AiSuggestionRow[];
  private lastAcceptedRowId: string | null = null;
  private busy = false;

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
    this.titleEl.setText('AI 建议');
    this.render();
  }

  override onClose(): void {
    this.lastAcceptedRowId = null;
    this.busy = false;
    this.contentEl.empty();
  }

  private render(): void {
    this.contentEl.empty();

    if (this.lastAcceptedRowId) this.renderSuccessBar();

    const pending = this.rows.filter((row) => row.status === 'pending');
    if (pending.length === 0) {
      this.contentEl.createEl('p', {
        cls: 'interestseed-ai-single-empty',
        text: this.lastAcceptedRowId
          ? '这条关系已经写入图谱。可以撤销，或关闭窗口。'
          : '没有更多建议了。',
      });
      const actions = this.contentEl.createDiv({ cls: 'interestseed-ai-single-actions' });
      actions.createEl('button', { text: '完成' }).addEventListener('click', () => this.close());
      return;
    }

    const row = pending[0]!;
    const total = this.rows.filter((item) => item.status !== 'ignored').length;
    const position = total - pending.length + 1;
    const meta = this.contentEl.createDiv({ cls: 'interestseed-ai-single-meta' });
    meta.createEl('span', { text: `AI 建议 · ${position} / ${total}` });
    meta.createEl('span', { text: `还有 ${Math.max(0, pending.length - 1)} 条` });

    const card = this.contentEl.createDiv({ cls: 'interestseed-ai-single-card' });
    const head = card.createDiv({ cls: 'interestseed-ai-suggestion-head' });
    head.createEl('strong', {
      text: `${this.actions.getNodeTitle(row.source) ?? '已删除节点'} → ${
        this.actions.getNodeTitle(row.target) ?? '已删除节点'
      }`,
    });
    if (typeof row.confidence === 'number') {
      head.createEl('span', {
        cls: 'interestseed-ai-suggestion-confidence',
        text: `可信度 ${Math.round(row.confidence * 100)}%`,
      });
    }

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

    if (row.reason) {
      card.createEl('p', {
        cls: 'interestseed-ai-suggestion-reason',
        text: `理由：${row.reason.slice(0, 160)}`,
      });
    }

    const actions = card.createDiv({ cls: 'interestseed-ai-single-actions' });
    const connect = actions.createEl('button', {
      cls: 'mod-cta',
      text: this.busy ? '连上中…' : '连上',
      attr: { type: 'button' },
    });
    connect.disabled = this.busy;
    connect.addEventListener('click', () => {
      void this.connect(row);
    });

    const next = actions.createEl('button', { text: '换一个', attr: { type: 'button' } });
    next.disabled = this.busy || pending.length <= 1;
    next.addEventListener('click', () => this.rotate(row));

    const skip = actions.createEl('button', { text: '先不用', attr: { type: 'button' } });
    skip.disabled = this.busy;
    skip.addEventListener('click', () => {
      row.status = 'ignored';
      this.render();
    });

    this.contentEl.createEl('p', {
      cls: 'interestseed-ai-single-footnote',
      text: '连上后才会写入图谱；关系名可以在这之前改。',
    });
  }

  private renderSuccessBar(): void {
    const bar = this.contentEl.createDiv({ cls: 'interestseed-ai-success' });
    const copy = bar.createDiv({ cls: 'interestseed-ai-success-copy' });
    copy.createEl('strong', { text: '已连上这条关系' });
    copy.createEl('span', { text: '图谱已更新，可以撤销。' });
    const actions = bar.createDiv({ cls: 'interestseed-ai-success-actions' });
    actions.createEl('button', { text: '撤销' }).addEventListener('click', () => {
      this.undoLastWrite();
    });
    actions.createEl('button', { text: '完成' }).addEventListener('click', () => this.close());
  }

  private async connect(row: AiSuggestionRow): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.render();
    try {
      const result = await this.actions.confirm({
        source: row.source,
        target: row.target,
        relation: row.relation,
        ...(row.reason ? { reason: row.reason } : {}),
        ...(typeof row.confidence === 'number' ? { confidence: row.confidence } : {}),
      });
      if (result.ok) {
        row.status = 'accepted';
        this.lastAcceptedRowId = row.id;
      } else {
        new Notice(result.message ?? '写入失败，未修改图谱。');
      }
    } catch (error) {
      new Notice(error instanceof Error ? error.message : String(error));
    } finally {
      this.busy = false;
      this.render();
    }
  }

  private rotate(row: AiSuggestionRow): void {
    if (this.busy) return;
    const index = this.rows.indexOf(row);
    if (index >= 0) this.rows.push(this.rows.splice(index, 1)[0]!);
    this.render();
  }

  private undoLastWrite(): void {
    const ok = this.actions.onUndo?.() ?? false;
    if (!ok) {
      new Notice('没有可撤销的图谱操作。');
      return;
    }
    const row = this.rows.find((item) => item.id === this.lastAcceptedRowId);
    if (row) row.status = 'undone';
    this.lastAcceptedRowId = null;
    new Notice('已撤销这次写入，图谱恢复原状。');
    this.render();
  }
}
