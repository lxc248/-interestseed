/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Copyright (C) 2026 aicoder
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * ribbon 图标只在 Obsidian 运行时才注册，单元测试拿不到实例。
 * 这里退一步，直接对装配源码做静态断言：数量和标题唯一性。
 * 之前真的出现过两个同名「打开 InterestSeed Agent」按钮。
 */
const sourcePath = join(process.cwd(), 'src', 'main.ts');

function ribbonLabels(source: string): string[] {
  const labels: string[] = [];
  const pattern = /addRibbonIcon\(\s*'[^']*'\s*,\s*'([^']+)'/g;
  let match = pattern.exec(source);
  while (match) {
    const label = match[1];
    if (label) labels.push(label);
    match = pattern.exec(source);
  }
  return labels;
}

describe('ribbon wiring', () => {
  it('registers exactly three ribbon buttons with unique labels', async () => {
    const source = await readFile(sourcePath, 'utf8');
    const labels = ribbonLabels(source);
    expect(labels).toHaveLength(3);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('keeps one dedicated entry per surface', async () => {
    const source = await readFile(sourcePath, 'utf8');
    const labels = ribbonLabels(source);
    expect(labels).toEqual([
      '打开兴趣图谱',
      '打开 InterestSeed AI 建议',
      '打开 InterestSeed Agent',
    ]);
  });
});
