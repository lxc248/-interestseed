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

await page.keyboard.press('Escape');
await page.waitForTimeout(300);

await run('seed sprint complete', async () => {
  await page.evaluate(async () => window.app.commands.executeCommandById('interestseed:interestseed-seed-sprint'));
  await page.waitForTimeout(500);
  await page.getByText('开始长出我的星图', { exact: true }).first().click();
  await page.waitForTimeout(350);
  let rounds = 0;
  for (let index = 0; index < 8; index += 1) {
    const next = page.locator('[data-sprint-next]').first();
    if ((await next.count()) === 0) break;
    await page.locator('.interestseed-sprint-option').first().click();
    await page.waitForTimeout(180);
    const label = (await next.textContent()) ?? '';
    await next.click();
    await page.waitForTimeout(300);
    rounds += 1;
    if (label.includes('生成草稿')) break;
  }
  await shot('27-seed-sprint-draft.png');
  const draftText = await page.locator('.modal').first().textContent();
  await page.getByText('把这些种子种进图谱', { exact: true }).first().click();
  await page.waitForTimeout(700);
  await shot('28-seed-sprint-done.png');
  await page.getByText('查看我的图谱', { exact: true }).first().click();
  await page.waitForTimeout(700);
  return {
    rounds,
    draftHasSeeds: draftText.includes('种子'),
    nodes: await page.evaluate(() => window.app.plugins.plugins.interestseed.store.listNodes().length),
  };
});

await run('relation modal and cluster focus', async () => {
  await page.evaluate(async () => {
    const plugin = window.app.plugins.plugins.interestseed;
    await plugin.activateView();
    const leaves = window.app.workspace.getLeavesOfType('interestseed-graph-view');
    if (leaves[0]) {
      window.app.workspace.setActiveLeaf(leaves[0], { focus: true });
      await window.app.workspace.revealLeaf(leaves[0]);
    }
    const node = plugin.store.listNodes()[0];
    plugin.promptCreateRelation(node.id);
  });
  await page.waitForTimeout(450);
  await shot('33-relation-modal.png');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  const railCount = await page.locator('.interestseed-cluster-rail button').count();
  if (railCount > 1) {
    await page.evaluate(() => {
      document.querySelectorAll('.interestseed-cluster-rail button')[1]?.click();
    });
    await page.waitForTimeout(500);
    await shot('34-cluster-focus.png');
    await page.evaluate(() => {
      document.querySelectorAll('.interestseed-cluster-rail button')[0]?.click();
    });
  }
  return { railCount };
});

await run('export graph json download', async () => {
  let filename = null;
  try {
    const wait = page.waitForEvent('download', { timeout: 5000 });
    await page.evaluate(async () => window.app.commands.executeCommandById('interestseed:interestseed-export'));
    const event = await wait;
    filename = event.suggestedFilename();
    await event.saveAs(join(out, '35-export-graph.json'));
  } catch {
    filename = null;
  }
  await shot('35-export-json.png');
  return { filename };
});

writeFileSync(join(out, 'results-fixups-4.json'), JSON.stringify({ results }, null, 2));
await browser.close();
console.log(JSON.stringify({ results }, null, 2));
