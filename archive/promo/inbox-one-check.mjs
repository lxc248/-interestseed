import { chromium } from 'playwright-core';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = browser.contexts()[0].pages()[0];
await page.keyboard.press('Escape');
await page.evaluate(async () => {
  const p = window.app.plugins.plugins.interestseed;
  p.inbox.load([]);
  p.enqueueShare('美妆：早八底妆不卡粉 https://www.douyin.com/video/one-1');
  p.enqueueShare('游戏：塞尔达为什么让我绕路 https://www.douyin.com/video/one-2');
  p.openInbox();
});
await page.waitForTimeout(450);
await page.screenshot({ path: 'C:\\Users\\30735\\Desktop\\interestseed\\review\\sim-artifacts\\21-inbox-one-at-a-time.png' });
console.log('items', await page.locator('.interestseed-inbox-item').count(), 'queue', await page.locator('.interestseed-inbox-queue').innerText());
await page.keyboard.press('Escape');
await page.evaluate(async () => { const p = window.app.plugins.plugins.interestseed; await p.inbox.load([]); await p.saveSettings(); });
await browser.close();
