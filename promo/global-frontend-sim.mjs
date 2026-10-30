import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outRoot = 'C:\\Users\\30735\\Desktop\\interestseed\\review\\global-frontend-sim';
mkdirSync(outRoot, { recursive: true });
const started = Date.now();
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = browser.contexts()[0].pages()[0];
const results = [];
const shot = (dir, name) => page.screenshot({ path: join(dir, name) });

async function reset() {
  for (let index = 0; index < 4; index += 1) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(120);
  }
  await page.evaluate(async () => {
    const plugin = window.app.plugins.plugins.interestseed;
    document.querySelectorAll('.modal-close-button').forEach((button) => button.click());
    for (const node of plugin.store.listNodes()) {
      if (node.metadata?.nextStep === true || node.metadata?.experimentState) {
        const metadata = { ...node.metadata };
        delete metadata.experimentState;
        delete metadata.experimentDay;
        delete metadata.experimentStatus;
        delete metadata.experimentLastCheckInAt;
        metadata.taskState = 'connected';
        plugin.store.updateNode(node.id, { metadata });
      }
    }
    await plugin.inbox.load([]);
    await plugin.saveSettings();
    const route = window.app.vault.getMarkdownFiles().find((f) => f.path.startsWith('InterestSeed/兴趣路线'));
    if (route) await window.app.vault.delete(route);
    const canvas = window.app.vault.getFiles().find((f) => f.path.startsWith('InterestSeed/兴趣图谱-') && f.path.endsWith('.canvas'));
    if (canvas) await window.app.vault.delete(canvas);
  });
}

async function openView() {
  await page.evaluate(async () => {
    await window.app.commands.executeCommandById('interestseed:interestseed-open');
  });
  await page.waitForTimeout(600);
}

async function newJourney(dir) {
  await reset();
  await page.evaluate(() => window.app.plugins.plugins.interestseed.openSeedSprint());
  await page.waitForTimeout(400);
  await shot(dir, '01-onboarding.png');
  await page.getByText('先跳过，记录一条', { exact: true }).first().click();
  await page.waitForTimeout(250);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  const fixture = await page.evaluate(async () => {
    const app = window.app;
    const file = app.vault.getMarkdownFiles().find((c) => c.path.includes('theme-b-two'));
    if (file) await app.workspace.getLeaf().openFile(file);
    await app.commands.executeCommandById('interestseed:interestseed-note-inbox');
    return file?.path ?? '';
  });
  await page.waitForTimeout(400);
  await page.getByText('留下并连接', { exact: true }).first().click();
  await page.waitForTimeout(300);
  await page.getByText('留下这个火花', { exact: true }).first().click();
  await page.waitForTimeout(500);
  const created = await page.evaluate(async () => {
    const plugin = window.app.plugins.plugins.interestseed;
    const id = plugin.getSelectedNodeId();
    await plugin.activateView();
    const leaf = window.app.workspace.getLeavesOfType('interestseed-graph-view')[0];
    if (leaf && typeof leaf.view.select === 'function' && id) leaf.view.select(id);
    return id;
  });
  await page.waitForTimeout(350);
  await shot(dir, '02-timeline.png');
  await page.evaluate(() => {
    const input = document.querySelector('.interestseed-search');
    if (input) { input.value = 'theme-b-two'; input.dispatchEvent(new Event('input', { bubbles: true })); }
  });
  await page.waitForTimeout(350);
  const summary = await page.locator('.interestseed-summary').textContent();
  await page.evaluate(() => {
    const input = document.querySelector('.interestseed-search');
    if (input) { input.value = ''; input.dispatchEvent(new Event('input', { bubbles: true })); }
  });
  await page.waitForTimeout(250);
  await page.evaluate(() => window.app.plugins.plugins.interestseed.openExperiment());
  await page.waitForTimeout(300);
  await page.locator('.interestseed-experiment-quick-button.is-did').click();
  await page.waitForTimeout(200);
  const logs = await page.evaluate(() => window.app.plugins.plugins.interestseed.getActiveExperiment().state.logs.length);
  await page.evaluate(() => window.app.plugins.plugins.interestseed.undo.undo());
  await page.waitForTimeout(150);
  const restored = await page.evaluate(() => window.app.plugins.plugins.interestseed.getActiveExperiment().state.logs.length);
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.app.commands.executeCommandById('interestseed:interestseed-route'));
  await page.waitForTimeout(450);
  await page.evaluate(() => window.app.commands.executeCommandById('interestseed:interestseed-canvas-export'));
  await page.waitForTimeout(500);
  const canvas = await page.evaluate(async () => {
    const f = window.app.vault.getFiles().find((x) => x.path.startsWith('InterestSeed/兴趣图谱-') && x.path.endsWith('.canvas'));
    if (!f) return null;
    const raw = await window.app.vault.cachedRead(f);
    const j = JSON.parse(raw);
    return { path: f.path, nodes: j.nodes?.length ?? 0, edges: j.edges?.length ?? 0 };
  });
  await shot(dir, '03-canvas.png');
  await page.evaluate(async () => {
    const plugin = window.app.plugins.plugins.interestseed;
    const created = plugin.store.listNodes().find((n) => n.metadata?.spark && String(n.metadata?.raw ?? '').includes('theme-b-two'));
    if (created) plugin.session.removeNode(created.id);
  });
  return { fixture, created, summary, logs, restored, canvas };
}

async function returningJourney(dir) {
  await reset();
  await page.evaluate(() => {
    const plugin = window.app.plugins.plugins.interestseed;
    plugin.enqueueShare('增长：先找到愿意付费的 10 个人 https://www.xiaohongshu.com/explore/global-one');
    plugin.enqueueShare('汇报：让老板做选择 https://www.douyin.com/video/global-two');
    plugin.openInbox();
  });
  await page.waitForTimeout(400);
  await shot(dir, '01-inbox.png');
  await page.getByText('专注一条', { exact: true }).first().click();
  await page.waitForTimeout(250);
  await page.locator('.interestseed-inbox-card').focus();
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(250);
  const pending = await page.evaluate(() => window.app.plugins.plugins.interestseed.getPendingInboxItems().length);
  await page.getByText('返回列表', { exact: true }).first().click();
  await page.waitForTimeout(200);
  await page.getByText('留下并连接', { exact: true }).first().click();
  await page.waitForTimeout(250);
  await page.getByText('留下这个火花', { exact: true }).first().click();
  await page.waitForTimeout(450);
  const created = await page.evaluate(async () => {
    const plugin = window.app.plugins.plugins.interestseed;
    const id = plugin.getSelectedNodeId();
    await plugin.activateView();
    const leaf = window.app.workspace.getLeavesOfType('interestseed-graph-view')[0];
    if (leaf && typeof leaf.view.select === 'function' && id) leaf.view.select(id);
    return id;
  });
  await page.waitForTimeout(300);
  await shot(dir, '02-graph.png');
  const focus = await page.evaluate(() => {
    const plugin = window.app.plugins.plugins.interestseed;
    const view = window.app.workspace.getLeavesOfType('interestseed-graph-view')[0]?.view;
    const nodes = plugin.store.listNodes();
    const node = nodes.find((n) => plugin.store.degree(n.id) > 0) ?? nodes[0];
    view?.select(node.id);
    return { id: node.id, neighbors: view?.canvas?.focusNeighbors?.size ?? 0 };
  });
  await page.waitForTimeout(250);
  await shot(dir, '03-focus.png');
  await page.evaluate(() => {
    const plugin = window.app.plugins.plugins.interestseed;
    const created = plugin.store.listNodes().find((n) => n.metadata?.spark && String(n.metadata?.raw ?? '').includes('global-one'));
    if (created) plugin.session.removeNode(created.id);
  });
  return { pending, created, focus };
}

const scenarios = [
  { name: 'new-light-native', theme: 'light', width: 1707, height: 1019, journey: 'new' },
  { name: 'returning-light-narrow', theme: 'light', width: 420, height: 900, journey: 'returning' },
  { name: 'returning-dark-medium', theme: 'dark', width: 900, height: 1200, journey: 'returning' },
];

for (const scenario of scenarios) {
  const dir = join(outRoot, scenario.name);
  mkdirSync(dir, { recursive: true });
  await page.setViewportSize({ width: scenario.width, height: scenario.height });
  await page.evaluate(async (theme) => {
    await window.app.setTheme(theme);
  }, scenario.theme);
  await page.waitForTimeout(500);
  await openView();
  const errors = [];
  try {
    const data = scenario.journey === 'new'
      ? await newJourney(dir)
      : await returningJourney(dir);
    results.push({ scenario: scenario.name, ok: true, errors, ...data });
  } catch (error) {
    results.push({ scenario: scenario.name, ok: false, errors: [String(error?.stack || error)] });
  }
}

await page.evaluate(async () => {
  await window.app.setTheme('light');
});
await page.setViewportSize({ width: 1707, height: 1019 });
await reset();
await browser.close();

writeFileSync(join(outRoot, 'results.json'), JSON.stringify({ results, totalMs: Date.now() - started }, null, 2));
console.log(JSON.stringify(results, null, 2));
