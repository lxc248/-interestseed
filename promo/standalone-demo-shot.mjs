import { chromium } from 'playwright-core';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
await page.goto('http://127.0.0.1:4175', { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
const node = page.locator('svg .node').filter({ hasText: 'AI 工具' }).first();
if (await node.count()) await node.click({ force: true });
await page.screenshot({ path: 'C:/Users/30735/Desktop/interestseed/review/standalone-demo.png', fullPage: true });
await page.getByRole('button', { name: '用 AI 找一条连接' }).click();
await page.waitForTimeout(45000);
const input = page.locator('.suggestion-card input');
if (await input.count()) {
  await input.fill('辅助知识整理');
  await input.dispatchEvent('change');
}
await page.screenshot({ path: 'C:/Users/30735/Desktop/interestseed/review/standalone-ai.png', fullPage: true });
const text = await page.locator('#ai-body').innerText();
console.log(JSON.stringify({ text: text.slice(0, 500) }, null, 2));
await browser.close();

