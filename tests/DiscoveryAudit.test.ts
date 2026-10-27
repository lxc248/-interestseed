import { describe, expect, it } from 'vitest';

import { generateDiscoveries } from '../src/discovery/DiscoveryEngine';
import { applyDiscoveryFeedback } from '../src/discovery/feedback';
import {
  AUDIT_MAX_ACTIVE,
  AUDIT_MAX_DISMISSED,
  buildDiscoveryAudit,
  DISCOVERY_AUDIT_JUDGMENTS,
  DiscoveryAuditDataError,
  DiscoveryAuditLimitError,
  DiscoveryAuditScopeError,
  formatDiscoveryAudit,
  projectDiscoveryAuditRecord,
} from '../src/discovery/audit';
import type { DiscoveryAuditScope } from '../src/discovery/audit';
import { AuditVaultBinding } from '../src/discovery/auditBinding';
import { emptyDiscoveryFile } from '../src/discovery/types';
import type { DiscoveryFile } from '../src/discovery/types';
import { qualityFixture } from './discoveryQuality';

const NOW = '2026-01-01T00:00:00.000Z';
const BINDING = AuditVaultBinding.fromVault({});

const SCOPE: DiscoveryAuditScope = {
  binding: BINDING,
  rangeConfirmed: true,
  projectKeys: ['P1', 'P2'],
  includeDismissed: false,
  maxActive: AUDIT_MAX_ACTIVE,
  maxDismissed: AUDIT_MAX_DISMISSED,
};

function scope(overrides: Partial<DiscoveryAuditScope> = {}): DiscoveryAuditScope {
  return { ...SCOPE, ...overrides };
}

function fixtureFile(): DiscoveryFile {
  const { graph } = qualityFixture();
  return generateDiscoveries(graph, emptyDiscoveryFile(NOW), () => NOW);
}

function cloneMany(
  count: number,
  status: 'active' | 'dismissed',
  projectKeys: string[] = ['P1', 'P2'],
): DiscoveryFile {
  const source = fixtureFile().discoveries[0]!;
  const file = emptyDiscoveryFile(NOW);
  file.discoveries = Array.from({ length: count }, (_, index) => ({
    ...source,
    id: `audit-${status}-${index}`,
    status,
    feedbackStatus: status === 'dismissed' ? 'rejected' : 'none',
    projectKeys,
    application: { state: 'none' },
    createdAt: NOW,
    updatedAt: NOW,
  }));
  return file;
}

describe('Discovery audit aggregation', () => {
  it('范围声明缺失、无效或未确认时安全失败', () => {
    const file = fixtureFile();
    expect(() =>
      buildDiscoveryAudit(file, undefined as unknown as DiscoveryAuditScope),
    ).toThrowError(DiscoveryAuditScopeError);
    expect(() =>
      buildDiscoveryAudit(file, scope({ rangeConfirmed: false })),
    ).toThrowError(DiscoveryAuditScopeError);
    const inactive = AuditVaultBinding.fromVault({});
    inactive.invalidate();
    expect(() =>
      buildDiscoveryAudit(file, scope({ binding: inactive })),
    ).toThrowError(DiscoveryAuditScopeError);
    expect(() =>
      buildDiscoveryAudit(file, scope({ projectKeys: [] })),
    ).toThrowError(DiscoveryAuditScopeError);
    expect(() =>
      buildDiscoveryAudit(file, scope({ projectKeys: [' '] })),
    ).toThrowError(DiscoveryAuditScopeError);
    expect(() =>
      buildDiscoveryAudit(file, scope({ projectKeys: ['P1/Sub'] })),
    ).toThrowError(DiscoveryAuditScopeError);
    expect(() =>
      buildDiscoveryAudit(file, scope({ projectKeys: ['P1\\Sub'] })),
    ).toThrowError(DiscoveryAuditScopeError);
    expect(() =>
      buildDiscoveryAudit(file, scope({ maxActive: AUDIT_MAX_ACTIVE + 1 })),
    ).toThrowError(DiscoveryAuditScopeError);
    expect(() =>
      buildDiscoveryAudit(file, scope({ includeDismissed: true, maxDismissed: 21 })),
    ).toThrowError(DiscoveryAuditScopeError);
    expect(() =>
      buildDiscoveryAudit(file, scope({ from: 'not-a-date' })),
    ).toThrowError(DiscoveryAuditScopeError);
  });

  it('corrected 与 low-value 不会被判为 invalid，并输出计数', () => {
    const file = fixtureFile();
    file.discoveries[0]!.feedbackStatus = 'corrected';
    file.discoveries[1]!.feedbackStatus = 'low-value';
    file.discoveries[1]!.status = 'dismissed';
    const summary = buildDiscoveryAudit(
      file,
      scope({ includeDismissed: true }),
    );
    expect(summary.feedback.corrected).toBe(1);
    expect(summary.feedback['low-value']).toBe(1);
  });

  it('active 恰好 50 条通过，51 条拒绝且不输出正常汇总', () => {
    const fifty = buildDiscoveryAudit(cloneMany(50, 'active'), scope());
    expect(fifty.includedActive).toBe(50);
    expect(fifty.sampledCount).toBe(50);

    expect(() => buildDiscoveryAudit(cloneMany(51, 'active'), scope())).toThrowError(
      DiscoveryAuditLimitError,
    );
  });

  it('dismissed 恰好 20 条通过，21 条拒绝', () => {
    const twenty = buildDiscoveryAudit(
      cloneMany(20, 'dismissed'),
      scope({ includeDismissed: true }),
    );
    expect(twenty.includedDismissed).toBe(20);
    expect(twenty.sampledCount).toBe(20);

    expect(() =>
      buildDiscoveryAudit(
        cloneMany(21, 'dismissed'),
        scope({ includeDismissed: true }),
      ),
    ).toThrowError(DiscoveryAuditLimitError);
  });

  it('dismissed 未纳入时即使超过 20 条也不触发 dismissed 上限', () => {
    const summary = buildDiscoveryAudit(cloneMany(25, 'dismissed'), scope());
    expect(summary.includedDismissed).toBe(0);
    expect(summary.eligibleCount).toBe(0);
    expect(summary.excluded.dismissed).toBe(25);
  });

  it('项目/时间过滤发生在上限判断前', () => {
    const projectFiltered = cloneMany(51, 'active');
    projectFiltered.discoveries[0]!.projectKeys = ['P3'];
    expect(buildDiscoveryAudit(projectFiltered, scope()).includedActive).toBe(50);

    const timeFiltered = cloneMany(51, 'active');
    timeFiltered.discoveries[0]!.updatedAt = '2020-01-01T00:00:00.000Z';
    expect(
      buildDiscoveryAudit(
        timeFiltered,
        scope({ from: '2025-01-01T00:00:00.000Z' }),
      ).includedActive,
    ).toBe(50);
  });

  it('项目、时间和状态组合过滤后再判断 50/20 上限', () => {
    const file = cloneMany(51, 'active');
    file.discoveries[0]!.projectKeys = ['P3'];
    const dismissed = cloneMany(21, 'dismissed').discoveries;
    dismissed[0]!.projectKeys = ['P3'];
    file.discoveries.push(...dismissed);

    const summary = buildDiscoveryAudit(
      file,
      scope({ includeDismissed: true, from: '2025-01-01T00:00:00.000Z' }),
    );
    expect(summary.includedActive).toBe(50);
    expect(summary.includedDismissed).toBe(20);
    expect(summary.scopeMatchedCount).toBe(70);
    expect(summary.sampledCount).toBe(70);
  });

  it('无效时间、缺失字段、非法枚举和不支持 Schema 安全处理', () => {
    const file = fixtureFile();
    const base = file.discoveries[0]!;
    const malformed = [
      { ...base, id: undefined },
      { ...base, projectKeys: undefined },
      { ...base, subjectKeys: undefined },
      { ...base, evidence: undefined },
      { ...base, updatedAt: 'not-a-date' },
      { ...base, application: { state: 'bogus' } },
    ] as unknown as DiscoveryFile['discoveries'];
    file.discoveries.push(...malformed);

    const summary = buildDiscoveryAudit(file, scope());
    expect(summary.excluded.invalidRecord).toBe(6);
    expect(summary.includedActive).toBe(4);

    const legacy = { ...fixtureFile(), discoverySchemaVersion: 999 };
    expect(() => buildDiscoveryAudit(legacy, scope())).toThrowError(
      DiscoveryAuditDataError,
    );
  });

  it('projectKeys 统一 trim 且保持大小写敏感', () => {
    const file = fixtureFile();
    expect(
      buildDiscoveryAudit(file, scope({ projectKeys: [' P1 ', 'P2'] })).includedActive,
    ).toBe(4);
    expect(
      buildDiscoveryAudit(file, scope({ projectKeys: ['p1', 'P2'] })).includedActive,
    ).toBe(0);

    const spaced = fixtureFile();
    spaced.discoveries[0]!.projectKeys = [' P1 ', ' P2 '];
    expect(
      buildDiscoveryAudit(spaced, scope({ projectKeys: ['P1', 'P2'] }))
        .includedActive,
    ).toBe(4);
  });

  it('覆盖率分别以 scope 匹配数和输入数为分母，并明确排除关系', () => {
    const file = fixtureFile();
    const full = buildDiscoveryAudit(file, scope());
    expect(full.inputCount).toBe(4);
    expect(full.structurallyValidCount).toBe(4);
    expect(full.scopeMatchedCount).toBe(4);
    expect(full.eligibleCount).toBe(4);
    expect(full.coverage.scope).toBe(1);
    expect(full.coverage.input).toBe(1);

    const target = file.discoveries[0]!;
    const withRejected = applyDiscoveryFeedback(file, target.id, 'rejected', NOW);
    const partial = buildDiscoveryAudit(withRejected, scope());
    expect(partial.scopeMatchedCount).toBe(4);
    expect(partial.eligibleCount).toBe(3);
    expect(partial.coverage.scope).toBe(0.75);
    expect(partial.coverage.input).toBe(0.75);
    expect(partial.excluded.dismissed).toBe(1);
  });

  it('低于展示阈值时隐藏反馈、应用、主题和排除细分', () => {
    const summary = buildDiscoveryAudit(cloneMany(2, 'active'), scope());
    const text = formatDiscoveryAudit(summary);

    expect(summary.sampledCount).toBe(2);
    expect(text).toContain('detail');
    expect(text).toContain('feedback_detail: suppressed_small_group');
    expect(text).toContain('application_detail: suppressed_small_group');
    expect(text).toContain('theme_detail: suppressed_small_group');
    expect(text).not.toContain('feedback_none:');
    expect(text).not.toContain('application_none:');
    expect(text).not.toContain('theme_groups:');
    expect(text).not.toContain('excluded_invalid:');
  });

  it('format 使用白名单，不输出标题、路径、URI、ID、标签或 evidence 文本', () => {
    const summary = buildDiscoveryAudit(fixtureFile(), scope());
    const text = formatDiscoveryAudit(summary);

    expect(text).toContain('scope_declared: true');
    expect(text).toContain('real_user_authorization: false');
    expect(text).toContain('feedback_none: 4');
    expect(text).not.toContain('SENSITIVE-VAULT');
    expect(text).not.toContain('discovery_');
    expect(text).not.toContain('vault:');
    expect(text).not.toContain('A1');
    expect(text).not.toContain('#shared');
    expect(text).not.toContain('sourceUri');
  });

  it('错误信息不包含敏感原始字段', () => {
    const file = cloneMany(51, 'active');
    file.discoveries[0]!.id = 'SENSITIVE-ID';
    try {
      buildDiscoveryAudit(file, scope());
      throw new Error('expected limit');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toContain('active 51 > 50');
      expect(message).not.toContain('SENSITIVE-ID');
      expect(message).not.toContain('vault:');
    }
  });

  it('成功和失败均不修改输入对象', () => {
    const success = fixtureFile();
    const beforeSuccess = JSON.stringify(success);
    buildDiscoveryAudit(success, scope());
    expect(JSON.stringify(success)).toBe(beforeSuccess);

    const failure = cloneMany(51, 'active');
    const beforeFailure = JSON.stringify(failure);
    expect(() => buildDiscoveryAudit(failure, scope())).toThrowError(
      DiscoveryAuditLimitError,
    );
    expect(JSON.stringify(failure)).toBe(beforeFailure);
  });

  it('同一输入重复执行输出稳定', () => {
    const file = fixtureFile();
    const first = JSON.stringify(buildDiscoveryAudit(file, scope()));
    const second = JSON.stringify(buildDiscoveryAudit(file, scope()));
    expect(second).toBe(first);
  });

  it('判断选项固定为四个且不写回反馈', () => {
    expect(DISCOVERY_AUDIT_JUDGMENTS).toEqual([
      'worth-exploring',
      'related-but-low-value',
      'irrelevant',
      'insufficient-evidence',
    ]);
    const file = fixtureFile();
    const before = JSON.stringify(file);
    buildDiscoveryAudit(file, scope());
    expect(JSON.stringify(file)).toBe(before);
  });

  it('审计投影将自动收敛表示为布尔值，不泄露记录 id', () => {
    const record = fixtureFile().discoveries[0]!;
    const projected = projectDiscoveryAuditRecord({
      ...record,
      status: 'dismissed',
      supersededBy: 'discovery_do_not_leak',
    });
    expect(projected?.superseded).toBe(true);
    expect(projected).not.toHaveProperty('supersededBy');
    expect(JSON.stringify(projected)).not.toContain('discovery_do_not_leak');
  });
});
