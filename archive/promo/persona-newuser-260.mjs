import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const out = 'C:\\Users\\30735\\Desktop\\interestseed\\review\\persona-newuser-2.6.0';
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
  await plugin.saveSettings();
  plugin.openSeedSprint();
});
await page.waitForTimeout(450);
await shot('01-cold-start.png');
mark('cold-start');
await page.getByText('先跳过，记录一条', { exact: true }).click();
await page.waitForTimeout(300);
const sparkOpen = await page.locator('.interestseed-spark').count();
await page.keyboard.press('Escape');
await page.waitForTimeout(250);
mark('skip-to-spark');

const fixture = await page.evaluate(async () => {
  const app = window.app;
  const file = app.vault.getMarkdownFiles().find((candidate) => candidate.path.includes('theme-b-two'))
    ?? app.vault.getMarkdownFiles()[0];
  await app.workspace.getLeaf().openFile(file);
  await app.commands.executeCommandById('interestseed:interestseed-note-inbox');
  return file.path;
});
await page.waitForTimeout(450);
await shot('02-source-inbox.png');
mark('note-to-inbox');
const sourceClickable = (await page.locator('.interestseed-inbox-source.is-link').count()) === 1;
if (sourceClickable) await page.locator('.interestseed-inbox-source.is-link').first().click();
await page.waitForTimeout(300);
const afterSource = await page.evaluate(() => ({
  active: window.app.workspace.getActiveFile()?.path,
  modal: Boolean(document.querySelector('.interestseed-inbox')),
}));
mark('source-open-original');

await page.evaluate(() => window.app.commands.executeCommandById('interestseed:interestseed-inbox'));
await page.waitForTimeout(300);
await page.getByText('留下并连接', { exact: true }).first().click();
await page.waitForTimeout(400);
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

await page.evaluate((value) => {
  const input = document.querySelector('.interestseed-search');
  if (!input) throw new Error('search input missing');
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}, 'theme-b-two');
await page.waitForTimeout(400);
const searchSummary = await page.locator('.interestseed-summary').textContent();
await page.evaluate(() => {
  const input = document.querySelector('.interestseed-search');
  if (input) { input.value = ''; input.dispatchEvent(new Event('input', { bubbles: true })); }
});
await page.waitForTimeout(350);
await shot('04-search.png');
mark('context-search');

await page.evaluate(() => window.app.plugins.plugins.interestseed.openExperiment());
await page.waitForTimeout(300);
await page.locator('.interestseed-experiment-quick-button.is-did').click();
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
  if (file) await app.workspace.getLeaf().openFile(file);
  return file ? { path: file.path, head: (await app.vault.cachedRead(file)).split('\n').slice(0, 12) } : null;
});
await shot('05-route.png');
mark('route');

const modes = await page.evaluate(async () => {
  const app = window.app;
  const plugin = app.plugins.plugins.interestseed;
  const leaf = app.workspace.getLeavesOfType('interestseed-graph-view')[0];
  const view = leaf?.view;
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
await shot('06-view-modes.png');
mark('view-modes');

await page.evaluate(async () => {
  const app = window.app;
  const plugin = app.plugins.plugins.interestseed;
  const created = plugin.store.listNodes().find((node) => node.metadata?.spark && String(node.metadata?.raw ?? '').includes('theme-b-two'));
  if (created) plugin.session.removeNode(created.id);
  const route = app.vault.getMarkdownFiles().find((file) => file.path.startsWith('InterestSeed/兴趣路线'));
  if (route) await app.vault.delete(route);
  await plugin.inbox.load([]);
  await plugin.saveSettings();
});
await browser.close();

const result = {
  persona: '第一次使用 InterestSeed 的视觉设计学生',
  sparkOpen,
  sourceClickable,
  afterSource,
  fixture,
  created,
  timelineCount,
  searchSummary,
  afterLogs,
  restoredLogs,
  route,
  modes,
  steps,
  totalMs: Date.now() - started,
};
writeFileSync(join(out, 'results.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
