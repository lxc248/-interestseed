import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createInterestSeedServer } from '../../standalone/src/server';

const pages = ['/', '/download/', '/how-it-works/', '/3-day-interest-experiment/', '/interestseed-vs-readwise/', '/interestseed-vs-obsidian/'];

for (const path of pages) {
  test(`site a11y ${path}`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(results.violations).toEqual([]);
  });
}

let appServer: Server;
let appVault: string;
let appBase: string;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  appVault = await mkdtemp(join(tmpdir(), 'interestseed-a11y-'));
  appServer = createInterestSeedServer({ vaultPath: appVault, port: 0 });
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
  await rm(appVault, { recursive: true, force: true });
});

test('app home has no accessibility violations', async ({ page }) => {
  await page.goto(appBase);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations).toEqual([]);
});

test('settings modal has no accessibility violations', async ({ page }) => {
  await page.goto(appBase);
  await page.locator('#settings-button').click();
  await expect(page.locator('#settings-modal')).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations).toEqual([]);
});

test('capture modal has no accessibility violations', async ({ page }) => {
  await page.goto(appBase);
  await page.locator('#capture-button').click();
  await expect(page.locator('#capture-modal')).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations).toEqual([]);
});



