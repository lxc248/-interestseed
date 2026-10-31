import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const out = 'C:\\Users\\30735\\Desktop\\interestseed\\review\\experiment-3.0.8';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = browser.contexts()[0].pages()[0];
const results = [];
const shot = (name) => page.screenshot({ path: join(out, name) });
const run = async (name, fn) => {
  try { results.push({ name, ok: true, detail: await fn() }); }
  catch (error) { results.push({ name, ok: false, error: error instanceof Error ? error.message : String(error) }); }
};

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

await run('gap coach', async () => {
  const opened = await page.evaluate(() => {
    const plugin = window.app.plugins.plugins.interestseed;
    const insight = plugin.getInsights().insights[0];
    if (!insight) return false;
    plugin.openGapCoach(insight);
    return true;
  });
  await page.waitForTimeout(450);
  await shot('42-gap-coach.png');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  return { opened };
});

await run('reconcile discoveries', async () => {
  await page.evaluate(async () => window.app.commands.executeCommandById('interestseed:interestseed-reconcile-discoveries'));
  await page.waitForTimeout(700);
  await shot('43-reconcile.png');
  return { notice: await page.locator('.notice').last().textContent().catch(() => '') };
});

await run('quick check-in limits', async () => {
  const data = await page.evaluate(() => {
    const plugin = window.app.plugins.plugins.interestseed;
    return {
      thought: plugin.recordQuickExperiment('thought'),
      missed: plugin.recordQuickExperiment('missed'),
      extend: plugin.extendExperimentToSeven(),
      logs: plugin.getActiveExperiment()?.state.logs.length ?? 0,
    };
  });
  await shot('44-quick-limits.png');
  return data;
});

await run('edit relation and delete edge undo', async () => {
  const data = await page.evaluate(async () => {
    const plugin = window.app.plugins.plugins.interestseed;
    const nodes = plugin.store.listNodes();
    const source = nodes[0];
    const target = nodes.find((node) => node.id !== source.id);
    const relation = `可编辑关系-${Date.now()}`;
    plugin.createRelation(source.id, target.id, relation);
    await new Promise((resolve) => setTimeout(resolve, 250));
    const edge = plugin.store.listEdges().find((item) => item.relation === relation);
    return { edge: edge?.id ?? null, relation };
  });
  if (data.edge) {
    await page.evaluate((id) => window.app.plugins.plugins.interestseed.promptEditRelation(id), data.edge);
    await page.waitForTimeout(400);
    await shot('45-edit-relation.png');
    await page.evaluate(() => {
      const input = document.querySelector('.modal input[type="text"]');
      if (input) {
        input.value = '编辑后的关系';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      [...document.querySelectorAll('.modal button')].find((button) => button.textContent === '保存')?.click();
    });
    await page.waitForTimeout(400);
    const renamed = await page.evaluate((id) => window.app.plugins.plugins.interestseed.store.getEdge(id)?.relation, data.edge);
    await page.evaluate((id) => window.app.plugins.plugins.interestseed.deleteEdge(id), data.edge);
    await page.waitForTimeout(300);
    const afterDelete = await page.evaluate((id) => Boolean(window.app.plugins.plugins.interestseed.store.getEdge(id)), data.edge);
    await page.evaluate(() => window.app.commands.executeCommandById('interestseed:interestseed-undo'));
    await page.waitForTimeout(300);
    const afterUndo = await page.evaluate((id) => Boolean(window.app.plugins.plugins.interestseed.store.getEdge(id)), data.edge);
    return { ...data, renamed, afterDelete, afterUndo };
  }
  return data;
});

await run('delete node confirmation only', async () => {
  const nodeId = await page.evaluate(() => {
    const plugin = window.app.plugins.plugins.interestseed;
    const node = plugin.store.listNodes().find((item) => item.title === '实验临时节点');
    if (!node) return null;
    plugin.deleteNode(node.id);
    return node.id;
  });
  await page.waitForTimeout(450);
  await shot('46-delete-node-confirm.png');
  await page.evaluate(() => {
    [...document.querySelectorAll('.modal button')].find((button) => button.textContent === '取消')?.click();
  });
  await page.waitForTimeout(300);
  return { nodeId, exists: nodeId ? await page.evaluate((id) => Boolean(window.app.plugins.plugins.interestseed.store.getNode(id)), nodeId) : null };
});

writeFileSync(join(out, 'results-fixups-5.json'), JSON.stringify({ results }, null, 2));
await browser.close();
console.log(JSON.stringify({ results }, null, 2));
