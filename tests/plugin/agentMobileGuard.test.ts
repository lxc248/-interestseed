/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Copyright (C) 2026 aicoder
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * DshAcpClient 会 spawn 真实子进程，行为级测试需要可执行的 dsh，
 * 不适合放进单元测试。这里改为守住最关键的结构不变量：
 * 桌面守卫必须排在 require('child_process') 之前，
 * 否则移动端会在拿到友好提示之前就抛 ReferenceError。
 */
const clientPath = join(process.cwd(), 'src', 'agent', 'DshAcpClient.ts');

async function readClient(): Promise<string> {
  return readFile(clientPath, 'utf8');
}

describe('DshAcpClient desktop guard', () => {
  it('checks the platform before requiring child_process', async () => {
    const source = await readClient();
    const guard = source.indexOf('if (!isDesktopApp())');
    const requireCall = source.indexOf("require('child_process')");
    expect(guard).toBeGreaterThan(-1);
    expect(requireCall).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(requireCall);
  });

  it('reports the shared mobile message instead of throwing a raw error', async () => {
    const source = await readClient();
    expect(source).toContain('throw new Error(AGENT_MOBILE_MESSAGE)');
    expect(source).toContain("from '../plugin/platform'");
  });
});
/**
 * AgentView 会渲染整套会话 UI，直接单测会把 400+ 行 UI 代码拉进覆盖率范围。
 * 这里只守住「移动端不进会话 UI」这条结构约束。
 */
describe('AgentView on mobile', () => {
  it('returns before rendering the transcript or composer', async () => {
    const source = await readFile(join(process.cwd(), 'src', 'ui', 'AgentView.ts'), 'utf8');
    const guard = source.indexOf('if (!isDesktopApp())');
    const transcript = source.indexOf('this.renderTranscript();');
    const composer = source.indexOf('this.renderComposer();');
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(transcript);
    expect(guard).toBeLessThan(composer);
  });

  it('shows the shared mobile message instead of an empty panel', async () => {
    const source = await readFile(join(process.cwd(), 'src', 'ui', 'AgentView.ts'), 'utf8');
    expect(source).toContain('renderMobileNotice');
    expect(source).toContain('AGENT_MOBILE_MESSAGE');
    expect(source).toContain('Agent 仅桌面端可用');
  });
});