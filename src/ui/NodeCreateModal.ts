import { Modal, Setting, TextComponent } from 'obsidian';
import type { App } from 'obsidian';
import { NODE_TYPES, isNodeType, type NodeType } from '../types/graph';

const TYPE_LABELS: Record<NodeType, string> = {
  project: '项目',
  document: '文档',
  topic: '主题',
  image: '图片',
  audio: '音频',
  video: '视频',
  activity: '活动',
};

/** 新建节点的标题 + 类型输入框。 */
export class NodeCreateModal extends Modal {
  private title = '';
  private type: NodeType = 'topic';

  constructor(
    app: App,
    private readonly onSubmit: (title: string, type: NodeType) => void,
  ) {
    super(app);
  }

  override onOpen(): void {
    this.titleEl.setText('新建节点');
    const { contentEl } = this;
    contentEl.empty();

    const input = new TextComponent(contentEl.createDiv({ cls: 'interestseed-modal-input' }));
    input.setPlaceholder('标题，例如：论文初稿、城市骑行、研究计划…');
    input.onChange((value) => {
      this.title = value;
    });
    input.inputEl.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') this.submit();
    });
    window.setTimeout(() => input.inputEl.focus(), 0);

    new Setting(contentEl).setName('类型').addDropdown((dropdown) => {
      for (const type of NODE_TYPES) dropdown.addOption(type, TYPE_LABELS[type]);
      dropdown.setValue(this.type).onChange((value) => {
        if (isNodeType(value)) this.type = value;
      });
    });

    new Setting(contentEl).addButton((button) =>
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
    const title = this.title.trim();
    if (!title) return;
    this.onSubmit(title, this.type);
    this.close();
  }
}
