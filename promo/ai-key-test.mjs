import { chromium } from 'playwright-core';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = browser.contexts()[0].pages().find((item) => item.url().includes('obsidian.md')) ?? browser.contexts()[0].pages()[0];
const result = await page.evaluate(async () => {
  const plugin = window.app.plugins.plugins.interestseed;
  plugin.settings.enableAI = true;
  plugin.settings.aiConsentGranted = true;
  plugin.settings.aiProvider = 'cn:deepseek-v4-pro';
  await plugin.saveSettings();
  await plugin.saveAiApiKey('test-local-key');
  const key = await plugin.getAiApiKey();
  return { key, settings: { enableAI: plugin.settings.enableAI, consent: plugin.settings.aiConsentGranted } };
});
await page.evaluate(async () => window.app.commands.executeCommandById('interestseed:interestseed-ai-expand'));
await page.waitForTimeout(4000);
const notice = await page.locator('.notice').last().textContent().catch(() => '');
await page.screenshot({ path: 'C:/Users/30735/Desktop/interestseed/review/experiment-3.0.8/50-ai-key-test.png' });
await browser.close();
console.log(JSON.stringify({ result, notice }, null, 2));
