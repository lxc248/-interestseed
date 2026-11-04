import { chromium } from 'playwright-core';
import { readFile } from 'node:fs/promises';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = browser.contexts()[0].pages()[0];
await page.evaluate(() => {
  const p = window.app.plugins.plugins.interestseed;
  const id = p.captureInterestSpark(
    'AI 会议纪要：把周会变成行动项 https://www.douyin.com/video/office-check',
    undefined,
    '我想让周会不再只是信息同步',
  );
  if (id) {
    p.setSelectedNode(id);
    void p.activateView();
  }
});
await page.waitForTimeout(900);
await page.screenshot({ path: 'C:\\Users\\30735\\Desktop\\interestseed\\review\\sim-artifacts\\11-office-spark-decision.png' });
console.log((await page.locator('body').innerText()).slice(-900));
const backup = JSON.parse(await readFile('C:\\Users\\30735\\Desktop\\windows-mcp\\sim-original-graph.json', 'utf8'));
await page.evaluate(async (graph) => {
  const p = window.app.plugins.plugins.interestseed;
  p.store.replace(graph);
  await p.persistence.flush();
}, backup);
await browser.close();
