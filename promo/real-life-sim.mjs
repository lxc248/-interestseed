import { chromium } from 'playwright-core';
import path from 'node:path';
import { mkdir, readFile } from 'node:fs/promises';

const outDir = 'C:\\Users\\30735\\Desktop\\interestseed\\review\\real-life-sim-artifacts';
const backupPath = 'C:\\Users\\30735\\Desktop\\windows-mcp\\sim-original-graph.json';
await mkdir(outDir, { recursive: true });

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = browser.contexts()[0].pages()[0];
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));

async function shot(name) {
  await page.screenshot({ path: path.join(outDir, name), fullPage: false });
  console.log('shot', name);
}
async function closeModals() {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(160);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(160);
}
async function choose(label) {
  const option = page.locator('.interestseed-sprint-option').filter({ hasText: label }).first();
  await option.waitFor({ state: 'visible', timeout: 5000 });
  await option.click();
  await page.waitForTimeout(140);
}
async function nextRound() {
  const button = page.locator('[data-sprint-next]');
  if (await button.count()) await button.click();
  else await page.getByText('继续', { exact: true }).last().click();
}

async function setSimDate(iso) {
  await page.evaluate((value) => {
    const real = window.__interestseedRealDate;
    if (real) window.__interestseedSimNow.now = new real(value);
  }, iso);
}

await closeModals();
await page.evaluate(() => {
  const p = window.app.plugins.plugins.interestseed;
  p.store.clear();
});
await page.waitForTimeout(300);

// Real-life persona, not abstract categories.
await page.evaluate(() =>
  window.app.commands.executeCommandById('interestseed:interestseed-seed-sprint'),
);
await page.waitForTimeout(450);
await shot('02-onboarding-intro.png');
await page.getByText('开始长出我的星图', { exact: true }).click();
await page.waitForTimeout(220);

await choose('在几个兴趣间摇摆');
await shot('03-onboarding-mode.png');
await nextRound();
await page.waitForTimeout(180);
await choose('做出一个东西');
await shot('04-onboarding-flow.png');
await nextRound();
await page.waitForTimeout(180);
await choose('美妆、穿搭、个人风格');
await shot('05-onboarding-magnet.png');
await nextRound();
await page.waitForTimeout(180);
await choose('一条探索路径');
await shot('06-onboarding-shape.png');
await nextRound();
await page.waitForTimeout(450);
await shot('07-draft-review.png');
await page.getByText('把这些种子种进图谱', { exact: true }).click();
await page.waitForTimeout(650);
await shot('08-first-map.png');
await page.getByText('查看我的图谱', { exact: true }).click();
await page.waitForTimeout(850);
await shot('09-map-after-onboarding.png');

// First spark through the real intake UI, connected to the beauty seed.
const beautySeed = await page.evaluate(() => {
  const p = window.app.plugins.plugins.interestseed;
  return p.store.listNodes().find((node) => node.title.includes('美妆'))?.id ?? null;
});
await page.evaluate(() => window.app.plugins.plugins.interestseed.openSparkCapture());
await page.waitForTimeout(350);
await page.locator('.interestseed-spark-input').fill(
  '早八底妆：不卡粉的三个步骤 https://www.douyin.com/video/life-beauty-1',
);
await page.locator('.interestseed-spark-why-input').fill(
  '不是想买更多化妆品，是想知道自己为什么在镜头前不自信。',
);
if (beautySeed) await page.selectOption('.interestseed-spark-target', beautySeed);
await page.waitForTimeout(250);
await shot('10-spark-card-beauty.png');
await page.getByText('留下这个火花', { exact: true }).click();
await page.waitForTimeout(450);

const realLifeSparks = [
  '跑步 5 公里：我听什么、想什么 https://www.douyin.com/video/life-sport-1',
  '《塞尔达》开放世界：为什么我愿意绕路 https://www.douyin.com/video/life-game-1',
  '游戏化健身：把深蹲变成每日任务 https://www.douyin.com/video/life-sport-2',
  '美妆镜头感：为什么有的妆在镜头里更贵 https://www.douyin.com/video/life-beauty-2',
  '周末羽毛球：我不是不爱运动，是不爱无聊 https://www.douyin.com/video/life-sport-3',
  '玩家社群：为什么我愿意在一个世界里待很久 https://www.douyin.com/video/life-game-2',
];

// All further sparks go through the same visible intake UI.
for (let index = 0; index < realLifeSparks.length; index += 1) {
  const text = realLifeSparks[index];
  await page.evaluate(
    (initial) => window.app.plugins.plugins.interestseed.openSparkCapture(initial),
    text,
  );
  await page.waitForTimeout(280);
  await page.locator('.interestseed-spark-why-input').fill(
    index < 2 ? '我想确认这不是刷到就忘的内容。' : '这类内容反复出现，值得留下一个证据。',
  );
  await shot(`10${String.fromCharCode(98 + index)}-spark-card.png`);
  await page.getByText('留下这个火花', { exact: true }).click();
  await page.waitForTimeout(300);
}

const graphResult = await page.evaluate(() => {
  const p = window.app.plugins.plugins.interestseed;
  const nodes = p.store.listNodes();
  const find = (needle) => nodes.find((node) => node.title.includes(needle));
  const beauty = find('美妆');
  const sport = p.store.addNode({
    type: 'topic',
    title: '身体与运动',
    tags: ['主题', '运动', '身体'],
    sourceUri: 'interestseed://life/topic-body',
    metadata: { evidence: '跑步、羽毛球、健身内容反复出现', confidence: 0.78 },
  });
  const game = p.store.addNode({
    type: 'topic',
    title: '游戏与虚拟世界',
    tags: ['主题', '游戏', '玩家'],
    sourceUri: 'interestseed://life/topic-game',
    metadata: { evidence: '塞尔达、玩家社群内容反复出现', confidence: 0.74 },
  });
  const beauty1 = find('早八底妆');
  const beauty2 = find('美妆镜头感');
  const sport1 = find('跑步 5 公里');
  const sport2 = find('游戏化健身');
  const sport3 = find('周末羽毛球');
  const game1 = find('塞尔达');
  const game2 = find('玩家社群');
  if (beauty1 && beauty) p.createRelation(beauty1.id, beauty.id, '让镜头前更有底');
  if (beauty2 && beauty) p.createRelation(beauty2.id, beauty.id, '镜头里的风格');
  if (sport1 && sport) p.createRelation(sport1.id, sport.id, '跑步时我在想什么');
  if (sport2 && sport) p.createRelation(sport2.id, sport.id, '把运动变成任务');
  if (sport3 && sport) p.createRelation(sport3.id, sport.id, '不想无聊');
  if (game1 && game) p.createRelation(game1.id, game.id, '开放世界的绕路');
  if (game2 && game) p.createRelation(game2.id, game.id, '玩家社群');
  if (beauty && sport) p.createRelation(beauty.id, sport.id, '自我呈现与身体');
  if (sport && game) p.createRelation(sport.id, game.id, '游戏化');
  return { counts: { nodes: p.store.nodeCount, edges: p.store.edgeCount } };
});
console.log('graph', graphResult);

await page.evaluate(() => window.app.commands.executeCommandById('interestseed:interestseed-open'));
await page.waitForTimeout(700);
await shot('11-graph-cluster-first.png');
const allChip = page.getByText('全部', { exact: false }).first();
if (await allChip.count()) {
  await allChip.click();
  await page.waitForTimeout(500);
  await shot('12-graph-all.png');
}

// Simulated calendar clock for a defensible 7-day run.
await page.evaluate(() => {
  const RealDate = Date;
  const sim = { now: new RealDate('2026-11-01T10:00:00') };
  class SimDate extends RealDate {
    constructor(...args) {
      super(...(args.length ? args : [sim.now.getTime()]));
    }
    static now() {
      return sim.now.getTime();
    }
  }
  SimDate.parse = RealDate.parse;
  SimDate.UTC = RealDate.UTC;
  window.__interestseedRealDate = RealDate;
  window.__interestseedSimNow = sim;
  window.Date = SimDate;
});
await setSimDate('2026-11-01T10:00:00');

await page.evaluate(() => window.app.plugins.plugins.interestseed.openExperiment());
await page.waitForTimeout(500);
await shot('13-experiment-start.png');
await page.getByText('先做 3 天试跑', { exact: true }).click();
await page.waitForTimeout(400);
await shot('14-experiment-3day.png');

const dayEvidence = [
  ['2026-11-01T10:00:00', '早八用了一个更薄的底妆，发现我不舒服的不是卡粉，是总在比较别人。', 4, 3, '明天只记录一个自己满意的细节'],
  ['2026-11-02T10:00:00', '跑步 5 公里时没有听播客，发现我在想游戏里的路线，身体反而不累。', 4, 4, '试试不带耳机跑一次'],
  ['2026-11-03T10:00:00', '把深蹲写成每日任务后，我真的做了 20 个；游戏化对我有用。', 5, 4, '把任务从 20 个加到 25 个'],
  ['2026-11-04T10:00:00', '看塞尔达的地图设计，发现自己喜欢的是“可以绕路”，不是通关。', 4, 3, '记录一次主动绕路'],
  ['2026-11-05T10:00:00', '羽毛球输了，但我想再来一局；我喜欢的可能是来回的节奏。', 4, 2, '约朋友周末再打'],
  ['2026-11-06T10:00:00', '美妆视频里让我停下来的不是产品，是博主怎么讲自己的不自信。', 3, 3, '写下自己真正想表达的一句话'],
  ['2026-11-07T10:00:00', '今天没有完成计划，但我还是打开了一个游戏世界；兴趣不是任务。', 3, 2, '把实验结论写进图谱'],
];

for (let index = 0; index < dayEvidence.length; index += 1) {
  const [date, evidence, interest, energy, next] = dayEvidence[index];
  await setSimDate(date);
  await closeModals();
  await page.evaluate(() => window.app.plugins.plugins.interestseed.openExperiment());
  await page.waitForTimeout(350);
  await page.locator('textarea.interestseed-experiment-input').fill(evidence);
  const scales = page.locator('.interestseed-experiment-scale-button');
  await scales.nth(interest - 1).click();
  await scales.nth(5 + energy - 1).click();
  await page.locator('input.interestseed-experiment-input').fill(next);
  await shot(`${15 + index * 2}-day${index + 1}-filled.png`);
  const button = page.getByText(`记录第 ${index + 1} 天`, { exact: true });
  await button.click();
  await page.waitForTimeout(400);
  await shot(`${16 + index * 2}-day${index + 1}-recorded.png`);

  if (index === 0) {
    // Same-day gate is visible and explicit.
    await page.waitForTimeout(150);
    await shot('29-day1-same-day-locked.png');
  }
  if (index === 2) {
    await closeModals();
    await page.evaluate(() => window.app.plugins.plugins.interestseed.openExperiment());
    await page.waitForTimeout(350);
    await shot('30-three-day-complete.png');
    await page.getByText('继续到 7 天', { exact: true }).click();
    await page.waitForTimeout(350);
    await shot('31-extended-to-seven.png');
  }
}

await closeModals();
await page.evaluate(() => window.app.plugins.plugins.interestseed.openExperiment());
await page.waitForTimeout(450);
await shot('32-seven-day-complete.png');
await page.keyboard.press('Escape');
await page.waitForTimeout(250);

// Mobile URI / clipboard entry uses the same prefilled decision card.
await page.evaluate(() =>
  window.app.plugins.plugins.interestseed.openSparkCapture(
    '美妆：早八底妆不卡粉的三个步骤 https://www.douyin.com/video/life-mobile-1',
  ),
);
await page.waitForTimeout(350);
await shot('33-mobile-share-prefilled.png');
await closeModals();

await page.evaluate(() => window.app.commands.executeCommandById('interestseed:interestseed-open'));
await page.waitForTimeout(600);
await shot('34-final-graph.png');

// Restore the disposable vault graph and real clock.
await page.evaluate(() => {
  if (window.__interestseedRealDate) window.Date = window.__interestseedRealDate;
});
const backup = JSON.parse(await readFile(backupPath, 'utf8'));
await page.evaluate(async (graph) => {
  const p = window.app.plugins.plugins.interestseed;
  p.store.replace(graph);
  await p.persistence.flush();
}, backup);
console.log('errors', errors);
await browser.close();
