/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Copyright (C) 2026 aicoder
 */
import { describe, expect, it, vi } from 'vitest';

const platform = vi.hoisted(() => ({ desktop: true, hasFlag: true }));

vi.mock('obsidian', () => ({
  Platform: {
    get isDesktopApp() {
      return platform.hasFlag ? platform.desktop : undefined;
    },
  },
}));

import {
  AGENT_MOBILE_MESSAGE,
  agentUnavailableReason,
  isDesktopApp,
} from '../../src/plugin/platform';

describe('platform', () => {
  it('allows the agent on desktop', () => {
    platform.desktop = true;
    platform.hasFlag = true;
    expect(isDesktopApp()).toBe(true);
    expect(agentUnavailableReason()).toBeNull();
  });

  it('blocks the agent on mobile with an actionable message', () => {
    platform.desktop = false;
    platform.hasFlag = true;
    expect(isDesktopApp()).toBe(false);
    expect(agentUnavailableReason()).toBe(AGENT_MOBILE_MESSAGE);
  });

  it('treats a missing platform flag as desktop', () => {
    platform.hasFlag = false;
    expect(isDesktopApp()).toBe(true);
    expect(agentUnavailableReason()).toBeNull();
    platform.hasFlag = true;
    platform.desktop = true;
  });

  it('keeps the mobile message stable', () => {
    expect(AGENT_MOBILE_MESSAGE).toBe('Agent 需要本地进程，目前只在桌面端可用。');
  });
});
