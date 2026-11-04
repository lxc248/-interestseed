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
  await page.waitForTimeout(600);
}

await activateGraph();

await run('seed sprint full flow', async () => {
  await page.evaluate(async () => window.app.commands.executeCommandById('interestseed:interestseed-seed-sprint'));
  await page.waitForTimeout(500);
  await shot('26-seed-sprint-intro.png');
  await page.getByText('开始长出我的星图', { exact: true }).first().click();
  await page.waitForTimeout(400);
  for (let index = 0; index < 6; index += 1) {
    const draftVisible = await page.getByText('生成草稿', { exact: true }).count();
    if (draftVisible > 0) break;
    await page.locator('.interestseed-sprint-option').first().click();
    await page.waitForTimeout(200);
    await page.locator('[data-sprint-next]').first().click();
    await page.waitForTimeout(350);
  }
  await shot('27-seed-sprint-draft.png');
  await page.getByText('把这些种子种进图谱', { exact: true }).first().click();
  await page.waitForTimeout(600);
  await shot('28-seed-sprint-done.png');
  await page.getByText('查看我的图谱', { exact: true }).first().click();
  await page.waitForTimeout(600);
  return { nodes: await page.evaluate(() => window.app.plugins.plugins.interestseed.store.listNodes().length) };
});

await run('share card download and caption', async () => {
  await page.evaluate(async () => window.app.commands.executeCommandById('interestseed:interestseed-share-card'));
  await page.waitForTimeout(600);
  let download = null;
  try {
    const wait = page.waitForEvent('download', { timeout: 5000 });
    await page.getByText('下载 PNG', { exact: true }).first().click();
    const event = await wait;
    download = event.suggestedFilename();
    await event.saveAs(join(out, '29-share-download.png'));
  } catch {
    download = null;
  }
  await page.getByText('复制文案', { exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(400);
  const clipboard = await page.evaluate(() => navigator.clipboard.readText().catch(() => '')).catch(() => '');
  await shot('30-share-caption.png');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  return { download, clipboard: clipboard.slice(0, 120) };
});

await run('note inbox and node from file', async () => {
  const result = await page.evaluate(async () => {
    const plugin = window.app.plugins.plugins.interestseed;
    const path = `InterestSeed/experiment-note-${Date.now()}.md`;
    const file = await window.app.vault.create(path, '# 实验笔记\n\n一个用于测试的兴趣观察。');
    await window.app.workspace.getLeaf().openFile(file);
    const before = plugin.getPendingInboxItems().length;
    await window.app.commands.executeCommandById('interestseed:interestseed-note-inbox');
    const afterNote = plugin.getPendingInboxItems().length;
    await window.app.commands.executeCommandById('interestseed:interestseed-node-from-file');
    await new Promise((resolve) => setTimeout(resolve, 500));
    const nodes = plugin.store.listNodes().filter((node) => node.sourceUri?.includes('experiment-note')).length;
    await window.app.vault.delete(file);
    return { before, afterNote, nodes };
  });
  await shot('31-note-inbox-node.png');
  return result;
});

await run('clipboard share', async () => {
  const result = await page.evaluate(async () => {
    const plugin = window.app.plugins.plugins.interestseed;
    await navigator.clipboard.writeText('https://www.xiaohongshu.com/explore/clipboard-experiment');
    await window.app.commands.executeCommandById('interestseed:interestseed-share-clipboard');
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { pending: plugin.getPendingInboxItems().length };
  });
  await shot('32-clipboard-share.png');
  return result;
});

await run('relation modal and cluster rail', async () => {
  await activateGraph();
  const relationOpened = await page.evaluate(() => {
    const plugin = window.app.plugins.plugins.interestseed;
    const node = plugin.store.listNodes().find((candidate) => candidate.id !== plugin.getSelectedNodeId());
    plugin.promptCreateRelation(node.id);
    return Boolean(node);
  });
  await page.waitForTimeout(400);
  await shot('33-relation-modal.png');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  const rail = page.locator('.interestseed-cluster-rail button');
  const railCount = await rail.count();
  if (railCount > 1) {
    await rail.nth(1).click();
    await page.waitForTimeout(400);
    await shot('34-cluster-focus.png');
    await rail.nth(0).click();
  }
  return { relationOpened, railCount };
});

await run('export graph json', async () => {
  const result = await page.evaluate(async () => {
    await window.app.commands.executeCommandById('interestseed:interestseed-export');
    await new Promise((resolve) => setTimeout(resolve, 500));
    const files = window.app.vault.getFiles().filter((file) => file.extension === 'json' && file.path.includes('InterestSeed'));
    return files.map((file) => file.path);
  });
  await shot('35-export-json.png');
  return result;
});

writeFileSync(join(out, 'results-fixups-3.json'), JSON.stringify({ results }, null, 2));
await browser.close();
console.log(JSON.stringify({ results }, null, 2));
