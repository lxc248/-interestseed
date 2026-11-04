import { chromium } from 'playwright-core';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = browser.contexts()[0].pages().find((item) => item.url().includes('obsidian.md')) ?? browser.contexts()[0].pages()[0];

await page.evaluate(async () => window.app.commands.executeCommandById('interestseed:interestseed-ai-setup'));
await page.waitForTimeout(600);
await page.screenshot({ path: 'C:/Users/30735/Desktop/interestseed/review/experiment-3.0.8/57-ai-setup-saved-key.png' });
const setup = await page.evaluate(() => {
  const input = document.querySelector('.interestseed-ai-setup-input');
  return {
    placeholder: input?.getAttribute('placeholder') ?? '',
    text: document.querySelector('.modal')?.textContent?.slice(0, 600) ?? '',
  };
});
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

const before = await page.evaluate(async () => {
  const plugin = window.app.plugins.plugins.interestseed;
  const nodes = plugin.store.listNodes();
  const focus = nodes.find((node) => node.title.includes('AI 与工具')) ?? nodes[0];
  plugin.setSelectedNode(focus.id);
  await plugin.expandWithAI(focus.id);
  await new Promise((resolve) => setTimeout(resolve, 800));
  return { focus: focus.title, edges: plugin.store.getGraph().edges.length };
});
await page.screenshot({ path: 'C:/Users/30735/Desktop/interestseed/review/experiment-3.0.8/58-ai-rename-before-confirm.png' });

const afterConfirm = await page.evaluate(async () => {
  const plugin = window.app.plugins.plugins.interestseed;
  const confirm = [...document.querySelectorAll('.modal button')].find((item) => item.textContent === '确认');
  confirm?.click();
  await new Promise((resolve) => setTimeout(resolve, 800));
  return {
    edges: plugin.store.getGraph().edges.length,
    banner: document.querySelector('.interestseed-ai-suggestion-banner')?.textContent ?? '',
    hasUndo: [...document.querySelectorAll('.modal button')].some((item) => item.textContent === '撤销这次写入'),
  };
});
await page.screenshot({ path: 'C:/Users/30735/Desktop/interestseed/review/experiment-3.0.8/59-ai-write-banner.png' });

const afterUndo = await page.evaluate(async () => {
  const plugin = window.app.plugins.plugins.interestseed;
  const undo = [...document.querySelectorAll('.modal button')].find((item) => item.textContent === '撤销这次写入');
  undo?.click();
  await new Promise((resolve) => setTimeout(resolve, 600));
  return {
    edges: plugin.store.getGraph().edges.length,
    text: document.querySelector('.modal')?.textContent?.slice(0, 500) ?? '',
  };
});
await page.screenshot({ path: 'C:/Users/30735/Desktop/interestseed/review/experiment-3.0.8/60-ai-undone.png' });
await browser.close();
console.log(JSON.stringify({ setup, before, afterConfirm, afterUndo }, null, 2));
