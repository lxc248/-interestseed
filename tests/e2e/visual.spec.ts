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
const hasCaptureBaseline = existsSync(join(baselineDir, 'capture-modal-chromium-linux.png'));
const hasExperimentBaseline = existsSync(join(baselineDir, 'experiment-modal-chromium-linux.png'));
const hasSprintBaseline = existsSync(join(baselineDir, 'sprint-modal-chromium-linux.png'));
const hasShareCardBaseline = existsSync(join(baselineDir, 'share-card-modal-chromium-linux.png'));
const hasDiscoveryAuditBaseline = existsSync(join(baselineDir, 'discovery-audit-modal-chromium-linux.png'));
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
test('capture modal visual', async ({ page }) => {
  test.skip(process.platform !== 'linux', 'Visual baselines are generated on Linux CI.');
  test.skip(!updating && !hasCaptureBaseline, 'Capture visual baseline is not installed yet.');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(appBase);
  await page.locator('#capture-button').click();
  await expect(page.locator('#capture-modal')).toBeVisible();
  await expect(page.locator('#capture-modal')).toHaveScreenshot('capture-modal.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  });
});

test('experiment modal visual', async ({ page }) => {
  test.skip(process.platform !== 'linux', 'Visual baselines are generated on Linux CI.');
  test.skip(!updating && !hasExperimentBaseline, 'Experiment visual baseline is not installed yet.');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.request.post(`${appBase}/api/capture`, {
    data: { title: 'Visual experiment', text: '用于视觉测试的真实观察内容。' },
  });
  await page.goto(appBase);
  await page.getByRole('button', { name: '开始 3 天实验' }).click();
  await expect(page.locator('#experiment-modal')).toBeVisible();
  await expect(page.locator('#experiment-modal')).toHaveScreenshot('experiment-modal.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  });
});
test('sprint modal visual', async ({ page }) => {
  test.skip(process.platform !== 'linux', 'Visual baselines are generated on Linux CI.');
  test.skip(!updating && !hasSprintBaseline, 'Sprint visual baseline is not installed yet.');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(appBase);
  await page.locator('#sprint-button').click();
  await expect(page.locator('#sprint-modal')).toBeVisible();
  await expect(page.locator('#sprint-modal')).toHaveScreenshot('sprint-modal.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  });
});
test('share card modal visual', async ({ page }) => {
  test.skip(process.platform !== 'linux', 'Visual baselines are generated on Linux CI.');
  test.skip(!updating && !hasShareCardBaseline, 'Share-card visual baseline is not installed yet.');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.request.post(`${appBase}/api/inbox`, {
    data: { text: '分享卡视觉测试：读到一个值得验证的兴趣。' },
  });
  await page.goto(appBase);
  await page.getByRole('button', { name: '做成图' }).first().click();
  await expect(page.locator('#share-card-modal')).toBeVisible();
  await expect(page.locator('#share-card-modal')).toHaveScreenshot('share-card-modal.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  });
});

test('discovery audit modal visual', async ({ page }) => {
  test.skip(process.platform !== 'linux', 'Visual baselines are generated on Linux CI.');
  test.skip(!updating && !hasDiscoveryAuditBaseline, 'Discovery-audit visual baseline is not installed yet.');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(appBase);
  await page.locator('#discoveries-audit').click();
  await expect(page.locator('#discovery-audit-modal')).toBeVisible();
  await expect(page.locator('#discovery-audit-modal')).toHaveScreenshot('discovery-audit-modal.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  });
});
