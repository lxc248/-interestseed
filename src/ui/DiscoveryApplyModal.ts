import { Modal, Notice } from 'obsidian';
import type { App } from 'obsidian';

import type {
  DiscoveryApplicationDraft,
  DiscoveryApplicationPreview,
  DiscoveryApplicationResult,
} from '../discovery/application';
import type { Discovery } from '../discovery/types';
import { discoveryApplicationDefaults } from '../discovery/applicationDefaults';
import type { InterestSeedNode } from '../types/graph';

export interface DiscoveryApplyModalDeps {
  nodes: InterestSeedNode[];
  preview(draft: DiscoveryApplicationDraft): DiscoveryApplicationPreview;
  apply(draft: DiscoveryApplicationDraft): Promise<DiscoveryApplicationResult>;
  onFinished(result: DiscoveryApplicationResult): void;
}

/** 独立的应用到图谱确认界面；不直接写图谱。 */
export class DiscoveryApplyModal extends Modal {
  private sourceSelect!: HTMLSelectElement;
  private targetSelect!: HTMLSelectElement;
  private relationInput!: HTMLInputElement;
  private conflictCheckbox!: HTMLInputElement;
  private statusEl!: HTMLElement;
  private submitButton!: HTMLButtonElement;
  private conflictBox!: HTMLElement;
  private submitted = false;

  constructor(
    app: App,
    private readonly discovery: Discovery,
    private readonly deps: DiscoveryApplyModalDeps,
  ) {
    super(app);
  }

  override onOpen(): void {
    this.titleEl.setText('将发现应用到图谱');
    this.contentEl.empty();
    this.contentEl.addClass('interestseed-apply-modal');

    this.contentEl.createEl('p', {
      cls: 'interestseed-apply-intro',
      text: '这会创建一条 confirmed 图谱关系。发现本身只提供线索，源、目标、方向和关系名必须由你明确确认。',
    });

    const card = this.contentEl.createDiv({ cls: 'interestseed-apply-card' });
    card.createDiv({ cls: 'interestseed-apply-title', text: this.discovery.title });
    card.createEl('p', { text: this.discovery.description });

    const meta = card.createDiv({ cls: 'interestseed-apply-meta' });
    meta.createSpan({ text: `推定项目：${this.discovery.projectKeys.join('、')}` });
    meta.createSpan({ text: '这些只是路径推定，不是正式项目实体。' });

    const form = this.contentEl.createDiv({ cls: 'interestseed-apply-form' });
    const candidates = this.deps.nodes.filter((node) =>
      this.discovery.nodeIds.includes(node.id),
    );
    const defaults = discoveryApplicationDefaults(this.discovery);
    form.createEl('label', { text: '源节点' });
    this.sourceSelect = form.createEl('select');
    for (const node of candidates) {
      this.sourceSelect.createEl('option', {
        value: node.id,
        text: `${node.title}（${node.sourceUri ?? '无来源'}）`,
      });
    }
    this.sourceSelect.value = defaults.sourceNodeId;

    const direction = form.createDiv({ cls: 'interestseed-apply-direction' });
    direction.createSpan({ text: '方向：源节点 → 目标节点' });
    const swap = direction.createEl('button', {
      text: '交换方向',
      cls: 'interestseed-modal-button',
      attr: { type: 'button' },
    });
    swap.addEventListener('click', () => {
      const source = this.sourceSelect.value;
      this.sourceSelect.value = this.targetSelect.value;
      this.targetSelect.value = source;
      this.refreshPreview();
    });

    form.createEl('label', { text: '目标节点' });
    this.targetSelect = form.createEl('select');
    for (const node of candidates) {
      this.targetSelect.createEl('option', {
        value: node.id,
        text: `${node.title}（${node.sourceUri ?? '无来源'}）`,
      });
    }
    this.targetSelect.value = defaults.targetNodeId;

    form.createEl('label', { text: '关系名称（必须填写）' });
    this.relationInput = form.createEl('input', {
      type: 'text',
      placeholder: '例如：相关项目、方法来源',
    });
    this.relationInput.value = defaults.relation;
    form.createEl('p', {
      cls: 'interestseed-apply-default-hint',
      text: '关系名称和方向是产品预填默认值，不代表事实或用户确认；请核对后修改或保留。',
    });

    this.conflictBox = this.contentEl.createDiv({
      cls: 'interestseed-apply-conflicts',
    });
    this.conflictCheckbox = this.conflictBox.createEl('input', { type: 'checkbox' });
    this.conflictBox.createEl('label', {
      text: '我确认在已有关系之外创建这条不同关系',
    });
    this.conflictCheckbox.addEventListener('change', () => this.refreshPreview());

    const evidence = this.contentEl.createDiv({ cls: 'interestseed-apply-evidence' });
    evidence.createEl('strong', { text: '相关证据' });
    for (const item of this.discovery.evidence) {
      evidence.createDiv({ cls: 'interestseed-evidence', text: item.text });
    }

    this.statusEl = this.contentEl.createDiv({
      cls: 'interestseed-apply-status',
      text: '请选择源、目标并填写关系名称。',
    });

    const actions = this.contentEl.createDiv({ cls: 'interestseed-apply-actions' });
    const cancel = actions.createEl('button', {
      text: '取消',
      cls: 'interestseed-modal-button',
    });
    cancel.addEventListener('click', () => this.close());
    this.submitButton = actions.createEl('button', {
      text: '确认写入图谱',
      cls: 'interestseed-modal-button is-primary',
    });
    this.submitButton.addEventListener('click', () => void this.submit());

    this.sourceSelect.addEventListener('change', () => this.refreshPreview());
    this.targetSelect.addEventListener('change', () => this.refreshPreview());
    this.relationInput.addEventListener('input', () => this.refreshPreview());
    this.refreshPreview();
  }

  override onClose(): void {
    this.contentEl.empty();
  }

  private draft(): DiscoveryApplicationDraft {
    return {
      sourceNodeId: this.sourceSelect.value,
      targetNodeId: this.targetSelect.value,
      relation: this.relationInput.value,
      confirmConflict: this.conflictCheckbox.checked,
    };
  }

  private refreshPreview(): void {
    if (!this.statusEl) return;
    const preview = this.deps.preview(this.draft());
    this.conflictBox.toggleClass(
      'is-visible',
      preview.conflicts.length > 0 || preview.kind === 'conflict',
    );
    if (preview.conflicts.length === 0) {
      this.conflictCheckbox.checked = false;
    }
    this.renderConflicts(preview);
    this.statusEl.setText(preview.reason);
    this.statusEl.toggleClass('is-error', preview.kind !== 'ok' && preview.kind !== 'existing');
    this.submitButton.disabled =
      this.submitted ||
      (preview.kind !== 'ok' && preview.kind !== 'existing');
  }

  private renderConflicts(preview: DiscoveryApplicationPreview): void {
    const old = this.conflictBox.querySelector('.interestseed-apply-conflict-list');
    old?.remove();
    if (preview.conflicts.length === 0) return;
    const list = this.conflictBox.createDiv({
      cls: 'interestseed-apply-conflict-list',
    });
    list.createEl('strong', { text: '已有相关关系：' });
    for (const conflict of preview.conflicts) {
      list.createDiv({
        text: `${conflict.relation}（${conflict.direction === 'forward' ? '同向' : '反向'}，${conflict.status}）`,
      });
    }
  }

  private async submit(): Promise<void> {
    if (this.submitted) return;
    this.submitted = true;
    this.submitButton.disabled = true;
    this.statusEl.setText('应用中…');
    let succeeded = false;
    try {
      const result = await this.deps.apply(this.draft());
      succeeded = result.status === 'applied' || result.status === 'existing';
      this.statusEl.setText(result.message);
      this.statusEl.toggleClass('is-error', !succeeded);
      this.deps.onFinished(result);
      if (succeeded) {
        new Notice(`InterestSeed：${result.message}`, 8000);
      }
    } catch (error) {
      this.statusEl.setText(
        error instanceof Error ? error.message : String(error),
      );
      this.statusEl.addClass('is-error');
    } finally {
      this.submitted = false;
      if (succeeded) {
        this.submitButton.disabled = true;
      } else {
        this.refreshPreview();
      }
    }
  }
}
