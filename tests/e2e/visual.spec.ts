import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { expect, test } from '@playwright/test';
import { createInterestSeedServer } from '../../standalone/src/server';

const baselineDir = join(process.cwd(), 'tests', 'e2e', 'visual.spec.ts-snapshots');
const updating = process.env.UPDATE_SNAPSHOTS === '1';
const hasBaseline = existsSync(join(baselineDir, 'how-it-works-chromium-linux.png'));
const hasAppBaseline = existsSync(join(baselineDir, 'app-home-chromium-linux.png'));
const hasSettingsBaseline = existsSync(join(baselineDir, 'settings-modal-chromium-linux.png'));
let appServer: Server;
let vaultPath: string;
let appBase: string;

test.beforeAll(async () => {
  vaultPath = await mkdtemp(join(tmpdir(), 'interestseed-visual-'));
  appServer = createInterestSeedServer({ vaultPath, port: 0 });
  await new Promise<void>((resolve, reject) => {
    appServer.once('error', reject);
    appServer.listen(0, '127.0.0.1', () => resolve());
  });
  const address = appServer.address() as AddressInfo | null;
  if (!address) throw new Error('app server did not bind');
  appBase = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => appServer.close(() => resolve()));
  await rm(vaultPath, { recursive: true, force: true });
});

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
test('app home visual', async ({ page }) => {
  test.skip(process.platform !== 'linux', 'Visual baselines are generated on Linux CI.');
  test.skip(!updating && !hasAppBaseline, 'App visual baseline is not installed yet.');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(appBase);
  await expect(page.locator('#header-status')).toBeVisible();
  await expect(page).toHaveScreenshot('app-home.png', {
    fullPage: true,
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  });
});

test('settings modal visual', async ({ page }) => {
  test.skip(process.platform !== 'linux', 'Visual baselines are generated on Linux CI.');
  test.skip(!updating && !hasSettingsBaseline, 'Settings visual baseline is not installed yet.');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(appBase);
  await page.locator('#settings-button').click();
  await expect(page.locator('#settings-modal')).toBeVisible();
  await expect(page.locator('#settings-modal')).toHaveScreenshot('settings-modal.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  });
});
