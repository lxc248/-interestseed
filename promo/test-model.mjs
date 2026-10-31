import { chromium } from 'playwright-core';

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = browser.contexts()[0].pages().find((item) => item.url().includes('obsidian.md')) ?? browser.contexts()[0].pages()[0];
const key = await page.evaluate(async () => {
  const plugin = window.app.plugins.plugins.interestseed;
  return plugin.getAiApiKey();
});
await browser.close();

const response = await fetch('http://localhost:7863/v1/chat/completions', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'cn:deepseek-v4.1-flash',
    messages: [{ role: 'user', content: 'Return exactly {"ok":true}' }],
    response_format: { type: 'json_object' },
    max_tokens: 20,
  }),
});
const text = await response.text();
console.log(JSON.stringify({ status: response.status, body: text.slice(0, 500) }, null, 2));
