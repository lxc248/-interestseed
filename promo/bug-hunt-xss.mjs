import { chromium } from 'playwright-core';

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = browser.contexts()[0].pages()[0];
const result = await page.evaluate(async () => {
  const plugin = window.app.plugins.plugins.interestseed;
  window.__xss = undefined;
  const node = plugin.store.addNode({
    title: '<img src=x onerror="window.__xss=1">',
    type: 'topic',
    tags: ['<script>window.__xss=2</script>'],
  });
  plugin.setSelectedNode(node.id);
  await plugin.activateView();
  await new Promise((resolve) => setTimeout(resolve, 400));
  const graphFlag = window.__xss;
  const graphImages = document.querySelectorAll('img[src="x"]').length;
  plugin.openShareCard();
  await new Promise((resolve) => setTimeout(resolve, 400));
  const cardFlag = window.__xss;
  const cardImages = document.querySelectorAll('img[src="x"]').length;
  document.querySelectorAll('.modal-close-button').forEach((button) => button.click());
  plugin.store.removeNode(node.id);
  return { graphFlag, graphImages, cardFlag, cardImages };
});
await browser.close();
console.log(JSON.stringify(result, null, 2));
if (result.graphFlag !== undefined || result.cardFlag !== undefined || result.graphImages > 0 || result.cardImages > 0) process.exit(1);
