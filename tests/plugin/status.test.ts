import { describe, expect, it } from 'vitest';
import { buildStatus, statusBarText } from '../../src/plugin/status';

const stats = { nodes: 3, edges: 2, confirmed: 1, suggested: 2 };

describe('status helpers', () => {
  it('builds a healthy status snapshot', () => {
    const status = buildStatus({ scanning: false, lastError: null, state: null, stats });
    expect(status).toEqual({
      scanning: false,
      lastError: null,
      blocked: false,
      blockedReason: null,
      saveFailed: false,
      nodes: 3,
      edges: 2,
      confirmed: 1,
      suggested: 2,
    });
  });

  it('treats an undefined state as healthy', () => {
    const status = buildStatus({ scanning: false, lastError: null, state: undefined, stats });
    expect(status.blocked).toBe(false);
    expect(status.saveFailed).toBe(false);
    expect(status.blockedReason).toBeNull();
  });

  it('reflects blocked and saveFailed state', () => {
    const status = buildStatus({
      scanning: true,
      lastError: 'disk full',
      state: { blocked: true, blockedReason: 'read-only', saveFailed: true },
      stats,
    });
    expect(status.blocked).toBe(true);
    expect(status.blockedReason).toBe('read-only');
    expect(status.saveFailed).toBe(true);
    expect(status.lastError).toBe('disk full');
  });

  it('renders a clean status bar without a suffix', () => {
    expect(statusBarText(stats, null, null)).toBe('InterestSeed · 3 节点 / 1 已确认 / 2 建议');
  });

  it('renders an error suffix', () => {
    expect(statusBarText(stats, null, 'boom')).toBe('InterestSeed · 3 节点 / 1 已确认 / 2 建议 · ⚠ 错误');
  });

  it('renders blocked and saveFailed suffixes', () => {
    expect(statusBarText(stats, { blocked: true }, null)).toBe(
      'InterestSeed · 3 节点 / 1 已确认 / 2 建议 · ⚠ 存储已暂停',
    );
    expect(statusBarText(stats, { saveFailed: true }, null)).toBe(
      'InterestSeed · 3 节点 / 1 已确认 / 2 建议 · ⚠ 未保存',
    );
  });
});
