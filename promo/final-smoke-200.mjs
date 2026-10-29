import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const out = 'C:\\Users\\30735\\Desktop\\interestseed\\review\\2.0.0-smoke';
mkdirSync(out, { recursive: true });
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = browser.contexts()[0].pages()[0];
const errors = [];
const steps = [];
const shot = async (name) => page.screenshot({ path: join(out, name) });
page.on('pageerror', (error) => errors.push(String(error)));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});

await page.keyboard.press('Escape');
await page.evaluate(() => window.app.commands.executeCommandById('interestseed:interestseed-open'));
await page.waitForTimeout(600);
await shot('01-main.png');
steps.push('main');

await page.evaluate(() => window.app.plugins.plugins.interestseed.openSeedSprint());
await page.waitForTimeout(400);
await shot('02-cold-start.png');
steps.push('cold-start');
await page.getByText('先跳过，记录一条', { exact: true }).click();
await page.waitForTimeout(300);
await shot('03-skip-to-spark.png');
steps.push('skip');
await page.keyboard.press('Escape');
await page.waitForTimeout(200);

await page.evaluate(() => {
  const plugin = window.app.plugins.plugins.interestseed;
  plugin.inbox.load([]);
  plugin.enqueueShare('美妆：早八底妆不卡粉 https://www.douyin.com/video/smoke-1');
  plugin.enqueueShare('游戏：塞尔达为什么让我绕路 https://www.douyin.com/video/smoke-2');
  plugin.openInbox();
});
await page.waitForTimeout(450);
await shot('04-inbox-list.png');
steps.push('inbox-list');
await page.getByText('专注一条', { exact: true }).click();
await page.waitForTimeout(300);
await shot('05-inbox-focus.png');
steps.push('inbox-focus');
await page.keyboard.press('Escape');
await page.waitForTimeout(200);

await page.evaluate(() => window.app.plugins.plugins.interestseed.openExperiment());
await page.waitForTimeout(350);
await shot('06-experiment.png');
steps.push('experiment');
await page.keyboard.press('Escape');
await page.waitForTimeout(200);

await page.evaluate(() => window.app.plugins.plugins.interestseed.openShareCard());
await page.waitForTimeout(400);
await shot('07-share-card.png');
steps.push('share-card');
await page.keyboard.press('Escape');
await page.waitForTimeout(200);

await page.evaluate(() => window.app.commands.executeCommandById('interestseed:interestseed-overview'));
await page.waitForTimeout(500);
await shot('08-overview.png');
steps.push('overview');
await page.keyboard.press('Escape');
await page.waitForTimeout(200);

await page.evaluate(() => window.app.commands.executeCommandById('interestseed:interestseed-explorer'));
await page.waitForTimeout(500);
await shot('09-explorer.png');
steps.push('explorer');
await page.keyboard.press('Escape');
await page.waitForTimeout(200);

const state = await page.evaluate(() => {
  const plugin = window.app.plugins.plugins.interestseed;
  const graph = plugin.store.getGraph();
  const active = plugin.getActiveExperiment();
  return {
    nodes: graph.nodes.length,
    edges: graph.edges.length,
    pending: plugin.getPendingInboxItems().length,
    experimentLogs: active?.state.logs.length ?? 0,
  };
});
await page.evaluate(async () => {
  const plugin = window.app.plugins.plugins.interestseed;
  await plugin.inbox.load([]);
  await plugin.saveSettings();
});
await browser.close();
writeFileSync(join(out, 'results.json'), JSON.stringify({ steps, state, errors }, null, 2));
console.log(JSON.stringify({ steps, state, errors }));
