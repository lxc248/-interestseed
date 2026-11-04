import { chromium } from 'playwright-core';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = browser.contexts()[0].pages().find((item) => item.url().includes('obsidian.md')) ?? browser.contexts()[0].pages()[0];

const before = await page.evaluate(async () => {
  const plugin = window.app.plugins.plugins.interestseed;
  const nodes = plugin.store.listNodes();
  const focus = nodes.find((node) => node.title.includes('AI 与工具')) ?? nodes[0];
  plugin.setSelectedNode(focus.id);
  await plugin.expandWithAI(focus.id);
  await new Promise((resolve) => setTimeout(resolve, 800));
  return {
    focus: focus.title,
    text: document.querySelector('.modal')?.textContent?.slice(0, 800) ?? '',
    hasPending: (document.querySelector('.modal')?.textContent ?? '').includes('待确认'),
  };
});
await page.screenshot({ path: 'C:/Users/30735/Desktop/interestseed/review/experiment-3.0.8/61-ai-single-suggestion.png' });

const connected = await page.evaluate(async () => {
  const plugin = window.app.plugins.plugins.interestseed;
  const button = [...document.querySelectorAll('.modal button')].find((item) => item.textContent === '连上');
  button?.click();
  await new Promise((resolve) => setTimeout(resolve, 800));
  return {
    edges: plugin.store.getGraph().edges.length,
    text: document.querySelector('.modal')?.textContent?.slice(0, 500) ?? '',
  };
});
await page.screenshot({ path: 'C:/Users/30735/Desktop/interestseed/review/experiment-3.0.8/62-ai-single-connected.png' });

const undone = await page.evaluate(async () => {
  const plugin = window.app.plugins.plugins.interestseed;
  const button = [...document.querySelectorAll('.modal button')].find((item) => item.textContent === '撤销');
  button?.click();
  await new Promise((resolve) => setTimeout(resolve, 500));
  return {
    edges: plugin.store.getGraph().edges.length,
    text: document.querySelector('.modal')?.textContent?.slice(0, 400) ?? '',
  };
});
await page.screenshot({ path: 'C:/Users/30735/Desktop/interestseed/review/experiment-3.0.8/63-ai-single-undone.png' });
await browser.close();
console.log(JSON.stringify({ before, connected, undone }, null, 2));
