import { chromium } from 'playwright-core';

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = browser.contexts()[0].pages()[0];
const results = [];

async function audit(name, selector) {
  const res = await page.evaluate(async ({ name, selector }) => {
    const target = selector ? document.querySelector(selector) : document.body;
    if (!target || !window.axe) return { name, ok: false, violations: [] };
    const r = await window.axe.run(target, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    });
    return { name, ok: true, violations: r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })) };
  }, { name, selector });
  results.push(res);
}

await page.evaluate(async () => {
  await window.app.commands.executeCommandById('interestseed:interestseed-open');
});
await page.waitForTimeout(700);
await page.addScriptTag({ url: 'https://cdn.jsdelivr.net/npm/axe-core@4.10.2/axe.min.js' });
await page.waitForTimeout(800);
await audit('graph', '.interestseed-root');

await page.evaluate(async () => {
  await window.app.commands.executeCommandById('interestseed:interestseed-inbox');
});
await page.waitForTimeout(400);
await audit('inbox', '.interestseed-inbox-deck-shell');
await page.keyboard.press('Escape');
await page.waitForTimeout(250);

await page.evaluate(async () => {
  await window.app.commands.executeCommandById('interestseed:interestseed-share-card');
});
await page.waitForTimeout(500);
await audit('share-card', '.modal');
await page.keyboard.press('Escape');
await page.waitForTimeout(250);

await browser.close();
console.log(JSON.stringify(results, null, 2));
if (results.some((r) => !r.ok || r.violations.length > 0)) process.exit(1);
