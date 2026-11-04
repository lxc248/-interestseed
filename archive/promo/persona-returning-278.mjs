import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const out = 'C:\\Users\\30735\\Desktop\\interestseed\\review\\persona-returning-2.7.8';
mkdirSync(out, { recursive: true });
const started = Date.now();
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = browser.contexts()[0].pages()[0];
const steps = [];
const mark = (name) => steps.push({ name, at: Date.now() - started });
const shot = (name) => page.screenshot({ path: join(out, name) });

await page.evaluate(async () => {
  const plugin = window.app.plugins.plugins.interestseed;
  await plugin.inbox.load([]);
  plugin.enqueueShare('增长：先找到愿意付费的 10 个人 https://www.xiaohongshu.com/explore/return278-one');
  plugin.enqueueShare('汇报：让老板做选择，而不是罗列工作 https://www.douyin.com/video/return278-two');
  plugin.openInbox();
});
await page.waitForTimeout(450);
await shot('01-inbox-list.png');
mark('inbox-list');
await page.getByText('专注一条', { exact: true }).click();
await page.waitForTimeout(300);
await shot('02-focus-mode.png');
mark('focus-mode');
await page.locator('.interestseed-inbox-card').focus();
await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(300);
const pendingAfterSwipe = await page.evaluate(() => window.app.plugins.plugins.interestseed.getPendingInboxItems().length);
mark('swipe-left');
await page.getByText('返回列表', { exact: true }).click();
await page.waitForTimeout(250);
await page.getByText('留下并连接', { exact: true }).first().click();
await page.waitForTimeout(300);
await page.getByText('留下这个火花', { exact: true }).click();
await page.waitForTimeout(600);
const created = await page.evaluate(async () => {
  const plugin = window.app.plugins.plugins.interestseed;
  const id = plugin.getSelectedNodeId();
  await plugin.activateView();
  const leaf = window.app.workspace.getLeavesOfType('interestseed-graph-view')[0];
  if (leaf && typeof leaf.view.select === 'function' && id) leaf.view.select(id);
  return id;
});
await page.waitForTimeout(400);
const timelineCount = await page.locator('.interestseed-observation').count();
await shot('03-timeline.png');
mark('timeline');

await page.evaluate(() => {
  const input = document.querySelector('.interestseed-search');
  if (input) {
    input.value = 'return278-one';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
});
await page.waitForTimeout(400);
const searchSummary = await page.locator('.interestseed-summary').textContent();
await page.evaluate(() => {
  const input = document.querySelector('.interestseed-search');
  if (input) {
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
});
await page.waitForTimeout(300);
await shot('04-search.png');
mark('context-search');

await page.evaluate(() => window.app.plugins.plugins.interestseed.openExperiment());
await page.waitForTimeout(300);
await page.locator('.interestseed-experiment-quick-button.is-thought').click();
await page.waitForTimeout(250);
const afterLogs = await page.evaluate(() => window.app.plugins.plugins.interestseed.getActiveExperiment().state.logs.length);
await page.evaluate(() => window.app.plugins.plugins.interestseed.undo.undo());
await page.waitForTimeout(200);
const restoredLogs = await page.evaluate(() => window.app.plugins.plugins.interestseed.getActiveExperiment().state.logs.length);
await page.keyboard.press('Escape');
mark('experiment');

await page.evaluate(() => window.app.commands.executeCommandById('interestseed:interestseed-route'));
await page.waitForTimeout(550);
const route = await page.evaluate(async () => {
  const app = window.app;
  const file = app.vault.getMarkdownFiles().find((candidate) => candidate.path.startsWith('InterestSeed/兴趣路线'));
  if (!file) return null;
  const head = (await app.vault.cachedRead(file)).split('\n').slice(0, 10);
  return { path: file.path, head };
});
await shot('05-route.png');
mark('route');

await page.evaluate(() => window.app.commands.executeCommandById('interestseed:interestseed-canvas-export'));
await page.waitForTimeout(600);
const canvasExport = await page.evaluate(async () => {
  const app = window.app;
  const file = app.vault.getFiles().find((candidate) => candidate.path.startsWith('InterestSeed/兴趣图谱-') && candidate.path.endsWith('.canvas'));
  if (!file) return null;
  const raw = await app.vault.cachedRead(file);
  let parsed = null;
  try { parsed = JSON.parse(raw); } catch { parsed = null; }
  return { path: file.path, nodes: parsed?.nodes?.length ?? 0, edges: parsed?.edges?.length ?? 0 };
});
await shot('06-canvas.png');
mark('canvas-export');

const focus = await page.evaluate(() => {
  const app = window.app;
  const plugin = app.plugins.plugins.interestseed;
  const view = app.workspace.getLeavesOfType('interestseed-graph-view')[0]?.view;
  const nodes = plugin.store.listNodes();
  const node = nodes.find((candidate) => plugin.store.degree(candidate.id) > 0) ?? nodes[0];
  view?.select(node.id);
  return { selected: node.id, neighbors: view?.canvas?.focusNeighbors?.size ?? 0 };
});
await page.waitForTimeout(350);
await shot('07-focus-emphasis.png');
mark('focus-emphasis');
await page.evaluate(() => {
  const view = window.app.workspace.getLeavesOfType('interestseed-graph-view')[0]?.view;
  view?.select(null);
});

const modes = await page.evaluate(() => {
  const app = window.app;
  const plugin = app.plugins.plugins.interestseed;
  const view = app.workspace.getLeavesOfType('interestseed-graph-view')[0]?.view;
  const node = plugin.store.listNodes()[0];
  view?.toggleInbox();
  const relationTitle = document.querySelector('.interestseed-detail-title')?.textContent;
  view?.select(node.id);
  const nodeTitle = document.querySelector('.interestseed-detail-title')?.textContent;
  view?.toggleDiscoveries();
  const discoveryVisible = !document.querySelector('.interestseed-discovery-panel')?.classList.contains('is-hidden');
  view?.select(node.id);
  const discoveryHidden = document.querySelector('.interestseed-discovery-panel')?.classList.contains('is-hidden');
  return { relationTitle, nodeTitle, discoveryVisible, discoveryHidden };
});
await page.waitForTimeout(250);
await shot('08-view-modes.png');
mark('view-modes');

await page.evaluate(async () => {
  const app = window.app;
  const plugin = app.plugins.plugins.interestseed;
  const created = plugin.store.listNodes().find(
    (node) => node.metadata?.spark && String(node.metadata?.raw ?? '').includes('return278-one'),
  );
  if (created) plugin.session.removeNode(created.id);
  const route = app.vault.getMarkdownFiles().find((file) => file.path.startsWith('InterestSeed/兴趣路线'));
  if (route) await app.vault.delete(route);
  const canvas = app.vault.getFiles().find((file) => file.path.startsWith('InterestSeed/兴趣图谱-') && file.path.endsWith('.canvas'));
  if (canvas) await app.vault.delete(canvas);
  await plugin.inbox.load([]);
  await plugin.saveSettings();
});
await browser.close();

const result = {
  persona: '工作 2–3 年的产品/运营上班族，回访用户',
  pendingAfterSwipe,
  created,
  timelineCount,
  searchSummary,
  afterLogs,
  restoredLogs,
  route,
  canvasExport,
  focus,
  modes,
  steps,
  totalMs: Date.now() - started,
};
writeFileSync(join(out, 'results.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
