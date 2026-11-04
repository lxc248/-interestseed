import { chromium } from 'playwright-core';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = browser.contexts()[0].pages().find((item) => item.url().includes('obsidian.md')) ?? browser.contexts()[0].pages()[0];
const settings = await page.evaluate(async () => {
  const plugin = window.app.plugins.plugins.interestseed;
  plugin.settings.enableAI = true;
  plugin.settings.aiConsentGranted = true;
  plugin.settings.aiProvider = 'local';
  plugin.settings.aiModel = 'cn:deepseek-v4.1-flash';
  await plugin.saveSettings();
  return { model: plugin.settings.aiModel, key: Boolean(await plugin.getAiApiKey()) };
});
await page.evaluate(async () => window.app.commands.executeCommandById('interestseed:interestseed-ai-expand'));
await page.waitForTimeout(20000);
const modalText = await page.locator('.modal').first().textContent().catch(() => '');
const notices = await page.locator('.notice').allTextContents().catch(() => []);
await page.screenshot({ path: 'C:/Users/30735/Desktop/interestseed/review/experiment-3.0.8/54-ai-live-v41-flash.png' });
await browser.close();
console.log(JSON.stringify({ settings, modal: modalText.slice(0, 1200), notices }, null, 2));
