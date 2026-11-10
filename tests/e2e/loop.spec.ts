/**
 * 冷启动 → 图谱 → 体检 的主链路。
 * 与 app.spec.ts 分开文件，因此使用独立 vault 与独立服务实例。
 */
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
  vaultPath = await mkdtemp(join(tmpdir(), 'interestseed-loop-'));
  server = createInterestSeedServer({ vaultPath, port: 0 });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address() as AddressInfo | null;
  if (!address) throw new Error('loop server did not bind');
  base = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await rm(vaultPath, { recursive: true, force: true });
});

test('refuses a seed sprint with empty fields', async ({ page }) => {
  await page.goto(base);
  await page.locator('#sprint-button').click();
  await expect(page.locator('#sprint-modal')).toBeVisible();
  await page.locator('#sprint-submit').click();
  await expect(page.locator('#toast')).toContainText('三格都填上');
  await expect(page.locator('#sprint-modal')).toBeVisible();
});

test('plants the first seed and updates the graph', async ({ page }) => {
  await page.goto(base);
  await page.locator('#sprint-button').click();
  await page.locator('#sprint-title').fill('端到端冷启动');
  await page.locator('#sprint-why').fill('想验证这条链路是否真的能跑通。');
  await page.locator('#sprint-action').fill('先记录一次真实使用。');
  await page.locator('#sprint-submit').click();
  await expect(page.locator('#sprint-modal')).toBeHidden();
  await expect(page.locator('#toast')).toContainText('第一颗种子已经种下');
  await expect(page.locator('#stats')).toContainText('1');
  await expect(page.locator('#graph')).toContainText('端到端冷启动');
});

test('opens the discovery health check', async ({ page }) => {
  await page.goto(base);
  await page.locator('#discoveries-audit').click();
  await expect(page.locator('#discovery-audit-modal')).toBeVisible();
  await expect(page.locator('#discovery-audit-body')).not.toBeEmpty();
  await page.locator('#discovery-audit-modal .modal-close').click();
  await expect(page.locator('#discovery-audit-modal')).toBeHidden();
});

test('keeps the planted seed after a reload', async ({ page }) => {
  await page.goto(base);
  await expect(page.locator('#graph')).toContainText('端到端冷启动');
  await page.reload();
  await expect(page.locator('#stats')).toContainText('1');
  await expect(page.locator('#graph')).toContainText('端到端冷启动');
});
