import { chromium } from 'playwright-core';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = browser.contexts()[0].pages().find((item) => item.url().includes('obsidian.md')) ?? browser.contexts()[0].pages()[0];
const data = await page.evaluate(() => {
  const plugin = window.app.plugins.plugins.interestseed;
  const nodes = plugin.store.listNodes();
  const suggestions = [
    {
      source: nodes[0].id,
      target: nodes[1].id,
      relation: '共享方法',
      reason: '两个兴趣都在讨论“如何让人愿意开始”，可以互相验证。',
      confidence: 0.82,
    },
    {
      source: nodes[1].id,
      target: nodes[2].id,
      relation: '同一实验',
      reason: '都指向一个可执行的小实验，而不是更大的收藏。',
      confidence: 0.67,
    },
  ];
  plugin.openAiSuggestions(suggestions);
  return suggestions.map((item) => ({ relation: item.relation, confidence: item.confidence }));
});
await page.waitForTimeout(700);
await page.screenshot({ path: 'C:/Users/30735/Desktop/interestseed/review/experiment-3.0.8/51-ai-suggestion-card.png' });
const text = await page.locator('.modal').first().textContent();
await browser.close();
console.log(JSON.stringify({ data, hasReason: text.includes('理由'), hasConfidence: text.includes('82%') }, null, 2));
