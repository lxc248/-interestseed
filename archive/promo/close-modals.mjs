import { chromium } from 'playwright-core';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = browser.contexts()[0].pages()[0];
for (let index = 0; index < 6; index += 1) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
}
const count = await page.locator('.modal').count();
const data = await page.evaluate(() => [...document.querySelectorAll('.modal')].map((m) => m.textContent?.slice(0, 80)));
await browser.close();
console.log(JSON.stringify({ count, data }, null, 2));
