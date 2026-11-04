import { chromium } from 'playwright-core';
import path from 'node:path';
import { mkdir, readFile } from 'node:fs/promises';

const outDir = 'C:\\Users\\30735\\Desktop\\interestseed\\review\\office-sim-artifacts';
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
  await page.waitForTimeout(180);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(180);
}
async function choose(label) {
  const option = page.locator('.interestseed-sprint-option').filter({ hasText: label }).first();
  await option.waitFor({ state: 'visible', timeout: 5000 });
  await option.click();
  await page.waitForTimeout(150);
}

await closeModals();
await page.evaluate(() => {
  const plugin = window.app.plugins.plugins.interestseed;
  plugin.store.clear();
});
await page.waitForTimeout(350);
await page.evaluate(() =>
  window.app.commands.executeCommandById('interestseed:interestseed-seed-sprint'),
);
await page.waitForTimeout(500);
await shot('01-office-onboarding-intro.png');
await page.getByText('开始长出我的星图', { exact: true }).click();
await page.waitForTimeout(250);

// Office worker: a project exists, but attention is split across work and side projects.
await choose('正在做一个东西');
await page.locator('[data-sprint-next]').click();
await page.waitForTimeout(200);
await choose('做出一个东西');
await page.locator('[data-sprint-next]').click();
await page.waitForTimeout(200);
await choose('产品、商业、增长');
await page.locator('[data-sprint-next]').click();
await page.waitForTimeout(200);
await choose('一条探索路径');
await page.locator('[data-sprint-next]').click();
await page.waitForTimeout(450);
await shot('02-office-draft-review.png');
await page.getByText('把这些种子种进图谱', { exact: true }).click();
await page.waitForTimeout(650);
await shot('03-office-first-map.png');
await page.getByText('查看我的图谱', { exact: true }).click();
await page.waitForTimeout(900);
await shot('04-office-map-after-onboarding.png');

// One real UI spark, then the same public capture path for the rest.
await page.evaluate(() => window.app.plugins.plugins.interestseed.openSparkCapture());
await page.waitForTimeout(350);
await page.locator('.interestseed-spark-input').fill(
  'AI 会议纪要：把周会变成行动项 https://www.douyin.com/video/office-1',
);
await page.waitForTimeout(250);
await shot('05-office-spark-analysis.png');
await page.getByText('留下这个火花', { exact: true }).click();
await page.waitForTimeout(450);

const sparkTexts = [
  '汇报不是罗列工作，而是让老板做选择 https://www.douyin.com/video/office-2',
  '下班后做副业：先卖一个最小服务 https://www.douyin.com/video/office-3',
  '产品增长：先找到愿意付费的 10 个人 https://www.douyin.com/video/office-4',
  '通勤 40 分钟：把碎片时间变成输入 https://www.douyin.com/video/office-5',
  '被优化之后，我才开始整理作品集 https://www.douyin.com/video/office-6',
];
const result = await page.evaluate(async (texts) => {
  const plugin = window.app.plugins.plugins.interestseed;
  for (const text of texts) plugin.captureInterestSpark(text);
  const nodes = plugin.store.listNodes();
  const find = (needle) => nodes.find((node) => node.title.includes(needle));
  const project = find('正在做的项目');
  const create = find('动手创造');
  const product = find('产品与商业');
  const career = plugin.store.addNode({
    type: 'topic',
    title: '职场影响力',
    tags: ['主题', '职场', '表达'],
    sourceUri: 'interestseed://office/topic-career',
    metadata: {
      evidence: '汇报、作品集、被优化等内容反复出现',
      confidence: 0.72,
    },
  });
  const side = plugin.store.addNode({
    type: 'topic',
    title: '副业与产品',
    tags: ['主题', '产品', '副业'],
    sourceUri: 'interestseed://office/topic-side',
    metadata: {
      evidence: '下班后做小服务和产品增长内容反复出现',
      confidence: 0.7,
    },
  });
  const meeting = find('AI 会议纪要');
  const report = find('汇报不是罗列');
  const sideSpark = find('下班后做副业');
  const growth = find('产品增长');
  const commute = find('通勤');
  const portfolio = find('被优化');
  if (meeting && create) plugin.createRelation(meeting.id, create.id, '把工具用进工作');
  if (report && career) plugin.createRelation(report.id, career.id, '让工作被看见');
  if (sideSpark && side) plugin.createRelation(sideSpark.id, side.id, '最小服务');
  if (growth && product) plugin.createRelation(growth.id, product.id, '先找付费用户');
  if (commute && create) plugin.createRelation(commute.id, create.id, '碎片输入');
  if (portfolio && career) plugin.createRelation(portfolio.id, career.id, '作品集');
  if (career && project) plugin.createRelation(career.id, project.id, '工作表达');
  if (side && project) plugin.createRelation(side.id, project.id, '下班后验证');
  await plugin.persistence.flush();
  return {
    counts: { nodes: plugin.store.nodeCount, edges: plugin.store.edgeCount },
    titles: plugin.store.listNodes().map((node) => node.title),
  };
}, sparkTexts);
console.log('office', JSON.stringify(result));

await page.evaluate(() => window.app.commands.executeCommandById('interestseed:interestseed-open'));
await page.waitForTimeout(650);
await shot('06-office-final-map.png');

await page.evaluate(() => window.app.plugins.plugins.interestseed.openExperiment());
await page.waitForTimeout(400);
await shot('07-office-experiment-before.png');
await page.locator('.interestseed-experiment-field textarea').fill(
  '今天把一次周会整理成 3 个行动项，发给同事后少了两轮确认；真正有用的不是纪要，是让每个人知道下一步。',
);
const scales = page.locator('.interestseed-experiment-scale-button');
await scales.nth(3).click();
await scales.nth(7).click();
await shot('08-office-experiment-filled.png');
await page.getByText('记录第 1 天', { exact: true }).click();
await page.waitForTimeout(400);
await shot('09-office-experiment-recorded.png');
const gate = await page.evaluate(() => {
  const plugin = window.app.plugins.plugins.interestseed;
  const active = plugin.getActiveExperiment();
  return active ? { day: active.day, logs: active.state.logs.length, gate: active.gate } : null;
});
console.log('gate', gate);

// Restore the disposable vault graph.
const backup = JSON.parse(await readFile(backupPath, 'utf8'));
await page.evaluate(async (graph) => {
  const plugin = window.app.plugins.plugins.interestseed;
  plugin.store.replace(graph);
  await plugin.persistence.flush();
}, backup);
console.log('errors', errors);
await browser.close();
