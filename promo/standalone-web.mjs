import { chromium } from 'playwright-core';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
await page.goto('http://127.0.0.1:4174', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.screenshot({ path: 'C:/Users/30735/Desktop/interestseed/review/standalone-web.png', fullPage: true });
const text = await page.locator('body').innerText();
for (const button of await page.locator('button').all()) {
  if ((await button.textContent())?.includes('找一条连接')) {
    await button.click();
    break;
  }
}
await page.waitForTimeout(2500);
await page.screenshot({ path: 'C:/Users/30735/Desktop/interestseed/review/standalone-ai.png', fullPage: true });
const after = await page.locator('body').innerText();
await browser.close();
console.log(JSON.stringify({ hasGraph: text.includes('你的兴趣图谱'), hasAi: after.includes('AI 建议'), after: after.slice(0, 600) }, null, 2));
