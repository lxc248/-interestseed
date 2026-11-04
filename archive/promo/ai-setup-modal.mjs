import { chromium } from 'playwright-core';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = browser.contexts()[0].pages().find((item) => item.url().includes('obsidian.md')) ?? browser.contexts()[0].pages()[0];
await page.evaluate(async () => window.app.commands.executeCommandById('interestseed:interestseed-ai-setup'));
await page.waitForTimeout(700);
await page.screenshot({ path: 'C:/Users/30735/Desktop/interestseed/review/experiment-3.0.8/52-ai-setup-modal.png' });
const text = await page.locator('.modal').first().textContent();
await browser.close();
console.log(JSON.stringify({ hasTitle: text.includes('把 AI 推荐接上'), hasPrivacy: text.includes('不会发送笔记正文'), hasKeyInput: text.includes('本地服务 API Key') }, null, 2));
