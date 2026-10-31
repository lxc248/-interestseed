import { chromium } from 'playwright-core';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = browser.contexts()[0].pages().find((item) => item.url().includes('obsidian.md')) ?? browser.contexts()[0].pages()[0];

await page.evaluate(async () => window.app.commands.executeCommandById('interestseed:interestseed-ai-setup'));
await page.waitForTimeout(600);
await page.screenshot({ path: 'C:/Users/30735/Desktop/interestseed/review/experiment-3.0.8/52-ai-setup-modal.png' });
const setupText = await page.locator('.modal').first().textContent().catch(() => '');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

await page.evaluate(async () => {
  const plugin = window.app.plugins.plugins.interestseed;
  plugin.settings.enableAI = true;
  plugin.settings.aiConsentGranted = true;
  plugin.settings.aiProvider = 'local';
  plugin.settings.aiModel = 'cn:deepseek-v4.1-flash';
  await plugin.saveSettings();
  await plugin.expandWithAI();
});
await page.waitForTimeout(700);
await page.screenshot({ path: 'C:/Users/30735/Desktop/interestseed/review/experiment-3.0.8/54-ai-live-v41-flash.png' });
const suggestionText = await page.locator('.modal').first().textContent().catch(() => '');
await browser.close();
console.log(JSON.stringify({
  setupHasModel: setupText.includes('cn:deepseek-v4.1-flash'),
  suggestions: suggestionText.slice(0, 400),
  hasUnrated: suggestionText.includes('未评分'),
}, null, 2));
