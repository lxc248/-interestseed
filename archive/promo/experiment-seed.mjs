import { chromium } from 'playwright-core';
import { join } from 'node:path';

const out = 'C:\\Users\\30735\\Desktop\\interestseed\\review\\experiment-3.0.8';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = browser.contexts()[0].pages()[0];
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

await page.evaluate(async () => window.app.commands.executeCommandById('interestseed:interestseed-seed-sprint'));
await page.waitForTimeout(500);
await page.evaluate(() => {
  const button = [...document.querySelectorAll('.modal button')].find((item) => item.textContent === '开始长出我的星图');
  button?.click();
});
await page.waitForTimeout(350);

let rounds = 0;
for (let index = 0; index < 8; index += 1) {
  const hasNext = await page.evaluate(() => Boolean(document.querySelector('[data-sprint-next]')));
  if (!hasNext) break;
  const label = await page.evaluate(() => document.querySelector('[data-sprint-next]')?.textContent ?? '');
  await page.evaluate(() => {
    document.querySelector('.interestseed-sprint-option')?.click();
    document.querySelector('[data-sprint-next]')?.click();
  });
  await page.waitForTimeout(300);
  rounds += 1;
  if (label.includes('生成草稿')) break;
}

await page.screenshot({ path: join(out, '27-seed-sprint-draft.png') });
const draftText = await page.locator('.modal').first().textContent();
const applied = await page.evaluate(() => {
  const button = [...document.querySelectorAll('.modal button')].find((item) => item.textContent === '把这些种子种进图谱');
  if (!button) return false;
  button.click();
  return true;
});
await page.waitForTimeout(700);
await page.screenshot({ path: join(out, '28-seed-sprint-done.png') });
const doneText = await page.locator('.modal').first().textContent();
await page.evaluate(() => {
  const button = [...document.querySelectorAll('.modal button')].find((item) => item.textContent === '查看我的图谱');
  button?.click();
});
await page.waitForTimeout(700);
const nodes = await page.evaluate(() => window.app.plugins.plugins.interestseed.store.listNodes().length);
await browser.close();
console.log(JSON.stringify({ rounds, draftHasSeeds: draftText.includes('种子'), applied, done: doneText.slice(0, 120), nodes }, null, 2));
