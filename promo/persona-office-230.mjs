import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const out = 'C:\\Users\\30735\\Desktop\\interestseed\\review\\persona-office-2.3.0';
mkdirSync(out, { recursive: true });
const started = Date.now();
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = browser.contexts()[0].pages()[0];
const steps = [];
const mark = (name) => steps.push({ name, at: Date.now() - started });
const shot = async (name) => page.screenshot({ path: join(out, name) });

await page.evaluate(async () => {
  const plugin = window.app.plugins.plugins.interestseed;
  await plugin.inbox.load([]);
  plugin.enqueueShare('增长：先找到愿意付费的 10 个人 https://www.xiaohongshu.com/explore/office-230-one');
  plugin.enqueueShare('汇报：让老板做选择，而不是罗列工作 https://www.douyin.com/video/office-230-two');
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
await page.getByText('留下并连接', { exact: true }).first().click();
await page.waitForTimeout(350);
await shot('04-keep-spark.png');
mark('keep-spark');
await page.getByText('留下这个火花', { exact: true }).click();
await page.waitForTimeout(700);

const created = await page.evaluate(async () => {
  const plugin = window.app.plugins.plugins.interestseed;
  const id = plugin.getSelectedNodeId();
  const node = id ? plugin.store.getNode(id) : null;
  await plugin.activateView();
  const leaf = window.app.workspace.getLeavesOfType('interestseed-graph-view')[0];
  if (leaf && typeof leaf.view.select === 'function' && id) leaf.view.select(id);
  return {
    id,
    observations: node?.metadata?.observations?.length ?? 0,
    source: node?.metadata?.contextSource ?? null,
  };
});
await page.waitForTimeout(500);
const timelineCount = await page.locator('.interestseed-observation').count();
await shot('05-observation-timeline.png');
mark('observation-timeline');

await page.evaluate(() => window.app.commands.executeCommandById('interestseed:interestseed-route'));
await page.waitForTimeout(650);
const route = await page.evaluate(async () => {
  const app = window.app;
  const file = app.vault.getMarkdownFiles().find((candidate) => candidate.path.startsWith('InterestSeed/兴趣路线'));
  if (file) await app.workspace.getLeaf().openFile(file);
  return file ? { path: file.path, text: (await app.vault.cachedRead(file)).slice(0, 320) } : null;
});
await shot('06-interest-route.png');
mark('interest-route');

await page.evaluate(() => window.app.plugins.plugins.interestseed.openExperiment());
await page.waitForTimeout(350);
await page.locator('.interestseed-experiment-quick-button.is-thought').click();
await page.waitForTimeout(300);
const afterLogs = await page.evaluate(() => window.app.plugins.plugins.interestseed.getActiveExperiment().state.logs.length);
await page.evaluate(() => window.app.plugins.plugins.interestseed.undo.undo());
await page.waitForTimeout(250);
const restoredLogs = await page.evaluate(() => window.app.plugins.plugins.interestseed.getActiveExperiment().state.logs.length);
mark('experiment-one-tap');
await page.keyboard.press('Escape');

await page.evaluate(async () => {
  const app = window.app;
  const plugin = app.plugins.plugins.interestseed;
  const created = plugin.store.listNodes().find((node) => node.metadata?.spark && node.metadata?.raw?.includes('office-230'));
  if (created) plugin.session.removeNode(created.id);
  const route = app.vault.getMarkdownFiles().find((file) => file.path.startsWith('InterestSeed/兴趣路线'));
  if (route) await app.vault.delete(route);
  await plugin.inbox.load([]);
  await plugin.saveSettings();
});
await browser.close();

writeFileSync(join(out, 'results.json'), JSON.stringify({
  persona: '工作 2–3 年的产品/运营上班族',
  pendingAfterSwipe,
  created,
  timelineCount,
  route,
  afterLogs,
  restoredLogs,
  steps,
  totalMs: Date.now() - started,
}, null, 2));
console.log(JSON.stringify({ pendingAfterSwipe, created, timelineCount, routePath: route?.path ?? null, afterLogs, restoredLogs, totalMs: Date.now() - started }));
