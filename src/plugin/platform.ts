/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Copyright (C) 2026 aicoder
 */
import { Platform } from 'obsidian';

/**
 * Obsidian 移动端没有 Node 运行时，任何 `require('child_process')` 都会直接抛错。
 * 插件主体（图谱 / 收件箱 / 实验 / 分享卡）不依赖 Node，因此可以装到手机上；
 * 只有 Agent 功能需要本地进程，必须显式挡住。
 */
export function isDesktopApp(): boolean {
  const value = (Platform as { isDesktopApp?: boolean } | undefined)?.isDesktopApp;
  // 拿不到平台信息时按桌面处理：桌面是功能最全的一侧，误判不会剥夺能力。
  return value !== false;
}

export const AGENT_MOBILE_MESSAGE = 'Agent 需要本地进程，目前只在桌面端可用。';

export function agentUnavailableReason(): string | null {
  return isDesktopApp() ? null : AGENT_MOBILE_MESSAGE;
}
