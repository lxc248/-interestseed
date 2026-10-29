import { chromium } from 'playwright-core';
import { writeFile } from 'node:fs/promises';

const outDir = 'C:\\Users\\30735\\Desktop\\interestseed\\review\\real-life-sim-artifacts';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = browser.contexts()[0].pages()[0];
await page.evaluate(() => window.app.plugins.plugins.interestseed.openShareCard());
await page.waitForTimeout(700);
await page.screenshot({ path: `${outDir}\\35-share-modal-xiaohongshu.png` });
console.log('modal', await page.locator('.interestseed-share-title').innerText());
for (const [label, name] of [['小红书', 'xiaohongshu'], ['X / 微博', 'x'], ['Instagram', 'instagram']]) {
  const chip = page.getByText(label, { exact: true }).first();
  if (await chip.count()) await chip.click();
  await page.waitForTimeout(350);
  const data = await page.locator('.interestseed-share-canvas').evaluate((canvas) => canvas.toDataURL('image/png'));
  await writeFile(`${outDir}\\36-share-card-${name}.png`, Buffer.from(data.split(',')[1], 'base64'));
  console.log('exported', name, Math.round(data.length / 1024), 'KB base64');
}
await page.screenshot({ path: `${outDir}\\37-share-modal-x.png` });
await page.keyboard.press('Escape');
await browser.close();
