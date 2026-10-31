import { chromium } from 'playwright-core';
import { join } from 'node:path';

const out = 'C:\\Users\\30735\\Desktop\\interestseed\\review\\experiment-3.0.8';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = browser.contexts()[0].pages()[0];

for (let index = 0; index < 8; index += 1) {
  const count = await page.locator('.modal').count();
  if (count === 0) break;
  await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('.modal button')];
    const close = buttons.find((button) => button.textContent === '取消' || button.textContent === '关闭' || button.textContent === '退出');
    if (close) close.click();
    else document.querySelector('.modal-close-button')?.click();
  });
  await page.waitForTimeout(250);
}
await page.waitForTimeout(300);

const before = await page.evaluate(() => window.app.plugins.plugins.interestseed.store.listNodes().length);
await page.evaluate(async () => window.app.commands.executeCommandById('interestseed:interestseed-seed-sprint'));
await page.waitForTimeout(500);
const modalCount = await page.locator('.modal').count();
await page.evaluate(() => {
  [...document.querySelectorAll('.modal button')].find((button) => button.textContent === '开始长出我的星图')?.click();
});
await page.waitForTimeout(400);

const labels = [];
for (let index = 0; index < 8; index += 1) {
  const hasNext = await page.evaluate(() => Boolean(document.querySelector('[data-sprint-next]')));
  if (!hasNext) break;
  const label = await page.evaluate(() => document.querySelector('[data-sprint-next]')?.textContent ?? '');
  labels.push(label);
  await page.evaluate(() => {
    document.querySelector('.interestseed-sprint-option')?.click();
  });
  await page.waitForTimeout(250);
  await page.evaluate(() => {
    document.querySelector('[data-sprint-next]')?.click();
  });
  await page.waitForTimeout(450);
  if (label.includes('生成草稿')) break;
}

await page.screenshot({ path: join(out, '27-seed-sprint-draft.png') });
const draft = await page.locator('.modal').first().textContent();
const applied = await page.evaluate(() => {
  const button = [...document.querySelectorAll('.modal button')].find((item) => item.textContent === '把这些种子种进图谱');
  if (!button) return false;
  button.click();
  return true;
});
await page.waitForTimeout(900);
await page.screenshot({ path: join(out, '28-seed-sprint-done.png') });
const done = await page.locator('.modal').first().textContent();
const doneButton = await page.evaluate(() => {
  const button = [...document.querySelectorAll('.modal button')].find((item) => item.textContent === '查看我的图谱');
  if (!button) return false;
  button.click();
  return true;
});
await page.waitForTimeout(700);
const after = await page.evaluate(() => window.app.plugins.plugins.interestseed.store.listNodes().length);
await browser.close();
console.log(JSON.stringify({ modalCount, labels, draftHasSeeds: draft.includes('种子'), applied, doneHasPlanted: done.includes('PLANTED'), doneButton, before, after }, null, 2));
