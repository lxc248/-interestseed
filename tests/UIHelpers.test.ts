import { describe, expect, it, vi } from 'vitest';
import { collectSuggestedEdges } from '../src/ui/suggestionList';
import { normalizeAuditReportPath, saveAuditReport } from '../src/ui/auditReport';
import {
  activeThemePeerCounts,
  discoveryDisplayMetrics,
  discoveryThemeKey,
  groupDiscoveriesByTheme,
  isValidSourceUri,
} from '../src/ui/discoveryPresentation';
import type { InterestSeedEdge, InterestSeedNode } from '../src/types/graph';

const edge = (id: string, confidence: number): InterestSeedEdge => ({
  id,
  source: 'a',
  target: 'missing',
  relation: 'related-to',
  origin: 'rule',
  status: 'suggested',
  confidence,
  createdAt: '',
  updatedAt: '',
});

const node = (id: string): InterestSeedNode => ({
  id,
  type: 'topic',
  title: id,
  tags: [],
  createdAt: '',
  updatedAt: '',
  metadata: {},
});

describe('suggestionList', () => {
  it('sorts suggested edges by confidence and keeps missing endpoints', () => {
    const store = {
      listEdges: () => [edge('low', 0.2), edge('high', 0.9)],
      getNode: (id: string) => (id === 'a' ? node('a') : undefined),
    };
    const rows = collectSuggestedEdges(store);
    expect(rows.map((row) => row.edge.id)).toEqual(['high', 'low']);
    expect(rows[0]?.source?.id).toBe('a');
    expect(rows[0]?.target).toBeUndefined();
  });
});

describe('auditReport', () => {
  it('rejects unsafe paths', () => {
    expect(normalizeAuditReportPath('')).toBeNull();
    expect(normalizeAuditReportPath('/abs/report.md')).toBeNull();
    expect(normalizeAuditReportPath('C:\\report.md')).toBeNull();
    expect(normalizeAuditReportPath('../report.md')).toBeNull();
    expect(normalizeAuditReportPath('Reports/report.md')).toBe('Reports/report.md');
  });

  it('creates, overwrites, and refuses non-files', async () => {
    const storage = {
      exists: vi.fn(() => false),
      isFile: vi.fn(() => true),
      create: vi.fn(async () => {}),
      modify: vi.fn(async () => {}),
    };
    const created = await saveAuditReport(storage, 'Reports/report.md', 'text', false);
    expect(created).toEqual({ ok: true, path: 'Reports/report.md' });
    expect(storage.create).toHaveBeenCalled();

    storage.exists.mockReturnValue(true);
    const refused = await saveAuditReport(storage, 'Reports/report.md', 'text', false);
    expect(refused).toEqual({ ok: false, reason: 'exists', path: 'Reports/report.md' });

    const overwritten = await saveAuditReport(storage, 'Reports/report.md', 'text', true);
    expect(overwritten.ok).toBe(true);
    expect(storage.modify).toHaveBeenCalled();

    storage.isFile.mockReturnValue(false);
    const notFile = await saveAuditReport(storage, 'Reports/report.md', 'text', true);
    expect(notFile).toEqual({ ok: false, reason: 'not-file', path: 'Reports/report.md' });
  });
});

describe('discoveryPresentation', () => {
  const discovery = {
    status: 'active',
    subjectKeys: ['b', 'a'],
    nodeIds: ['a', 'b'],
    evidence: [
      { kind: 'source', nodeId: 'a', sourceUri: 'Notes/a.md', text: '来源' },
      { kind: 'shared-tag', nodeId: 'b', text: '共同标签' },
      { kind: 'confirmed-edge', nodeId: 'a', text: '已确认关系' },
    ],
  };

  it('validates source URIs and groups themes', () => {
    expect(isValidSourceUri('Notes/a.md')).toBe(true);
    expect(isValidSourceUri('https://example.com/a')).toBe(false);
    expect(isValidSourceUri('')).toBe(false);
    expect(discoveryThemeKey(discovery as never)).toBe('a\u0000b');
    const groups = groupDiscoveriesByTheme([discovery as never, { ...discovery, status: 'dismissed' } as never]);
    expect(groups.size).toBe(1);
    expect(activeThemePeerCounts([discovery as never, { ...discovery, status: 'dismissed' } as never]).get('a\u0000b')).toBe(1);
  });

  it('computes display metrics without pretending to score quality', () => {
    const metrics = discoveryDisplayMetrics(discovery as never);
    expect(metrics.nodeCount).toBe(2);
    expect(metrics.evidenceCount).toBe(3);
    expect(metrics.sourceEvidenceCount).toBe(1);
    expect(metrics.sharedTagEvidenceCount).toBe(1);
    expect(metrics.confirmedEvidenceCount).toBe(1);
    expect(metrics.sourceComplete).toBe(false);
    expect(metrics.traceableEvidenceCount).toBe(3);
  });
});
