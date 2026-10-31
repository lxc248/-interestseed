import { Modal, type App } from 'obsidian';
import type { AiRelationSuggestion } from '../services/ModelProvider';
import { AiSuggestionPanel, type AiSuggestionPanelActions } from './aiSuggestionPanel';

export type AiSuggestionModalActions = AiSuggestionPanelActions;

/** Modal wrapper for environments where the side panel is not used. */
export class AiSuggestionModal extends Modal {
  private panel: AiSuggestionPanel | null = null;

  constructor(
    app: App,
    private readonly suggestions: AiRelationSuggestion[],
    private readonly actions: AiSuggestionModalActions,
  ) {
    super(app);
  }

  override onOpen(): void {
    this.titleEl.setText('AI 建议');
    this.panel = new AiSuggestionPanel(this.contentEl, this.suggestions, {
      ...this.actions,
      onDone: () => this.close(),
    });
    this.panel.render();
  }

  override onClose(): void {
    this.panel = null;
    this.contentEl.empty();
  }
}
