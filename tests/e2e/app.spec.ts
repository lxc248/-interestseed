import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { expect, test } from '@playwright/test';
import { createInterestSeedServer } from '../../standalone/src/server';

let server: Server;
let vaultPath: string;
let base: string;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  vaultPath = await mkdtemp(join(tmpdir(), 'interestseed-app-'));
  server = createInterestSeedServer({ vaultPath, port: 0 });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address() as AddressInfo | null;
  if (!address) throw new Error('app server did not bind');
  base = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await rm(vaultPath, { recursive: true, force: true });
});

test('loads the app and opens settings', async ({ page }) => {
  await page.goto(base);
  await expect(page.getByText('仅本机')).toBeVisible();
  await expect(page.locator('#header-status')).toHaveText(/未配置 Key/);
  await page.locator('#settings-button').click();
  await expect(page.locator('#settings-modal')).toBeVisible();
  await expect(page.locator('#settings-model')).toHaveValue(/deepseek/);
  await page.locator('#settings-modal .modal-close').click();
  await expect(page.locator('#settings-modal')).toBeHidden();
});

test('captures a note and updates the graph stats', async ({ page }) => {
  await page.goto(base);
  await page.locator('#capture-button').click();
  await page.locator('#capture-title').fill('E2E 观察');
  await page.locator('#capture-text').fill('这是一个用于端到端测试的真实观察，至少四个字。');
  await page.locator('#capture-submit').click();
  await expect(page.locator('#capture-modal')).toBeHidden();
  await expect(page.locator('#stats')).toContainText('1');
});

test('adds and lists an inbox item', async ({ page }) => {
  await page.goto(base);
  await page.locator('#inbox-input').fill('E2E 收件箱条目');
  await page.locator('#inbox-add').click();
  await expect(page.locator('#inbox-count')).toContainText('1');
  await expect(page.locator('#inbox-list')).toContainText('E2E 收件箱条目');
});

test('filters the graph with search input', async ({ page }) => {
  await page.goto(base);
  await page.locator('#graph-search').fill('E2E');
  await expect(page.locator('#graph')).toBeVisible();
  await expect(page.locator('#graph-search')).toHaveValue('E2E');
});

test('starts a 3-day experiment from the selected node', async ({ page }) => {
  await page.goto(base);
  await page.getByRole('button', { name: '开始 3 天实验' }).click();
  await expect(page.locator('#experiment-modal')).toBeVisible();
  await page.locator('#experiment-submit').click();
  await expect(page.locator('#experiment-strip')).toContainText('DAY 1 / 3');
});
