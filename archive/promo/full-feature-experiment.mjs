import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const out = 'C:\\Users\\30735\\Desktop\\interestseed\\review\\experiment-3.0.8';
mkdirSync(out, { recursive: true });
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = browser.contexts()[0].pages()[0];
const results = [];
const started = Date.now();

async function shot(name) {
  await page.screenshot({ path: join(out, name) });
}

async function run(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail });
  } catch (error) {
    results.push({ name, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}

async function closeModals() {
  for (let index = 0; index < 3; index += 1) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(120);
  }
  const leftovers = await page.locator('.modal').count();
  if (leftovers > 0) {
    await page.evaluate(() => {
      document.querySelectorAll('.modal-close-button').forEach((button) => button.click());
    });
    await page.waitForTimeout(200);
  }
}

async function cmd(id) {
  await page.evaluate(async (commandId) => {
    await window.app.commands.executeCommandById(`interestseed:${commandId}`);
  }, id);
  await page.waitForTimeout(450);
}

async function state() {
  return page.evaluate(() => {
    const plugin = window.app.plugins.plugins.interestseed;
    const graph = plugin.store.getGraph();
    return {
      nodes: graph.nodes.length,
      edges: graph.edges.length,
      pending: plugin.getPendingInboxItems().length,
      logs: plugin.getActiveExperiment()?.state.logs.length ?? 0,
      discoveries: plugin.listDiscoveries().length,
    };
  });
}

await page.setViewportSize({ width: 1707, height: 1019 });
await closeModals();

await run('01 graph overview', async () => {
  await cmd('interestseed-open');
  await page.waitForTimeout(500);
  await shot('01-graph-overview.png');
  return state();
});

await run('02 search and filter', async () => {
  const search = page.locator('.interestseed-search').first();
  await search.fill('theme');
  await page.waitForTimeout(350);
  await shot('02-search-theme.png');
  const summary = await page.locator('.interestseed-summary').first().textContent();
  await search.fill('');
  return { summary };
});

await run('03 node detail and observation timeline', async () => {
  const id = await page.evaluate(() => {
    const plugin = window.app.plugins.plugins.interestseed;
    const node = plugin.store.listNodes().find((candidate) => candidate.title.includes('Theme B')) ?? plugin.store.listNodes()[0];
    plugin.setSelectedNode(node.id);
    return node.id;
  });
  await page.waitForTimeout(500);
  await shot('03-detail-timeline.png');
  return { id, detailVisible: (await page.locator('.interestseed-detail').count()) > 0 };
});

await run('04 share card five presets', async () => {
  await cmd('interestseed-share-card');
  await page.waitForTimeout(600);
  await shot('04-share-card-modal.png');
  const platforms = page.locator('.interestseed-share-platform');
  const names = ['xiaohongshu', 'instagram', 'x', 'wechat', 'story'];
  const count = await platforms.count();
  for (let index = 0; index < count; index += 1) {
    await platforms.nth(index).click();
    await page.waitForTimeout(250);
    const canvas = page.locator('.interestseed-share-preview canvas').first();
    await canvas.screenshot({ path: join(out, `05-share-${names[index] ?? index}.png`) });
  }
  await closeModals();
  return { presets: count };
});

await run('05 inbox list and focus', async () => {
  await page.evaluate(async () => {
    const plugin = window.app.plugins.plugins.interestseed;
    await plugin.inbox.load([]);
    plugin.enqueueShare('https://www.xiaohongshu.com/explore/experiment-a', 'share', 'https://www.xiaohongshu.com/explore/experiment-a');
    plugin.enqueueShare('我最近总在想：为什么有些内容看完就想做，有些看完只想收藏？', 'share');
    plugin.enqueueShare('https://www.bilibili.com/video/BV1experiment', 'share', 'https://www.bilibili.com/video/BV1experiment');
    plugin.openInbox();
  });
  await page.waitForTimeout(500);
  await shot('06-inbox-list.png');
  await page.getByText('专注一条', { exact: true }).first().click();
  await page.waitForTimeout(350);
  await shot('07-inbox-focus.png');
  return state();
});

await run('06 inbox pass and keep', async () => {
  await page.getByText('只是路过', { exact: true }).first().click();
  await page.waitForTimeout(350);
  const afterPass = await state();
  await page.getByText('留下并连接', { exact: true }).first().click();
  await page.waitForTimeout(450);
  await shot('08-spark-from-inbox.png');
  await page.locator('.interestseed-spark-input').fill('我想验证：把复杂想法讲清楚，是否真的有人愿意听。');
  await page.getByText('留下这个火花', { exact: true }).first().click();
  await page.waitForTimeout(500);
  return { afterPass, afterKeep: await state() };
});

await run('07 standalone spark capture', async () => {
  await closeModals();
  await cmd('interestseed-spark');
  await page.waitForTimeout(300);
  await shot('09-spark-capture.png');
  await page.locator('.interestseed-spark-input').fill('一个让我停下来的观察：我对“让人愿意开始”这件事，似乎比工具本身更感兴趣。');
  await page.getByText('留下这个火花', { exact: true }).first().click();
  await page.waitForTimeout(450);
  return state();
});

await run('08 experiment modal and quick check-in', async () => {
  await closeModals();
  const startedExperiment = await page.evaluate(() => {
    const plugin = window.app.plugins.plugins.interestseed;
    const node = plugin.store.listNodes().find((candidate) => !candidate.metadata?.spark) ?? plugin.store.listNodes()[0];
    plugin.setSelectedNode(node.id);
    return plugin.startStarterExperiment();
  });
  await cmd('interestseed-experiment');
  await page.waitForTimeout(400);
  await shot('10-experiment-modal.png');
  const recorded = await page.evaluate(() => window.app.plugins.plugins.interestseed.recordQuickExperiment('did'));
  await page.waitForTimeout(400);
  await shot('11-experiment-logged.png');
  return { startedExperiment, recorded, state: await state() };
});

await run('09 discovery overview, explorer, audit', async () => {
  await closeModals();
  await cmd('interestseed-overview');
  await shot('12-discovery-overview.png');
  await closeModals();
  await cmd('interestseed-explorer');
  await shot('13-discovery-explorer.png');
  await closeModals();
  await cmd('interestseed-audit');
  await shot('14-discovery-audit.png');
  await closeModals();
  return state();
});

await run('10 new node, relation, undo/redo', async () => {
  await cmd('interestseed-new-node');
  await page.waitForTimeout(300);
  await shot('15-new-node.png');
  await page.locator('.modal input[type="text"]').fill('实验临时节点');
  await page.getByText('创建', { exact: true }).first().click();
  await page.waitForTimeout(500);
  const created = await page.evaluate(() => {
    const plugin = window.app.plugins.plugins.interestseed;
    const node = plugin.store.listNodes().find((candidate) => candidate.title === '实验临时节点');
    const target = plugin.store.listNodes().find((candidate) => candidate.id !== node?.id);
    if (!node || !target) return { node: node?.id ?? null, edge: null };
    const edge = plugin.createRelation(node.id, target.id, 'experiment-link');
    return { node: node.id, edge: edge?.id ?? null };
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => window.app.commands.executeCommandById('interestseed:interestseed-undo'));
  await page.waitForTimeout(300);
  const afterUndo = await page.evaluate(({ nodeId, edgeId }) => {
    const plugin = window.app.plugins.plugins.interestseed;
    return { node: plugin.store.getNode(nodeId), edge: plugin.store.listEdges().find((item) => item.id === edgeId) ?? null };
  }, { nodeId: created.node, edgeId: created.edge });
  await page.evaluate(() => window.app.commands.executeCommandById('interestseed:interestseed-redo'));
  await page.waitForTimeout(300);
  return { created, afterUndo };
});

await run('11 interest route and canvas export', async () => {
  await closeModals();
  await cmd('interestseed-open');
  await page.evaluate(async () => window.app.plugins.plugins.interestseed.createInterestRoute());
  await page.waitForTimeout(900);
  await shot('16-interest-route.png');
  const files = await page.evaluate(async () => {
    const plugin = window.app.plugins.plugins.interestseed;
    await plugin.exportJsonCanvas();
    return window.app.vault.getFiles().filter((file) => file.extension === 'canvas').map((file) => file.path);
  });
  await page.waitForTimeout(700);
  await shot('17-canvas-export-result.png');
  return { files };
});

await run('12 backup, retry, rebuild, suggestions', async () => {
  await closeModals();
  const backup = await page.evaluate(() => window.app.plugins.plugins.interestseed.createBackup());
  const retry = await page.evaluate(() => window.app.plugins.plugins.interestseed.retrySave());
  const rebuilt = await page.evaluate(async () => {
    const plugin = window.app.plugins.plugins.interestseed;
    await plugin.rebuildGraph(true);
    plugin.refreshSuggestions();
    return { nodes: plugin.store.listNodes().length, suggested: plugin.store.listEdges().filter((edge) => edge.status === 'suggested').length };
  });
  await page.waitForTimeout(800);
  await shot('18-rebuilt-graph.png');
  return { backup, retry, rebuilt };
});

await run('13 settings and agent view', async () => {
  await page.evaluate(() => {
    window.app.setting.open();
    window.app.setting.openTabById('interestseed');
  });
  await page.waitForTimeout(500);
  await shot('19-settings.png');
  await page.evaluate(() => window.app.setting.close());
  await cmd('interestseed-agent');
  await page.waitForTimeout(700);
  await shot('20-agent-view.png');
  await cmd('interestseed-open');
  return state();
});

await run('14 narrow and dark layout', async () => {
  await page.setViewportSize({ width: 420, height: 900 });
  await page.waitForTimeout(500);
  await shot('21-narrow-420.png');
  const narrow = await page.evaluate(() => ({
    width: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
  }));
  await page.evaluate(() => {
    document.body.classList.remove('theme-light');
    document.body.classList.add('theme-dark');
  });
  await page.waitForTimeout(400);
  await shot('22-dark-narrow.png');
  await page.setViewportSize({ width: 1707, height: 1019 });
  await page.evaluate(() => {
    document.body.classList.remove('theme-dark');
    document.body.classList.add('theme-light');
  });
  await page.waitForTimeout(300);
  return narrow;
});

await closeModals();
const summary = await state();
writeFileSync(join(out, 'results.json'), JSON.stringify({ started, finished: Date.now(), summary, results }, null, 2));
await browser.close();
console.log(JSON.stringify({ summary, results }, null, 2));
