import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const out = 'C:\\Users\\30735\\Desktop\\interestseed\\review\\persona-student-2.3.0';
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
  await plugin.saveSettings();
  plugin.openSeedSprint();
});
await page.waitForTimeout(450);
await shot('00-cold-start.png');
mark('cold-start-open');
await page.getByText('先跳过，记录一条', { exact: true }).click();
await page.waitForTimeout(350);
const sparkOpen = await page.locator('.interestseed-spark').count();
await shot('00b-skip-to-spark.png');
mark('skip-to-spark');
await page.keyboard.press('Escape');
await page.waitForTimeout(250);
const fixture = await page.evaluate(async () => {
  const app = window.app;
  const file = app.vault.getMarkdownFiles().find((candidate) => candidate.path.includes('theme-b-two'))
    ?? app.vault.getMarkdownFiles()[0];
  await app.workspace.getLeaf().openFile(file);
  await app.commands.executeCommandById('interestseed:interestseed-note-inbox');
  return file.path;
});
await page.waitForTimeout(450);
await shot('01-source-inbox.png');
mark('note-to-inbox');
const sourceLink = page.locator('.interestseed-inbox-source.is-link').first();
const sourceClickable = (await sourceLink.count()) === 1;
if (sourceClickable) await sourceLink.click();
await page.waitForTimeout(350);
const afterSource = await page.evaluate(() => ({
  active: window.app.workspace.getActiveFile()?.path,
  modal: Boolean(document.querySelector('.interestseed-inbox')),
}));
mark('source-open-original');

await page.evaluate(() => window.app.commands.executeCommandById('interestseed:interestseed-inbox'));
await page.waitForTimeout(350);
await page.getByText('留下并连接', { exact: true }).first().click();
await page.waitForTimeout(450);
await shot('02-keep-spark.png');
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
    sourceRef: node?.metadata?.contextSourceRef ?? null,
  };
});
await page.waitForTimeout(550);
const timelineCount = await page.locator('.interestseed-observation').count();
await shot('03-observation-timeline.png');
mark('observation-timeline');

await page.evaluate(() => window.app.commands.executeCommandById('interestseed:interestseed-route'));
await page.waitForTimeout(650);
const route = await page.evaluate(async () => {
  const app = window.app;
  const file = app.vault.getMarkdownFiles().find((candidate) => candidate.path.startsWith('InterestSeed/兴趣路线'));
  if (file) await app.workspace.getLeaf().openFile(file);
  return file ? { path: file.path, text: (await app.vault.cachedRead(file)).slice(0, 320) } : null;
});
await shot('04-interest-route.png');
mark('interest-route');

await page.evaluate(() => window.app.plugins.plugins.interestseed.openExperiment());
await page.waitForTimeout(350);
await page.locator('.interestseed-experiment-quick-button.is-did').click();
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
  const created = plugin.store.listNodes().find((node) => node.title.includes('theme-b-two') && node.metadata?.spark);
  if (created) plugin.session.removeNode(created.id);
  const route = app.vault.getMarkdownFiles().find((file) => file.path.startsWith('InterestSeed/兴趣路线'));
  if (route) await app.vault.delete(route);
  await plugin.inbox.load([]);
  await plugin.saveSettings();
});
await browser.close();

writeFileSync(join(out, 'results.json'), JSON.stringify({
  persona: '大三视觉设计学生（非技术）',
  fixture,
  sparkOpen,
  sourceClickable,
  afterSource,
  created,
  timelineCount,
  route,
  afterLogs,
  restoredLogs,
  steps,
  totalMs: Date.now() - started,
}, null, 2));
console.log(JSON.stringify({ sourceClickable, afterSource, created, timelineCount, routePath: route?.path ?? null, afterLogs, restoredLogs, totalMs: Date.now() - started }));
