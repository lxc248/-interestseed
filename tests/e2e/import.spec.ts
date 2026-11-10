import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { expect, test } from '@playwright/test';
import { createInterestSeedServer } from '../../standalone/src/server';

/**
 * 独立版 web 界面的批量导入。
 * 使用独立 vault 与服务实例，避免与其它 spec 互相污染。
 */
let server: Server;
let vaultPath: string;
let base: string;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  vaultPath = await mkdtemp(join(tmpdir(), 'interestseed-import-web-'));
  server = createInterestSeedServer({ vaultPath, port: 0 });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address() as AddressInfo | null;
  if (!address) throw new Error('import server did not bind');
  base = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await rm(vaultPath, { recursive: true, force: true });
});

const CSV = [
  'title,url',
  '陶艺入门,https://www.xiaohongshu.com/explore/65abc',
  '剪辑节奏,https://www.douyin.com/video/123',
].join('\n');

test('imports a csv export from the web ui', async ({ page }) => {
  await page.goto(base);
  await page.locator('#inbox-import summary').click();
  await page.locator('#inbox-import-text').fill(CSV);
  await page.locator('#inbox-import-run').click();

  await expect(page.locator('#toast')).toContainText('导入 2 条');
  await expect(page.locator('#inbox-count')).toContainText('2 条待处理');
  await expect(page.locator('#inbox-import-text')).toHaveValue('');
});

test('reports duplicate imports instead of adding them twice', async ({ page }) => {
  await page.goto(base);
  await page.locator('#inbox-import summary').click();
  await page.locator('#inbox-import-text').fill(CSV);
  await page.locator('#inbox-import-run').click();

  await expect(page.locator('#toast')).toContainText('重复 2 条');
  await expect(page.locator('#inbox-count')).toContainText('2 条待处理');
});

test('refuses an unrecognisable file with the api message', async ({ page }) => {
  await page.goto(base);
  await page.locator('#inbox-import summary').click();
  await page.locator('#inbox-import-text').fill('完全没有链接的一段话');
  await page.locator('#inbox-import-run').click();

  await expect(page.locator('#toast')).toContainText('没有识别到可导入的条目');
});

test('asks for content when the box is empty', async ({ page }) => {
  await page.goto(base);
  await page.locator('#inbox-import summary').click();
  await page.locator('#inbox-import-run').click();

  await expect(page.locator('#toast')).toContainText('先粘贴导出文件的内容');
});
