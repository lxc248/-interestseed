import { chromium } from 'playwright-core';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = browser.contexts()[0].pages().find((item) => item.url().includes('obsidian.md')) ?? browser.contexts()[0].pages()[0];

const result = await page.evaluate(async () => {
  const plugin = window.app.plugins.plugins.interestseed;
  const node = plugin.store.listNodes().find((item) => item.sourceUri?.startsWith('vault:') && item.title.includes('AI 与工具')) ?? plugin.store.listNodes().find((item) => item.sourceUri?.startsWith('vault:'));
  if (!node?.sourceUri) return { error: 'no vault node' };
  const path = node.sourceUri.slice('vault:'.length);
  const file = window.app.vault.getAbstractFileByPath(path);
  if (!file) return { error: 'file missing', path };
  const leaf = window.app.workspace.getLeaf('tab');
  await leaf.openFile(file);
  await new Promise((resolve) => setTimeout(resolve, 400));
  await window.app.commands.executeCommandById('interestseed:interestseed-ai-from-note');
  await new Promise((resolve) => setTimeout(resolve, 800));
  const view = window.app.workspace.getLeavesOfType('interestseed-ai-view')[0]?.view;
  return {
    node: node.title,
    path,
    text: view?.contentEl?.textContent?.slice(0, 700) ?? '',
  };
});
await page.screenshot({ path: 'C:/Users/30735/Desktop/interestseed/review/experiment-3.0.8/67-ai-from-note.png' });
await browser.close();
console.log(JSON.stringify(result, null, 2));
