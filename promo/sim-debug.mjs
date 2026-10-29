import { chromium } from 'playwright-core';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = browser.contexts()[0].pages()[0];
console.log(await page.evaluate(() => ({
  workspaceKeys: Object.keys(window.app.workspace).filter((key) => /modal|active/i.test(key)),
  activeModal: Boolean(window.app.workspace.activeModal),
  buttons: [...document.querySelectorAll('.modal-container button')].slice(0, 10).map((b) => ({ cls: b.className, aria: b.getAttribute('aria-label'), text: b.textContent }))
})));
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
console.log(await page.evaluate(() => document.querySelectorAll('.modal-container').length));
await browser.close();
