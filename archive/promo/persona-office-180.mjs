import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const out = 'C:\\Users\\30735\\Desktop\\interestseed\\review\\persona-office-1.8.0';
mkdirSync(out, { recursive: true });
const started = Date.now();
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = browser.contexts()[0].pages()[0];
const steps = [];
const mark = (name) => steps.push({ name, at: Date.now() - started });
const shot = async (name) => page.screenshot({ path: join(out, name) });

await page.evaluate(() => {
  const plugin = window.app.plugins.plugins.interestseed;
  plugin.inbox.load([]);
  plugin.enqueueShare('增长：先找到愿意付费的 10 个人 https://www.xiaohongshu.com/explore/office-one');
  plugin.enqueueShare('汇报：让老板做选择，而不是罗列工作 https://www.douyin.com/video/office-two');
  plugin.openInbox();
});
await page.waitForTimeout(500);
await shot('01-inbox-list.png');
mark('inbox-list');

await page.getByText('专注一条', { exact: true }).click();
await page.waitForTimeout(350);
await shot('02-focus-mode.png');
mark('focus-mode');

await page.locator('.interestseed-inbox-card').focus();
await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(350);
const pendingAfterSwipe = await page.evaluate(() => window.app.plugins.plugins.interestseed.getPendingInboxItems().length);
await shot('03-after-swipe.png');
mark('swipe-left');

await page.getByText('返回列表', { exact: true }).click();
await page.waitForTimeout(300);
await shot('04-back-to-list.png');
mark('back-to-list');

await page.getByText('留下并连接', { exact: true }).first().click();
await page.waitForTimeout(350);
await shot('05-keep-spark.png');
mark('keep-spark');
await page.keyboard.press('Escape');
await page.waitForTimeout(250);

await page.evaluate(() => window.app.plugins.plugins.interestseed.openExperiment());
await page.waitForTimeout(350);
await shot('06-experiment-quick.png');
mark('experiment-open');
const beforeLogs = await page.evaluate(() => window.app.plugins.plugins.interestseed.getActiveExperiment().state.logs.length);
await page.locator('.interestseed-experiment-quick-button.is-thought').click();
await page.waitForTimeout(300);
const afterLogs = await page.evaluate(() => window.app.plugins.plugins.interestseed.getActiveExperiment().state.logs.length);
await page.evaluate(() => window.app.plugins.plugins.interestseed.undo.undo());
await page.waitForTimeout(200);
const restoredLogs = await page.evaluate(() => window.app.plugins.plugins.interestseed.getActiveExperiment().state.logs.length);
mark('experiment-one-tap');
await page.keyboard.press('Escape');

await page.evaluate(async () => {
  const plugin = window.app.plugins.plugins.interestseed;
  await plugin.inbox.load([]);
  await plugin.saveSettings();
});
await browser.close();

writeFileSync(join(out, 'results.json'), JSON.stringify({
  persona: '工作 2–3 年的产品/运营上班族',
  pendingAfterSwipe,
  beforeLogs,
  afterLogs,
  restoredLogs,
  steps,
  totalMs: Date.now() - started,
}, null, 2));
console.log(JSON.stringify({ pendingAfterSwipe, beforeLogs, afterLogs, restoredLogs, totalMs: Date.now() - started }));
