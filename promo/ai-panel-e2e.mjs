import { chromium } from 'playwright-core';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = browser.contexts()[0].pages().find((item) => item.url().includes('obsidian.md')) ?? browser.contexts()[0].pages()[0];
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

await page.evaluate(async () => window.app.commands.executeCommandById('interestseed:interestseed-ai-panel'));
await page.waitForTimeout(800);
await page.screenshot({ path: 'C:/Users/30735/Desktop/interestseed/review/experiment-3.0.8/65-ai-panel-empty.png' });
const empty = await page.evaluate(() => {
  const view = window.app.workspace.getLeavesOfType('interestseed-ai-view')[0]?.view;
  return {
    open: Boolean(view),
    text: view?.contentEl?.textContent?.slice(0, 500) ?? '',
    activeFile: window.app.workspace.getActiveFile()?.path ?? null,
  };
});

const result = await page.evaluate(async () => {
  const plugin = window.app.plugins.plugins.interestseed;
  const nodes = plugin.store.listNodes();
  const focus = nodes.find((node) => node.title.includes('AI 与工具')) ?? nodes[0];
  plugin.setSelectedNode(focus.id);
  await plugin.expandWithAI(focus.id);
  await new Promise((resolve) => setTimeout(resolve, 900));
  const view = window.app.workspace.getLeavesOfType('interestseed-ai-view')[0]?.view;
  return { text: view?.contentEl?.textContent?.slice(0, 900) ?? '' };
});
await page.screenshot({ path: 'C:/Users/30735/Desktop/interestseed/review/experiment-3.0.8/66-ai-panel-suggestion.png' });
await browser.close();
console.log(JSON.stringify({ empty, result }, null, 2));
