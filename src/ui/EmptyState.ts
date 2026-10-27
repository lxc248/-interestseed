import { setIcon } from 'obsidian';

export interface EmptyStateAction {
  label: string;
  primary?: boolean;
  onClick(): void;
}

export interface EmptyStateConfig {
  title: string;
  detail: string;
  actions: EmptyStateAction[];
}

/** 空状态：没有数据、没有匹配结果、或首次使用时的引导。 */
export class EmptyState {
  private readonly root: HTMLElement;

  constructor(container: HTMLElement) {
    this.root = container.createDiv({ cls: 'interestseed-empty is-hidden' });
  }

  show(config: EmptyStateConfig): void {
    this.root.empty();

    const icon = this.root.createDiv({ cls: 'interestseed-empty-icon' });
    setIcon(icon, 'sprout');

    this.root.createEl('h3', { cls: 'interestseed-empty-title', text: config.title });
    this.root.createEl('p', { cls: 'interestseed-empty-detail', text: config.detail });

    const actions = this.root.createDiv({ cls: 'interestseed-empty-actions' });
    for (const action of config.actions) {
      const button = actions.createEl('button', {
        cls: action.primary ? 'mod-cta' : '',
        text: action.label,
      });
      button.addEventListener('click', () => action.onClick());
    }

    this.root.removeClass('is-hidden');
  }

  hide(): void {
    this.root.addClass('is-hidden');
  }

  destroy(): void {
    this.root.remove();
  }
}
