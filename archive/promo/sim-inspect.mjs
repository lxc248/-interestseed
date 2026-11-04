import { chromium } from 'playwright-core';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const contexts = browser.contexts();
console.log('contexts', contexts.length);
for (const [ci, context] of contexts.entries()) {
  for (const [pi, page] of context.pages().entries()) {
    console.log('page', ci, pi, await page.title(), page.url());
    const info = await page.evaluate(() => {
      const app = window.app;
      const plugin = app?.plugins?.plugins?.interestseed;
      return {
        hasApp: Boolean(app),
        hasPlugin: Boolean(plugin),
        commands: app?.commands?.commands ? Object.keys(app.commands.commands).filter((id) => id.startsWith('interestseed')) : [],
        vault: app?.vault?.getName?.(),
        nodes: plugin?.store?.getGrammar ? 'x' : plugin?.store?.nodeCount,
      };
    });
    console.log(info);
    await page.screenshot({ path: 'C:\\Users\\30735\\Desktop\\interestseed\\promo\\obsidian-cdp.png' });
  }
}
await browser.close();
