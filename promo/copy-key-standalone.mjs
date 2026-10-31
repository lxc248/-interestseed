import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = browser.contexts()[0].pages().find((item) => item.url().includes('obsidian.md')) ?? browser.contexts()[0].pages()[0];
const key = await page.evaluate(async () => {
  const plugin = window.app.plugins.plugins.interestseed;
  return plugin.getAiApiKey();
});
await browser.close();
if (!key) throw new Error('No key in plugin SecretStorage');
const dir = 'C:/Users/30735/Documents/Obsidian/InterestSeed-4C11-Disposable/.interestseed';
await mkdir(dir, { recursive: true });
await writeFile(`${dir}/key`, key, 'utf8');
console.log('key copied for local test');
