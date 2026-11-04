import { chromium } from 'playwright-core';
import { join } from 'node:path';

const out = 'C:\\Users\\30735\\Desktop\\interestseed\\review\\experiment-3.0.8';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const pages = browser.contexts()[0].pages();
const main = pages.find((page) => page.url().includes('obsidian.md')) ?? pages[pages.length - 1];
const settings = pages.find((page) => page.url() === 'about:blank');

let settingsInfo = null;
if (settings) {
  await settings.locator('text=AI 关系建议').first().scrollIntoViewIfNeeded().catch(() => {});
  await settings.waitForTimeout(300);
  await settings.screenshot({ path: join(out, '47-ai-settings-default.png') });
  settingsInfo = await settings.evaluate(() => {
    const rows = [...document.querySelectorAll('.setting-item')].filter((row) => row.textContent?.includes('AI 关系建议') || row.textContent?.includes('允许发送关系请求字段'));
    return rows.map((row) => ({
      text: row.textContent?.slice(0, 160),
      checked: row.querySelector('input[type="checkbox"]')?.checked ?? null,
    }));
  });
}

await main.evaluate(async () => window.app.commands.executeCommandById('interestseed:interestseed-ai-expand'));
await main.waitForTimeout(3000);
await main.screenshot({ path: join(out, '48-ai-command-fallback.png') });
const notice = await main.locator('.notice').last().textContent().catch(() => '');

await main.evaluate(async () => window.app.commands.executeCommandById('interestseed:interestseed-explorer'));
await main.waitForTimeout(700);
await main.screenshot({ path: join(out, '49-explorer-ai-enabled.png') });
const explorerText = await main.locator('.modal').first().textContent().catch(() => '');
await browser.close();
console.log(JSON.stringify({ settingsInfo, notice, explorerHasAi: /AI/i.test(explorerText) }, null, 2));
