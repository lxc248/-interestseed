import { chromium } from 'playwright-core';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const pages = browser.contexts()[0].pages();
const main = pages.find((page) => page.url().includes('obsidian.md')) ?? pages[0];

await main.evaluate(() => {
  window.app.setting.open();
  window.app.setting.openTabById('interestseed');
});
await new Promise((resolve) => setTimeout(resolve, 800));
const settingsPage = browser.contexts()[0].pages().find((page) => page.url() === 'about:blank') ?? browser.contexts()[0].pages()[0];
await settingsPage.locator('text=AI 关系建议').first().scrollIntoViewIfNeeded().catch(() => {});
await settingsPage.waitForTimeout(300);
await settingsPage.screenshot({ path: 'C:/Users/30735/Desktop/interestseed/review/experiment-3.0.8/64-ai-local-model-panel.png' });
const settingsText = await settingsPage.locator('body').innerText().catch(() => '');
await settingsPage.evaluate(() => window.close());
await main.waitForTimeout(400);

await main.evaluate(async () => window.app.commands.executeCommandById('interestseed:interestseed-ai-setup'));
await main.waitForTimeout(600);
await main.screenshot({ path: 'C:/Users/30735/Desktop/interestseed/review/experiment-3.0.8/57-ai-setup-saved-key.png' });
const setupText = await main.locator('.modal').first().textContent().catch(() => '');
await browser.close();
console.log(JSON.stringify({
  hasPanel: settingsText.includes('MODEL') && settingsText.includes('本地模型'),
  hasClaudian: settingsText.includes('Claudian'),
  setupHasClaudian: setupText.includes('Claudian'),
  setupText: setupText.slice(0, 500),
}, null, 2));
