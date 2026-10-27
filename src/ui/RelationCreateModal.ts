import { Modal, Setting } from 'obsidian';
import type { App } from 'obsidian';
import type { InterestSeedNode } from '../types/graph';

export interface RelationDraft {
  targetId: string;
  relation: string;
}

/** 从节点详情面板创建关系：选择目标节点并填写关系名称。 */
export class RelationCreateModal extends Modal {
  private targetId: string;
  private relation = 'related-to';

  constructor(
    app: App,
    private readonly source: InterestSeedNode,
    private readonly targets: InterestSeedNode[],
    private readonly onSubmit: (draft: RelationDraft) => void,
  ) {
    super(app);
    this.targetId = targets[0]?.id ?? '';
  }

  override onOpen(): void {
    this.titleEl.setText(`创建关系：${this.source.title}`);
    const { contentEl } = this;
    contentEl.empty();

    if (this.targets.length === 0) {
      contentEl.createEl('p', {
        cls: 'setting-item-description',
        text: '图谱里还没有其他节点，先创建或扫描一个节点再来连边。',
      });
      return;
    }

    new Setting(contentEl).setName('目标节点').addDropdown((dropdown) => {
      for (const target of this.targets) dropdown.addOption(target.id, target.title);
      dropdown.setValue(this.targetId).onChange((value) => {
        this.targetId = value;
      });
    });

    new Setting(contentEl).setName('关系名称').addText((text) =>
      text
        .setPlaceholder('例如：references、related-to、about')
        .setValue(this.relation)
        .onChange((value) => {
          this.relation = value.trim();
        }),
    );

    new Setting(contentEl)
      .setDesc('手动创建的关系会标记为 origin=user、status=confirmed，并记录撤销信息。')
      .addButton((button) =>
        button
          .setButtonText('创建')
          .setCta()
          .onClick(() => this.submit()),
      );
  }

  override onClose(): void {
    this.contentEl.empty();
  }

  private submit(): void {
    const relation = this.relation.trim();
    if (!relation || !this.targetId) return;
    this.onSubmit({ targetId: this.targetId, relation });
    this.close();
  }
}
