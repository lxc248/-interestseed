import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const out = 'C:\\Users\\30735\\Desktop\\interestseed\\review\\experiment-3.0.8';
mkdirSync(out, { recursive: true });
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = browser.contexts()[0].pages()[0];
const results = [];

async function shot(name) {
  await page.screenshot({ path: join(out, name) });
}

async function activateGraph() {
  await page.evaluate(async () => {
    const plugin = window.app.plugins.plugins.interestseed;
    await plugin.activateView();
    const leaves = window.app.workspace.getLeavesOfType('interestseed-graph-view');
    if (leaves[0]) {
      window.app.workspace.setActiveLeaf(leaves[0], { focus: true });
      await window.app.workspace.revealLeaf(leaves[0]);
    }
  });
  await page.waitForTimeout(700);
}

async function run(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail });
  } catch (error) {
    results.push({ name, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}

await activateGraph();

await run('02 search and filters', async () => {
  await page.getByText('筛选', { exact: true }).first().click();
  await page.waitForTimeout(350);
  await shot('02a-filter-open.png');
  const search = page.locator('.interestseed-search:visible').first();
  await search.fill('theme');
  await page.waitForTimeout(400);
  await shot('02-search-theme.png');
  const summary = await page.locator('.interestseed-summary').first().textContent();
  await search.fill('');
  await page.waitForTimeout(250);
  const chip = page.locator('.interestseed-chip:visible').filter({ hasText: '主题' }).first();
  if (await chip.count()) {
    await chip.click();
    await page.waitForTimeout(300);
    await shot('02b-filter-topic.png');
    await chip.click();
  }
  return { summary };
});

await run('15 relation create and undo/redo', async () => {
  const data = await page.evaluate(async () => {
    const plugin = window.app.plugins.plugins.interestseed;
    const nodes = plugin.store.listNodes();
    const source = nodes.find((node) => node.title === '实验临时节点') ?? nodes[0];
    const target = nodes.find((node) => node.id !== source.id);
    if (!source || !target) return { error: 'missing nodes' };
    plugin.setSelectedNode(source.id);
    plugin.createRelation(source.id, target.id, '实验连接');
    await new Promise((resolve) => setTimeout(resolve, 250));
    const edge = plugin.store.listEdges().find((item) => item.source === source.id && item.target === target.id && item.relation === '实验连接');
    return { source: source.id, target: target.id, edge: edge?.id ?? null };
  });
  await page.waitForTimeout(350);
  await shot('15b-relation-created.png');
  if (!data.edge) return data;

  await page.evaluate(() => window.app.commands.executeCommandById('interestseed:interestseed-undo'));
  await page.waitForTimeout(300);
  const afterUndo = await page.evaluate((edgeId) => Boolean(window.app.plugins.plugins.interestseed.store.getEdge(edgeId)), data.edge);
  await page.evaluate(() => window.app.commands.executeCommandById('interestseed:interestseed-redo'));
  await page.waitForTimeout(300);
  const afterRedo = await page.evaluate((edgeId) => Boolean(window.app.plugins.plugins.interestseed.store.getEdge(edgeId)), data.edge);
  return { ...data, afterUndo, afterRedo };
});

await run('16 suggested edge confirm / reject / restore', async () => {
  const edgeId = await page.evaluate(() => {
    const plugin = window.app.plugins.plugins.interestseed;
    const edge = plugin.store.listEdges().find((item) => item.status === 'suggested');
    return edge?.id ?? null;
  });
  if (!edgeId) return { edgeId: null };
  const statuses = [];
  statuses.push(await page.evaluate((id) => window.app.plugins.plugins.interestseed.rejectEdge(id), edgeId));
  statuses.push(await page.evaluate((id) => window.app.plugins.plugins.interestseed.restoreEdge(id), edgeId));
  statuses.push(await page.evaluate((id) => window.app.plugins.plugins.interestseed.confirmEdge(id), edgeId));
  await page.waitForTimeout(300);
  await shot('15c-edge-actions.png');
  return { edgeId, statuses, final: await page.evaluate((id) => window.app.plugins.plugins.interestseed.store.getEdge(id)?.status, edgeId) };
});

await run('17 discovery feedback and undo', async () => {
  const data = await page.evaluate(async () => {
    const plugin = window.app.plugins.plugins.interestseed;
    const discovery = plugin.listDiscoveries()[0];
    if (!discovery) return { id: null };
    await plugin.setDiscoveryFeedback(discovery.id, 'accepted');
    const accepted = plugin.listDiscoveries().find((item) => item.id === discovery.id)?.feedbackStatus;
    await plugin.undoDiscoveryFeedback(discovery.id);
    const restored = plugin.listDiscoveries().find((item) => item.id === discovery.id)?.feedbackStatus;
    return { id: discovery.id, accepted, restored };
  });
  await shot('15d-discovery-feedback.png');
  return data;
});

await run('18 route and canvas content', async () => {
  const data = await page.evaluate(async () => {
    const plugin = window.app.plugins.plugins.interestseed;
    await plugin.createInterestRoute();
    await new Promise((resolve) => setTimeout(resolve, 800));
    const route = window.app.vault.getMarkdownFiles().filter((file) => file.path.includes('兴趣路线')).sort((a, b) => b.stat.mtime - a.stat.mtime)[0];
    const routeText = route ? await window.app.vault.read(route) : '';
    await plugin.exportJsonCanvas();
    await new Promise((resolve) => setTimeout(resolve, 500));
    const canvas = window.app.vault.getFiles().filter((file) => file.extension === 'canvas').sort((a, b) => b.stat.mtime - a.stat.mtime)[0];
    const canvasText = canvas ? await window.app.vault.read(canvas) : '';
    let canvasData = null;
    try { canvasData = JSON.parse(canvasText); } catch {}
    return {
      route: route?.path ?? null,
      routeHasNext: routeText.includes('下一步') || routeText.includes('Next'),
      routeLength: routeText.length,
      canvas: canvas?.path ?? null,
      canvasNodes: canvasData?.nodes?.length ?? 0,
      canvasEdges: canvasData?.edges?.length ?? 0,
      canvasUniqueIds: canvasData ? new Set(canvasData.nodes.map((node) => node.id)).size : 0,
    };
  });
  await activateGraph();
  return data;
});

await run('19 backup and retry', async () => {
  const data = await page.evaluate(async () => {
    const plugin = window.app.plugins.plugins.interestseed;
    const backup = await plugin.createBackup();
    const retry = await plugin.retrySave();
    return { backup, retry };
  });
  return data;
});

await run('20 destructive command confirmations only', async () => {
  await page.evaluate(async () => window.app.commands.executeCommandById('interestseed:interestseed-clear'));
  await page.waitForTimeout(400);
  await shot('23-clear-confirm.png');
  await page.getByText('取消', { exact: true }).first().click();
  await page.waitForTimeout(250);
  await page.evaluate(async () => window.app.commands.executeCommandById('interestseed:interestseed-repair-storage'));
  await page.waitForTimeout(400);
  await shot('24-repair-confirm.png');
  await page.getByText('取消', { exact: true }).first().click();
  await page.waitForTimeout(250);
  return { nodes: await page.evaluate(() => window.app.plugins.plugins.interestseed.store.listNodes().length) };
});

await run('21 disabled AI and save retry', async () => {
  await page.evaluate(async () => window.app.commands.executeCommandById('interestseed:interestseed-ai-expand'));
  await page.waitForTimeout(500);
  await shot('25-ai-disabled.png');
  return { notice: await page.locator('.notice').last().textContent().catch(() => '') };
});

writeFileSync(join(out, 'results-fixups.json'), JSON.stringify({ results }, null, 2));
await browser.close();
console.log(JSON.stringify({ results }, null, 2));
