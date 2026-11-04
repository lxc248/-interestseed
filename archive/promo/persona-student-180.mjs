import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const out = 'C:\\Users\\30735\\Desktop\\interestseed\\review\\persona-student-1.8.0';
mkdirSync(out, { recursive: true });
const started = Date.now();
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = browser.contexts()[0].pages()[0];
const steps = [];
const mark = (name) => steps.push({ name, at: Date.now() - started });
const shot = async (name) => {
  await page.screenshot({ path: join(out, name) });
};

await page.evaluate(() => {
  const plugin = window.app.plugins.plugins.interestseed;
  plugin.inbox.load([]);
  plugin.openSeedSprint();
});
await page.waitForTimeout(500);
await shot('01-cold-start.png');
mark('cold-start-open');

await page.getByText('先跳过，记录一条', { exact: true }).click();
await page.waitForTimeout(350);
await shot('02-skip-to-spark.png');
mark('skip-to-spark');
const sparkOpen = await page.locator('.interestseed-spark').count();
await page.keyboard.press('Escape');
await page.waitForTimeout(250);

await page.evaluate(() => {
  const plugin = window.app.plugins.plugins.interestseed;
  plugin.enqueueShare('设计：为什么好海报先让人停下来 https://www.xiaohongshu.com/explore/student-one');
  plugin.openInbox();
});
await page.waitForTimeout(450);
await shot('03-inbox-list.png');
mark('inbox-list');

await page.getByText('留下并连接', { exact: true }).first().click();
await page.waitForTimeout(350);
await shot('04-keep-spark.png');
mark('keep-spark');
const sparkHasText = await page.locator('.interestseed-spark-input').inputValue();
await page.getByText('只是路过', { exact: true }).click();
await page.waitForTimeout(300);
const pendingAfterPass = await page.evaluate(() => window.app.plugins.plugins.interestseed.getPendingInboxItems().length);
mark('pass-without-write');

await page.evaluate(() => window.app.plugins.plugins.interestseed.openExperiment());
await page.waitForTimeout(350);
await shot('05-experiment-quick.png');
mark('experiment-quick-open');
const beforeLogs = await page.evaluate(() => window.app.plugins.plugins.interestseed.getActiveExperiment().state.logs.length);
await page.locator('.interestseed-experiment-quick-button.is-did').click();
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
  persona: '大三视觉设计学生（非技术）',
  sparkOpen,
  sparkHasText: sparkHasText.length > 0,
  pendingAfterPass,
  beforeLogs,
  afterLogs,
  restoredLogs,
  steps,
  totalMs: Date.now() - started,
}, null, 2));
console.log(JSON.stringify({ sparkOpen, pendingAfterPass, beforeLogs, afterLogs, restoredLogs, totalMs: Date.now() - started }));
