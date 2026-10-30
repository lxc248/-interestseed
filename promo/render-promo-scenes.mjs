import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = 'C:\\Users\\30735\\Desktop\\interestseed\\promo';
const out = join(root, 'promo-scenes');
mkdirSync(out, { recursive: true });

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = browser.contexts()[0].pages()[0];
await page.setViewportSize({ width: 1080, height: 1920 });

const htmlUrl = pathToFileURL(join(root, 'promo-scene.html')).href;

for (let scene = 1; scene <= 10; scene += 1) {
  const url = `${htmlUrl}?scene=${scene}`;
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__ready === true);
  await page.waitForTimeout(120);
  await page.screenshot({ path: join(out, `scene-${scene}.png`) });
  console.log(`rendered scene ${scene}`);
}

await browser.close();
