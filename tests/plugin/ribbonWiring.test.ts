/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Copyright (C) 2026 aicoder
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * 装配层的行为断言在 surfaces.test.ts。
 * 这里只守一条结构约束：main.ts 必须通过 registerSurfaces 统一注册，
 * 不允许再出现零散的 addRibbonIcon / registerView 调用。
 * 之前真的出现过两个同名 Agent ribbon 按钮。
 */
const sourcePath = join(process.cwd(), 'src', 'main.ts');

async function readMainSource(): Promise<string> {
  return readFile(sourcePath, 'utf8');
}

function countOccurrences(source: string, needle: string): number {
  return source.split(needle).length - 1;
}

describe('plugin surface wiring', () => {
  it('registers surfaces through the shared helper exactly once', async () => {
    const source = await readMainSource();
    expect(countOccurrences(source, 'registerSurfaces(')).toBe(1);
  });

  it('does not register ribbon icons inline', async () => {
    const source = await readMainSource();
    expect(countOccurrences(source, 'addRibbonIcon(')).toBe(0);
  });

  it('does not register views inline', async () => {
    const source = await readMainSource();
    expect(countOccurrences(source, 'registerView(')).toBe(0);
  });
});
