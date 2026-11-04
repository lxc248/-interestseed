import { chromium } from 'playwright-core';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = browser.contexts()[0].pages()[0];
const data = await page.evaluate(() => [...document.querySelectorAll('.modal')].map((m) => ({
  text: m.textContent?.slice(0, 160),
  display: getComputedStyle(m).display,
  cls: m.className,
  close: Boolean(m.querySelector('.modal-close-button')),
  buttons: [...m.querySelectorAll('button')].map((b) => b.textContent),
})));
await browser.close();
console.log(JSON.stringify(data, null, 2));
