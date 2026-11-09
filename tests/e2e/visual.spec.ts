import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

const baselineDir = join(process.cwd(), 'tests', 'e2e', 'visual.spec.ts-snapshots');
const updating = process.env.UPDATE_SNAPSHOTS === '1';
const hasBaseline = existsSync(join(baselineDir, 'how-it-works-chromium-linux.png'));
test('how-it-works page visual', async ({ page }) => {
  test.skip(process.platform !== 'linux', 'Visual baselines are generated on Linux CI.');
  test.skip(!updating && !hasBaseline, 'Visual baseline is not installed yet.');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/how-it-works/');
  await expect(page.locator('h1')).toBeVisible();
  await expect(page).toHaveScreenshot('how-it-works.png', {
    fullPage: true,
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  });
});

test('download page visual', async ({ page }) => {
  test.skip(process.platform !== 'linux', 'Visual baselines are generated on Linux CI.');
  test.skip(!updating && !hasBaseline, 'Visual baseline is not installed yet.');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/download/');
  await expect(page.locator('h1')).toBeVisible();
  await expect(page).toHaveScreenshot('download.png', {
    fullPage: true,
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  });
});
