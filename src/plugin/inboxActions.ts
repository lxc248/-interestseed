import { Notice, type App } from 'obsidian';

export async function enqueueActiveNote(input: {
  app: App;
  enqueueShare: (
    text: string,
    source: 'note',
    sourceRef?: string,
  ) => { item?: { id: string }; duplicate?: boolean } | null | undefined;
  openInbox: () => void;
}): Promise<void> {
  const file = input.app.workspace.getActiveFile();
  if (!file || file.extension !== 'md') {
    new Notice('先打开一篇 Markdown 笔记，再加入收件箱。');
    return;
  }
  const raw = await input.app.vault.cachedRead(file);
  const body = raw
    .replace(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---\s*/u, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1600);
  if (!body) {
    new Notice('这篇笔记是空的，没有可加入的内容。');
    return;
  }
  const result = input.enqueueShare(`${file.basename}\n${body}`, 'note', file.path);
  if (!result) {
    new Notice('当前笔记没有可加入的内容。');
    return;
  }
  new Notice(result.duplicate ? '这篇笔记已经在收件箱里了。' : '已把当前笔记放进收件箱。');
  input.openInbox();
}

export async function openSparkFromClipboard(input: {
  enqueueShare: (text: string, source: 'clipboard') => { item?: { id: string } } | null | undefined;
  openSparkCapture: (text: string, itemId?: string, source?: 'clipboard') => void;
}): Promise<void> {
  try {
    const text = await navigator.clipboard.readText();
    if (!text.trim()) {
      new Notice('剪贴板里没有可识别的分享内容。');
      return;
    }
    const result = input.enqueueShare(text, 'clipboard');
    input.openSparkCapture(text, result?.item?.id, 'clipboard');
  } catch {
    new Notice('无法读取剪贴板。请在手机快捷指令中使用 interestseed-share 链接，或手动粘贴。');
  }
}
