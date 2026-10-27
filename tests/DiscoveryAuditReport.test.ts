import { describe, expect, it } from 'vitest';

import {
  normalizeAuditReportPath,
  saveAuditReport,
  type AuditReportStorage,
} from '../src/ui/auditReport';

class FakeReportStorage implements AuditReportStorage {
  readonly files = new Map<string, string>();
  readonly calls: string[] = [];
  failCreate = false;
  failModify = false;

  exists(path: string): boolean {
    return this.files.has(path);
  }

  isFile(path: string): boolean {
    return this.files.has(path);
  }

  async create(path: string, text: string): Promise<void> {
    this.calls.push(`create:${path}`);
    if (this.failCreate) throw new Error('create failed');
    this.files.set(path, text);
  }

  async modify(path: string, text: string): Promise<void> {
    this.calls.push(`modify:${path}`);
    if (this.failModify) throw new Error('modify failed');
    this.files.set(path, text);
  }
}

describe('Audit report saving', () => {
  it('accepts only relative Markdown report paths', () => {
    expect(normalizeAuditReportPath('InterestSeed-audit.md')).toBe('InterestSeed-audit.md');
    expect(normalizeAuditReportPath('reports/audit.md')).toBe('reports/audit.md');
    expect(normalizeAuditReportPath('../audit.md')).toBeNull();
    expect(normalizeAuditReportPath('/audit.md')).toBeNull();
    expect(normalizeAuditReportPath('audit.txt')).toBeNull();
    expect(normalizeAuditReportPath('   ')).toBeNull();
  });

  it('does not overwrite an existing report unless explicitly allowed', async () => {
    const storage = new FakeReportStorage();
    storage.files.set('audit.md', 'old');
    const result = await saveAuditReport(storage, 'audit.md', 'new', false);

    expect(result).toEqual({ ok: false, reason: 'exists', path: 'audit.md' });
    expect(storage.files.get('audit.md')).toBe('old');
    expect(storage.calls).toEqual([]);
  });

  it('allows explicit overwrite and saves only the provided text', async () => {
    const storage = new FakeReportStorage();
    storage.files.set('audit.md', 'old');
    const result = await saveAuditReport(storage, 'audit.md', 'aggregate only', true);

    expect(result).toEqual({ ok: true, path: 'audit.md' });
    expect(storage.files.get('audit.md')).toBe('aggregate only');
    expect(storage.calls).toEqual(['modify:audit.md']);
  });

  it('reports create failure and does not claim success', async () => {
    const storage = new FakeReportStorage();
    storage.failCreate = true;
    const result = await saveAuditReport(storage, 'new-audit.md', 'text', false);

    expect(result).toEqual({ ok: false, reason: 'failed', path: 'new-audit.md' });
    expect(storage.files.has('new-audit.md')).toBe(false);
  });

  it('reports modify failure and does not overwrite the existing report', async () => {
    const storage = new FakeReportStorage();
    storage.files.set('audit.md', 'old');
    storage.failModify = true;
    const result = await saveAuditReport(storage, 'audit.md', 'new', true);

    expect(result).toEqual({ ok: false, reason: 'failed', path: 'audit.md' });
    expect(storage.files.get('audit.md')).toBe('old');
  });

  it('rejects a directory target', async () => {
    const storage = new FakeReportStorage();
    storage.files.set('reports', 'not a file');
    const result = await saveAuditReport(storage, 'reports', 'new', false);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid-path');
  });
});
