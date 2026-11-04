import { chromium } from 'playwright-core';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = browser.contexts()[0].pages().find((item) => item.url().includes('obsidian.md')) ?? browser.contexts()[0].pages()[0];
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

const before = await page.evaluate(async () => {
  const plugin = window.app.plugins.plugins.interestseed;
  const nodes = plugin.store.listNodes();
  const focus = nodes.find((node) => node.title.includes('AI 与工具')) ?? nodes[0];
  plugin.setSelectedNode(focus.id);
  await plugin.expandWithAI(focus.id);
  await new Promise((resolve) => setTimeout(resolve, 900));
  return {
    focus: { id: focus.id, title: focus.title },
    modal: document.querySelector('.modal')?.textContent?.slice(0, 1400) ?? '',
    stats: plugin.store.stats(),
    edges: plugin.store.getGraph().edges.length,
  };
});
await page.screenshot({ path: 'C:/Users/30735/Desktop/interestseed/review/experiment-3.0.8/55-ai-focus-live.png' });

const confirmed = await page.evaluate(async () => {
  const plugin = window.app.plugins.plugins.interestseed;
  const beforeEdges = plugin.store.getGraph().edges.length;
  const button = [...document.querySelectorAll('.modal button')].find((item) => item.textContent === '确认');
  if (!button) return { error: 'no confirm button', beforeEdges };
  button.click();
  await new Promise((resolve) => setTimeout(resolve, 900));
  const edges = plugin.store.getGraph().edges;
  const aiEdge = edges.find((edge) => edge.origin === 'ai' && edge.status === 'confirmed');
  return {
    beforeEdges,
    afterEdges: edges.length,
    aiEdge: aiEdge
      ? { relation: aiEdge.relation, evidence: aiEdge.evidence, confidence: aiEdge.confidence }
      : null,
  };
});
await page.screenshot({ path: 'C:/Users/30735/Desktop/interestseed/review/experiment-3.0.8/56-ai-confirmed-edge.png' });

const restored = await page.evaluate(async () => {
  const plugin = window.app.plugins.plugins.interestseed;
  await plugin.undo.undo();
  await new Promise((resolve) => setTimeout(resolve, 500));
  return plugin.store.getGraph().edges.length;
});
await browser.close();
console.log(JSON.stringify({ before, confirmed, restored }, null, 2));
