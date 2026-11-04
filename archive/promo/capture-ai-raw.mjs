import { chromium } from 'playwright-core';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = browser.contexts()[0].pages().find((item) => item.url().includes('obsidian.md')) ?? browser.contexts()[0].pages()[0];
page.on('console', (message) => {
  const text = message.text();
  if (text.includes('AI_RAW') || text.includes('AI_BODY')) console.log(text.slice(0, 4000));
});
await page.evaluate(() => {
  const http = window.require('http');
  if (!http.__patched) {
    http.__patched = true;
    const original = http.request;
    http.request = function (options, callback) {
      return original.call(http, options, (response) => {
        let data = '';
        response.on('data', (chunk) => {
          data += chunk;
        });
        response.on('end', () => {
          console.log(`AI_RAW ${String(response.statusCode)} ${data.slice(0, 2000)}`);
        });
        return callback ? callback(response) : response;
      });
    };
  }
});
const result = await page.evaluate(async () => {
  const plugin = window.app.plugins.plugins.interestseed;
  await plugin.expandWithAI();
  await new Promise((resolve) => setTimeout(resolve, 500));
  return [...document.querySelectorAll('.notice')].map((notice) => notice.textContent);
});
console.log('notices', JSON.stringify(result));
await browser.close();
