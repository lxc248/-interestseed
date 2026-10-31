import { chromium } from 'playwright-core';

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = browser.contexts()[0].pages().find((item) => item.url().includes('obsidian.md')) ?? browser.contexts()[0].pages()[0];
const key = await page.evaluate(async () => {
  const plugin = window.app.plugins.plugins.interestseed;
  return plugin.getAiApiKey();
});
await browser.close();

const response = await fetch('http://localhost:7863/v1/models', {
  headers: { Authorization: `Bearer ${key}` },
});
const body = await response.text();
let models = [];
try {
  const parsed = JSON.parse(body);
  models = Array.isArray(parsed.data)
    ? parsed.data.map((item) => item.id).filter(Boolean)
    : Array.isArray(parsed.models)
      ? parsed.models.map((item) => item.id ?? item.name).filter(Boolean)
      : [];
} catch {}
console.log(JSON.stringify({ status: response.status, models }, null, 2));
