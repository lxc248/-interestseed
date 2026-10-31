import { chromium } from 'playwright-core';
import { copyFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const out = 'C:\\Users\\30735\\Desktop\\interestseed\\review\\experiment-3.0.8';
const graphFile = 'C:\\Users\\30735\\Documents\\Obsidian\\InterestSeed-4C11-Disposable\\.obsidian\\plugins\\interestseed\\graphs\\default.json';
copyFileSync(graphFile, join(out, 'graph-before-clear.json'));

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = browser.contexts()[0].pages()[0];
const shot = (name) => page.screenshot({ path: join(out, name) });
const results = [];

for (let index = 0; index < 8; index += 1) {
  if ((await page.locator('.modal').count()) === 0) break;
  await page.keyboard.press('Escape');
  await page.waitForTimeout(180);
}
await page.evaluate(async () => {
  const plugin = window.app.plugins.plugins.interestseed;
  await plugin.activateView();
  const leaves = window.app.workspace.getLeavesOfType('interestseed-graph-view');
  if (leaves[0]) {
    window.app.workspace.setActiveLeaf(leaves[0], { focus: true });
    await window.app.workspace.revealLeaf(leaves[0]);
  }
});
await page.waitForTimeout(500);

const before = await page.evaluate(() => window.app.plugins.plugins.interestseed.store.listNodes().length);
await page.evaluate(async () => window.app.commands.executeCommandById('interestseed:interestseed-clear'));
await page.waitForTimeout(400);
await shot('36-clear-confirm-fixed.png');
await page.evaluate(() => {
  [...document.querySelectorAll('.modal button')].find((button) => button.textContent === '清空')?.click();
});
await page.waitForTimeout(600);
const afterClear = await page.evaluate(() => window.app.plugins.plugins.interestseed.store.listNodes().length);
await shot('37-empty-graph.png');

await page.evaluate(async () => window.app.commands.executeCommandById('interestseed:interestseed-seed-sprint'));
await page.waitForTimeout(500);
await shot('38-seed-sprint-intro.png');
await page.evaluate(() => {
  [...document.querySelectorAll('.modal button')].find((button) => button.textContent === '开始长出我的星图')?.click();
});
await page.waitForTimeout(400);
for (let index = 0; index < 8; index += 1) {
  const hasNext = await page.evaluate(() => Boolean(document.querySelector('[data-sprint-next]')));
  if (!hasNext) break;
  await page.evaluate(() => document.querySelector('.interestseed-sprint-option')?.click());
  await page.waitForTimeout(220);
  const label = await page.evaluate(() => document.querySelector('[data-sprint-next]')?.textContent ?? '');
  await page.evaluate(() => document.querySelector('[data-sprint-next]')?.click());
  await page.waitForTimeout(400);
  if (label.includes('生成草稿')) break;
}
await shot('39-seed-sprint-draft.png');
await page.evaluate(() => {
  [...document.querySelectorAll('.modal button')].find((button) => button.textContent === '把这些种子种进图谱')?.click();
});
await page.waitForTimeout(800);
const afterSeed = await page.evaluate(() => window.app.plugins.plugins.interestseed.store.listNodes().length);
const doneText = await page.locator('.modal').first().textContent();
await shot('40-seed-sprint-done.png');
await page.evaluate(() => {
  [...document.querySelectorAll('.modal button')].find((button) => button.textContent === '查看我的图谱')?.click();
});
await page.waitForTimeout(700);
await shot('41-seed-planted-graph.png');

await browser.close();
const summary = { before, afterClear, afterSeed, doneHasPlanted: doneText.includes('PLANTED') };
writeFileSync(join(out, 'results-onboarding.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
