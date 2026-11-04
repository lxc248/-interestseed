import { chromium } from 'playwright-core';

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = browser.contexts()[0].pages()[0];
const errors = [];
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});

const commands = [
  'interestseed:interestseed-open',
  'interestseed:interestseed-seed-sprint',
  'interestseed:interestseed-spark',
  'interestseed:interestseed-inbox',
  'interestseed:interestseed-experiment',
  'interestseed:interestseed-share-card',
  'interestseed:interestseed-overview',
  'interestseed:interestseed-explorer',
  'interestseed:interestseed-audit',
  'interestseed:interestseed-new-node',
  'interestseed:interestseed-route',
];

const opened = [];
for (const id of commands) {
  const before = await page.locator('.modal').count();
  await page.evaluate(async (commandId) => {
    await window.app.commands.executeCommandById(commandId);
  }, id);
  await page.waitForTimeout(450);
  const after = await page.locator('.modal').count();
  opened.push({ id, before, after });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  const leftovers = await page.locator('.modal').count();
  if (leftovers > 0) {
    await page.evaluate(() => {
      document.querySelectorAll('.modal-close-button').forEach((button) => button.click());
    });
    await page.waitForTimeout(200);
  }
}

await page.setViewportSize({ width: 420, height: 900 });
await page.waitForTimeout(400);
const narrow = await page.evaluate(() => ({
  width: window.innerWidth,
  scrollWidth: document.documentElement.scrollWidth,
  overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
}));

await page.setViewportSize({ width: 1707, height: 1019 });
await browser.close();
console.log(JSON.stringify({ opened, narrow, errors }, null, 2));
if (errors.length > 0 || narrow.overflow) process.exit(1);
