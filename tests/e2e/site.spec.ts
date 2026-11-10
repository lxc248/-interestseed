/* global process */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

/** Read the version instead of hardcoding it: a bump must not need a test edit. */
const STANDALONE_VERSION: string = JSON.parse(
  readFileSync(join(process.cwd(), 'standalone', 'package.json'), 'utf8'),
).version as string;

const contentPages = [
  '/how-it-works/',
  '/3-day-interest-experiment/',
  '/interestseed-vs-readwise/',
  '/interestseed-vs-obsidian/',
  '/security/',
];

test('home page loads with primary navigation', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/InterestSeed/);
  await expect(page.getByRole('link', { name: 'Download' }).first()).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('download page exposes the current standalone asset', async ({ page }) => {
  await page.goto('/download/');
  await expect(page).toHaveTitle(/Download/);
  await expect(page.getByText(STANDALONE_VERSION).first()).toBeVisible();
  const asset = page
    .locator(`a[href*="interestseed-standalone-v${STANDALONE_VERSION}.zip"]`)
    .first();
  await expect(asset).toHaveAttribute(
    'href',
    new RegExp(`interestseed-standalone-v${STANDALONE_VERSION.replace(/\./g, '\\.')}\\.zip`),
  );
});

test('content pages render a heading', async ({ page }) => {
  for (const path of contentPages) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }
});

test('mobile layout has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test('llms-full is served with the current release', async ({ request }) => {
  const response = await request.get('/llms-full.txt');
  expect(response.status()).toBe(200);
  expect(await response.text()).toContain('Latest release: ' + STANDALONE_VERSION);
});
