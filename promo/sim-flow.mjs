import { chromium } from 'playwright-core';
import path from 'node:path';
import { mkdir, readFile } from 'node:fs/promises';

const outDir = 'C:\\Users\\30735\\Desktop\\interestseed\\review\\sim-artifacts';
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
  await page.waitForTimeout(200);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
}

async function choose(label) {
  const option = page.locator('.interestseed-sprint-option').filter({ hasText: label }).first();
  await option.waitFor({ state: 'visible', timeout: 5000 });
  await option.click();
  await page.waitForTimeout(180);
}

await closeModals();
await page.evaluate(() => {
  const plugin = window.app.plugins.plugins.interestseed;
  plugin.store.clear();
});
await page.waitForTimeout(400);
await page.evaluate(() =>
  window.app.commands.executeCommandById('interestseed:interestseed-seed-sprint'),
);
await page.waitForTimeout(500);
await shot('01-onboarding-intro.png');
await page.getByText('开始长出我的星图', { exact: true }).click();
await page.waitForTimeout(300);

await choose('正在做一个东西');
await page.locator('[data-sprint-next]').click();
await page.waitForTimeout(250);
await choose('做出一个东西');
await page.locator('[data-sprint-next]').click();
await page.waitForTimeout(250);
await choose('AI、工具、效率');
await page.locator('[data-sprint-next]').click();
await page.waitForTimeout(250);
await choose('一张项目地图');
await shot('02-onboarding-round4.png');
await page.locator('[data-sprint-next]').click();
await page.waitForTimeout(500);
await shot('03-draft-review.png');

await page.getByText('把这些种子种进图谱', { exact: true }).click();
await page.waitForTimeout(700);
await shot('04-planted.png');
await page.getByText('查看我的图谱', { exact: true }).click();
await page.waitForTimeout(1000);
await shot('05-first-star-map.png');

// Actual spark UI path: one representative Douyin item.
await page.evaluate(() => window.app.plugins.plugins.interestseed.openSparkCapture());
await page.waitForTimeout(400);
await page.locator('.interestseed-spark-input').fill(
  'Vibe coding：用 AI 做第一个小产品，真正难的是让人愿意开始 https://www.douyin.com/video/sim-1',
);
await page.waitForTimeout(250);
await shot('06-spark-modal.png');
await page.getByText('种下这个火花', { exact: true }).click();
await page.waitForTimeout(500);

// Remaining observed Douyin items through the same public plugin API.
const sparkTexts = [
  'DeepSeekHarness 手搓粒子：把工具变成作品 https://www.douyin.com/video/sim-2',
  'Kimi 一周 AI 大事：我在追什么 https://www.douyin.com/video/sim-3',
  '中央选调生：稳定路径和创作欲望 https://www.douyin.com/video/sim-4',
  '收到退款：平台规则和消费者处境 https://www.douyin.com/video/sim-5',
  '颠倒：视觉叙事和节奏 https://www.douyin.com/video/sim-6',
  '后排听不见将军：职场沟通 https://www.douyin.com/video/sim-7',
];
const result = await page.evaluate(async (texts) => {
  const plugin = window.app.plugins.plugins.interestseed;
  const ids = [];
  for (const text of texts) ids.push(plugin.captureInterestSpark(text));
  const nodes = plugin.store.listNodes();
  const find = (needle) =>
    nodes.find((node) => node.title.includes(needle)) ||
    nodes.find((node) => node.tags.some((tag) => tag.includes(needle)));
  const ai = find('AI 与工具');
  const create = find('动手创造');
  const project = find('正在做的项目');
  const topic = plugin.store.addNode({
    type: 'topic',
    title: '表达与叙事',
    tags: ['主题', '表达', '视觉'],
    sourceUri: 'interestseed://sim/topic-expression',
    metadata: { evidence: '从抖音的视觉视频和创作类内容中反复出现', confidence: 0.74 },
  });
  const career = plugin.store.addNode({
    type: 'topic',
    title: '职业路径',
    tags: ['主题', '职业', '选择'],
    sourceUri: 'interestseed://sim/topic-career',
    metadata: { evidence: '选调生和实习内容带来的现实焦虑', confidence: 0.68 },
  });
  const vibe = find('Vibe coding');
  const particle = find('DeepSeekHarness');
  const upside = find('颠倒');
  const exam = find('中央选调生');
  const refund = find('收到退款');
  const office = find('后排听不见将军');
  if (vibe && ai) plugin.createRelation(vibe.id, ai.id, '正在靠近');
  if (particle && create) plugin.createRelation(particle.id, create.id, '手搓出作品');
  if (upside && topic) plugin.createRelation(upside.id, topic.id, '视觉叙事');
  if (exam && career) plugin.createRelation(exam.id, career.id, '现实路径');
  if (refund) plugin.createRelation(refund.id, project.id, '理解平台规则');
  if (office) plugin.createRelation(office.id, career.id, '沟通与权力');
  if (topic && vibe) plugin.createRelation(topic.id, vibe.id, '把工具变成表达');
  await plugin.persistence.flush();
  return {
    ids,
    counts: { nodes: plugin.store.nodeCount, edges: plugin.store.edgeCount },
    titles: plugin.store.listNodes().map((node) => node.title),
  };
}, sparkTexts);
console.log('sparks', JSON.stringify(result));

await page.evaluate(() => window.app.commands.executeCommandById('interestseed:interestseed-open'));
await page.waitForTimeout(700);
await shot('07-final-star-map.png');

// Day-one experiment, then verify the same-day gate.
await page.evaluate(() => window.app.plugins.plugins.interestseed.openExperiment());
await page.waitForTimeout(500);
await shot('08-experiment-before.png');
await page.locator('.interestseed-experiment-field textarea').fill(
  '今天用 AI 剪了一个 30 秒视频；真正让我兴奋的不是工具，而是看到同学停下来看完。',
);
const scales = page.locator('.interestseed-experiment-scale-button');
await scales.nth(3).click(); // interest 4
await scales.nth(7).click(); // energy 3
await shot('09-experiment-filled.png');
await page.getByText('记录第 1 天', { exact: true }).click();
await page.waitForTimeout(500);
await shot('10-experiment-recorded.png');
const gate = await page.evaluate(() => {
  const plugin = window.app.plugins.plugins.interestseed;
  const active = plugin.getActiveExperiment();
  return active
    ? {
        day: active.day,
        logs: active.state.logs.length,
        canRecord: active.gate.canRecord,
        reason: active.gate.reason,
      }
    : null;
});
console.log('gate', gate);

// Restore the QA graph so the disposable vault is not left mutated.
const backup = JSON.parse(await readFile(backupPath, 'utf8'));
await page.evaluate(async (graph) => {
  const plugin = window.app.plugins.plugins.interestseed;
  plugin.store.replace(graph);
  await plugin.persistence.flush();
}, backup);
console.log('errors', errors);
await browser.close();
