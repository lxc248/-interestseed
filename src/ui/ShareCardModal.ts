import { Modal, Notice, setIcon } from 'obsidian';
import type { App } from 'obsidian';
import type InterestSeedPlugin from '../main';
import type { InterestSeedGraph } from '../types/graph';
import {
  SHARE_PRESETS,
  buildShareCaption,
  canvasToBlob,
  getSharePreset,
  renderShareCard,
  shareCardFilename,
  type SharePlatform,
} from './ShareCardRenderer';

/**
 * Social export: platform-sized PNGs, never a screenshot of the live UI.
 * The renderer uses only local canvas drawing, so the exported image is safe
 * to download, copy, or pass to the system share sheet.
 */
export class ShareCardModal extends Modal {
  private platform: SharePlatform = 'xiaohongshu';
  private previewEl: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private statusEl: HTMLElement | null = null;
  private captionEl: HTMLElement | null = null;
  private readonly hiddenIds = new Set<string>();

  constructor(
    app: App,
    private readonly plugin: InterestSeedPlugin,
  ) {
    super(app);
    this.modalEl.addClass('interestseed-share-modal');
  }

  override onOpen(): void {
    this.render();
  }

  override onClose(): void {
    this.contentEl.empty();
    this.previewEl = null;
    this.canvas = null;
  }

  private render(): void {
    const root = this.contentEl;
    root.empty();
    root.addClass('interestseed-share');
    const header = root.createDiv({ cls: 'interestseed-share-header' });
    const mark = header.createDiv({ cls: 'interestseed-share-mark' });
    setIcon(mark, 'share-2');
    const copy = header.createDiv();
    copy.createDiv({ cls: 'interestseed-share-kicker', text: 'MAKE A PROOF CARD' });
    copy.createEl('h2', { cls: 'interestseed-share-title', text: '把你的兴趣，做成一张会被看完的卡。' });
    copy.createEl('p', {
      cls: 'interestseed-share-lede',
      text: '不是 UI 截图，是给短视频平台重新排版的证据卡：一个钩子、一组数字、一张星图。',
    });

    const platforms = root.createDiv({ cls: 'interestseed-share-platforms' });
    for (const preset of SHARE_PRESETS) {
      const button = platforms.createEl('button', {
        cls: `interestseed-share-platform${preset.id === this.platform ? ' is-active' : ''}`,
        text: preset.label,
        attr: { type: 'button' },
      });
      button.addEventListener('click', () => {
        this.platform = preset.id;
        for (const child of Array.from(platforms.children)) child.removeClass('is-active');
        button.addClass('is-active');
        this.renderCard();
      });
    }

    const preview = root.createDiv({ cls: 'interestseed-share-preview' });
    this.previewEl = preview;

    const settings = root.createEl('details', { cls: 'interestseed-share-settings' });
    settings.createEl('summary', {
      text: '分享设置 · 隐藏不想公开的节点',
    });
    const nodeList = settings.createDiv({ cls: 'interestseed-share-node-list' });
    for (const node of [...this.plugin.store.listNodes()]
      .sort((left, right) => left.title.localeCompare(right.title, 'zh'))
      .slice(0, 10)) {
      const label = nodeList.createEl('label', { cls: 'interestseed-share-node-option' });
      const checkbox = label.createEl('input', { attr: { type: 'checkbox' } });
      checkbox.checked = !this.hiddenIds.has(node.id);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) this.hiddenIds.delete(node.id);
        else this.hiddenIds.add(node.id);
        this.renderCard();
      });
      label.createSpan({ text: node.title });
    }

    const info = root.createDiv({ cls: 'interestseed-share-info' });
    info.createSpan({ text: 'PNG · 无外链素材 · 可直接上传' });
    this.statusEl = info.createSpan({ cls: 'interestseed-share-status', text: '' });

    this.captionEl = root.createDiv({ cls: 'interestseed-share-caption' });
    this.renderCard();

    const actions = root.createDiv({ cls: 'interestseed-share-actions' });
    const download = actions.createEl('button', {
      cls: 'mod-cta interestseed-sprint-primary',
      text: '下载 PNG',
      attr: { type: 'button' },
    });
    download.addEventListener('click', () => void this.download());
    const copyImageButton = actions.createEl('button', {
      cls: 'interestseed-sprint-secondary',
      text: '复制图片',
      attr: { type: 'button' },
    });
    copyImageButton.addEventListener('click', () => void this.copyImage());
    const caption = actions.createEl('button', {
      cls: 'interestseed-sprint-secondary',
      text: '复制文案',
      attr: { type: 'button' },
    });
    caption.addEventListener('click', () => void this.copyCaption());
    const share = actions.createEl('button', {
      cls: 'interestseed-sprint-secondary',
      text: '系统分享',
      attr: { type: 'button' },
    });
    share.addEventListener('click', () => void this.systemShare());
  }

  private visibleGraph(graph: InterestSeedGraph): InterestSeedGraph {
    if (this.hiddenIds.size === 0) return graph;
    const nodes = graph.nodes.filter((node) => !this.hiddenIds.has(node.id));
    const ids = new Set(nodes.map((node) => node.id));
    return {
      ...graph,
      nodes,
      edges: graph.edges.filter(
        (edge) => ids.has(edge.source) && ids.has(edge.target),
      ),
    };
  }

  private renderCard(): void {
    if (!this.previewEl) return;
    this.previewEl.empty();
    const graph = this.visibleGraph(this.plugin.store.getGraph());
    if (graph.nodes.length === 0) {
      this.previewEl.createDiv({
        cls: 'interestseed-share-empty',
        text: '图谱里还没有节点。先留下一个火花，再回来分享。',
      });
      this.canvas = null;
      return;
    }
    const preset = getSharePreset(this.platform);
    const canvas = renderShareCard(graph, preset);
    this.canvas = canvas;
    if (this.captionEl) this.captionEl.setText(buildShareCaption(graph, preset));
    canvas.addClass('interestseed-share-canvas');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `${preset.label} 兴趣星图分享卡片`);
    this.previewEl.appendChild(canvas);
    if (this.statusEl) this.statusEl.setText('');
  }

  private async download(): Promise<void> {
    if (!this.canvas) return;
    try {
      const blob = await canvasToBlob(this.canvas);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = shareCardFilename(getSharePreset(this.platform));
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.setStatus('已下载 PNG');
    } catch (error) {
      new Notice(error instanceof Error ? error.message : '导出图片失败。');
    }
  }

  private async copyCaption(): Promise<void> {
    const graph = this.plugin.store.getGraph();
    if (!graph.nodes.length) return;
    const caption = buildShareCaption(graph, getSharePreset(this.platform));
    try {
      await navigator.clipboard.writeText(caption);
      this.setStatus('文案已复制');
    } catch {
      new Notice('复制文案失败，请手动选择卡片下方文案。');
    }
  }

  private async copyImage(): Promise<void> {
    if (!this.canvas) return;
    try {
      const blob = await canvasToBlob(this.canvas);
      const clipboard = navigator.clipboard;
      const ClipboardItemCtor = window.ClipboardItem;
      if (!clipboard?.write || !ClipboardItemCtor) {
        new Notice('当前环境不支持复制图片，请使用「下载 PNG」。');
        return;
      }
      await clipboard.write([new ClipboardItemCtor({ 'image/png': blob })]);
      this.setStatus('已复制到剪贴板');
    } catch {
      new Notice('复制图片失败，请使用「下载 PNG」。');
    }
  }

  private async systemShare(): Promise<void> {
    if (!this.canvas) return;
    try {
      const blob = await canvasToBlob(this.canvas);
      const file = new File([blob], shareCardFilename(getSharePreset(this.platform)), {
        type: 'image/png',
      });
      if (!navigator.share || !navigator.canShare?.({ files: [file] })) {
        new Notice('当前设备不支持系统分享，请使用「下载 PNG」。');
        return;
      }
      await navigator.share({ files: [file], title: '我的兴趣星图' });
      this.setStatus('已打开系统分享');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      new Notice('系统分享失败，请使用「下载 PNG」。');
    }
  }

  private setStatus(value: string): void {
    if (this.statusEl) this.statusEl.setText(value);
  }
}
