import { chromium } from 'playwright-core';

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = browser.contexts()[0].pages()[0];

await page.evaluate(async () => {
  const plugin = window.app.plugins.plugins.interestseed;
  await plugin.inbox.load([]);
  const url = 'https://www.xiaohongshu.com/explore/dynsec-audit';
  plugin.enqueueShare(url, 'share', url);
  plugin.openInbox();
});
await page.waitForTimeout(600);

const result = await page.evaluate(async () => {
  const calls = [];
  const original = window.open;
  window.open = (...args) => {
    calls.push(args);
    return null;
  };
  const link = document.querySelector('.interestseed-inbox-source.is-link');
  if (!link) return { ok: false, reason: 'no source link', calls };
  link.click();
  await new Promise((resolve) => setTimeout(resolve, 100));
  window.open = original;
  return { ok: true, calls };
});

await page.evaluate(async () => {
  const plugin = window.app.plugins.plugins.interestseed;
  await plugin.inbox.load([]);
});
await browser.close();

console.log(JSON.stringify(result, null, 2));
if (!result.ok || result.calls.length !== 1) process.exit(1);
const [url, target, features] = result.calls[0];
if (!/^https:\/\//.test(url) || target !== '_blank' || !features.includes('noopener') || !features.includes('noreferrer')) {
  process.exit(1);
}
console.log('external link hardening ok');
