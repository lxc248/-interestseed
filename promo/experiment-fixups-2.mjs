import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const out = 'C:\\Users\\30735\\Desktop\\interestseed\\review\\experiment-3.0.8';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = browser.contexts()[0].pages()[0];
const results = [];

async function shot(name) {
  await page.screenshot({ path: join(out, name) });
}
async function run(name, fn) {
  try {
    results.push({ name, ok: true, detail: await fn() });
  } catch (error) {
    results.push({ name, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
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
await page.waitForTimeout(600);

await run('relation unique undo/redo', async () => {
  const data = await page.evaluate(async () => {
    const plugin = window.app.plugins.plugins.interestseed;
    const nodes = plugin.store.listNodes();
    const source = nodes[0];
    const target = nodes.find((node) => node.id !== source.id);
    const relation = `实验连接-${Date.now()}`;
    plugin.createRelation(source.id, target.id, relation);
    await new Promise((resolve) => setTimeout(resolve, 250));
    const edge = plugin.store.listEdges().find((item) => item.relation === relation);
    return { edge: edge?.id ?? null, relation, nodes: nodes.length };
  });
  if (!data.edge) return data;
  await page.evaluate(() => window.app.commands.executeCommandById('interestseed:interestseed-undo'));
  await page.waitForTimeout(300);
  const afterUndo = await page.evaluate((id) => Boolean(window.app.plugins.plugins.interestseed.store.getEdge(id)), data.edge);
  await page.evaluate(() => window.app.commands.executeCommandById('interestseed:interestseed-redo'));
  await page.waitForTimeout(300);
  const afterRedo = await page.evaluate((id) => Boolean(window.app.plugins.plugins.interestseed.store.getEdge(id)), data.edge);
  return { ...data, afterUndo, afterRedo };
});

await run('clear graph requires confirmation', async () => {
  const before = await page.evaluate(() => window.app.plugins.plugins.interestseed.store.listNodes().length);
  await page.evaluate(async () => window.app.commands.executeCommandById('interestseed:interestseed-clear'));
  await page.waitForTimeout(400);
  await shot('23-clear-confirm.png');
  const modalText = await page.locator('.modal').first().textContent();
  await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('.modal button')];
    buttons.find((button) => button.textContent === '取消')?.click();
  });
  await page.waitForTimeout(350);
  const afterCancel = await page.evaluate(() => window.app.plugins.plugins.interestseed.store.listNodes().length);
  return { before, afterCancel, modalText };
});

await run('repair storage safe state', async () => {
  await page.evaluate(async () => window.app.commands.executeCommandById('interestseed:interestseed-repair-storage'));
  await page.waitForTimeout(500);
  await shot('24-repair-confirm.png');
  const modals = await page.locator('.modal').count();
  if (modals > 0) {
    await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('.modal button')];
      buttons.find((button) => button.textContent === '取消')?.click();
    });
  }
  const notice = await page.locator('.notice').last().textContent().catch(() => '');
  return { modals, notice, nodes: await page.evaluate(() => window.app.plugins.plugins.interestseed.store.listNodes().length) };
});

writeFileSync(join(out, 'results-fixups-2.json'), JSON.stringify({ results }, null, 2));
await browser.close();
console.log(JSON.stringify({ results }, null, 2));
