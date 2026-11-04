import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const out = 'C:\\Users\\30735\\Desktop\\interestseed\\review\\bug-audit-2.6.2';
mkdirSync(out, { recursive: true });
const started = Date.now();
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = browser.contexts()[0].pages()[0];
const result = { theme: {}, modals: {}, modes: {}, narrow: {}, errors: [] };

const setTheme = async (theme) => {
  await page.evaluate(async (value) => {
    await window.app.vault.setConfig('theme', value);
    window.app.changeTheme?.(value);
    document.body.classList.toggle('theme-light', value === 'light');
    document.body.classList.toggle('theme-dark', value === 'dark');
    window.app.workspace.trigger('css-change');
  }, theme);
  await page.waitForTimeout(350);
};
const style = (selector) => page.evaluate((sel) => {
  const el = document.querySelector(sel);
  if (!el) return null;
  const css = getComputedStyle(el);
  return { color: css.color, background: css.backgroundColor, display: css.display };
}, selector);

await page.setViewportSize({ width: 1280, height: 900 });
await setTheme('light');
await page.evaluate(() => window.app.commands.executeCommandById('interestseed:interestseed-open'));
await page.waitForTimeout(400);
result.theme.light = await page.evaluate(() => ({
  light: document.body.classList.contains('theme-light'),
  rootBg: getComputedStyle(document.querySelector('.interestseed-root')).backgroundColor,
}));
const filterToggle = page.locator('.interestseed-quick-action.is-filter-toggle');
await page.evaluate(() => document.querySelector('.interestseed-root')?.classList.remove('is-filter-open'));
result.theme.lightFilterBefore = await filterToggle.evaluate((el) => getComputedStyle(el).display);
await page.evaluate(() => document.querySelector('.interestseed-quick-action.is-filter-toggle')?.click());
await page.waitForTimeout(350);
result.theme.lightFilterOpen = await page.evaluate(() => ({
  host: getComputedStyle(document.querySelector('.interestseed-filter-host')).display,
  inputBg: getComputedStyle(document.querySelector('.interestseed-search')).backgroundColor,
  inputColor: getComputedStyle(document.querySelector('.interestseed-search')).color,
}));
await page.screenshot({ path: join(out, '01-light-search.png') });
await page.evaluate(() => document.querySelector('.interestseed-quick-action.is-filter-toggle')?.click());
await page.waitForTimeout(150);

await page.evaluate(() => window.app.plugins.plugins.interestseed.openExperiment());
await page.waitForTimeout(300);
result.modals.experiment = {
  root: await style('.interestseed-experiment'),
  title: await style('.interestseed-experiment-title'),
  primary: await style('.interestseed-sprint-primary'),
};
await page.screenshot({ path: join(out, '02-light-experiment.png') });
await page.evaluate(() => document.querySelector('.modal-close-button')?.click());

await page.evaluate(() => {
  const plugin = window.app.plugins.plugins.interestseed;
  plugin.enqueueShare('审计测试 https://www.xiaohongshu.com/explore/audit-261');
  plugin.openInbox();
});
await page.waitForTimeout(300);
result.modals.inbox = await style('.interestseed-share-inbox');
await page.screenshot({ path: join(out, '03-light-inbox.png') });
await page.evaluate(() => document.querySelector('.modal-close-button')?.click());

await page.evaluate(() => window.app.plugins.plugins.interestseed.openSparkCapture('审计测试火花'));
await page.waitForTimeout(300);
result.modals.spark = await style('.interestseed-spark');
await page.screenshot({ path: join(out, '04-light-spark.png') });
await page.evaluate(() => document.querySelector('.modal-close-button')?.click());

await page.evaluate(() => window.app.plugins.plugins.interestseed.openDiscoveryOverview());
await page.waitForTimeout(300);
result.modals.overview = await style('.interestseed-overview-modal .modal-content');
await page.screenshot({ path: join(out, '05-light-overview.png') });
await page.evaluate(() => document.querySelector('.modal-close-button')?.click());

await page.evaluate(() => window.app.plugins.plugins.interestseed.openDiscoveryExplorer());
await page.waitForTimeout(300);
result.modals.explorer = await style('.interestseed-insight-modal .modal-content');
await page.screenshot({ path: join(out, '06-light-explorer.png') });
await page.evaluate(() => document.querySelector('.modal-close-button')?.click());

result.modes = await page.evaluate(() => {
  const app = window.app;
  const plugin = app.plugins.plugins.interestseed;
  const view = app.workspace.getLeavesOfType('interestseed-graph-view')[0]?.view;
  const node = plugin.store.listNodes()[0];
  view?.toggleInbox();
  const relation = document.querySelector('.interestseed-detail-title')?.textContent;
  view?.select(node.id);
  const nodeTitle = document.querySelector('.interestseed-detail-title')?.textContent;
  view?.toggleDiscoveries();
  const discoveryVisible = !document.querySelector('.interestseed-discovery-panel')?.classList.contains('is-hidden');
  view?.select(node.id);
  const discoveryHidden = document.querySelector('.interestseed-discovery-panel')?.classList.contains('is-hidden');
  return { relation, nodeTitle, discoveryVisible, discoveryHidden };
});

await setTheme('dark');
await page.waitForTimeout(300);
result.theme.dark = await page.evaluate(() => ({
  dark: !document.body.classList.contains('theme-light'),
  rootBg: getComputedStyle(document.querySelector('.interestseed-root')).backgroundColor,
  searchBg: getComputedStyle(document.querySelector('.interestseed-search')).backgroundColor,
}));
await page.screenshot({ path: join(out, '07-dark-main.png') });

await page.setViewportSize({ width: 480, height: 900 });
await page.waitForTimeout(350);
result.narrow = await page.evaluate(() => ({
  width: innerWidth,
  bodyScrollWidth: document.body.scrollWidth,
  hint: getComputedStyle(document.querySelector('.interestseed-narrow-hint')).display,
  next: getComputedStyle(document.querySelector('.interestseed-next-step')).display,
  quickbarWidth: document.querySelector('.interestseed-quickbar').getBoundingClientRect().width,
}));
await page.screenshot({ path: join(out, '08-narrow-480.png') });

await page.setViewportSize({ width: 1280, height: 900 });
await page.evaluate(() => window.app.plugins.plugins.interestseed.openInbox());
await page.waitForTimeout(250);
await page.evaluate(() => document.querySelector('.modal-close-button')?.click());
await page.evaluate(async () => {
  const plugin = window.app.plugins.plugins.interestseed;
  await plugin.inbox.load([]);
  await plugin.saveSettings();
});
await browser.close();

result.totalMs = Date.now() - started;
writeFileSync(join(out, 'results.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
