import { describe, expect, it } from 'vitest';

import { applyDiscoveryFeedback, undoDiscoveryFeedback } from '../src/discovery/feedback';
import { emptyDiscoveryFile } from '../src/discovery/types';
import type { Discovery, DiscoveryFile } from '../src/discovery/types';

const NOW = '2026-01-01T00:00:00.000Z';

function discovery(overrides: Partial<Discovery> = {}): Discovery {
  return {
    id: 'd1',
    kind: 'cross-project-topic',
    title: '原始标题',
    description: '原始描述',
    nodeIds: ['a', 'b'],
    projectKeys: ['P1', 'P2'],
    subjectKeys: ['theme'],
    evidence: [{ kind: 'shared-tag', nodeId: 'a', text: '证据' }],
    ruleVersion: 'v1',
    strength: 'strong',
    dedupeKey: 'dedupe',
    status: 'active',
    feedbackStatus: 'none',
    application: { state: 'none' },
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function fileWith(item = discovery()): DiscoveryFile {
  const file = emptyDiscoveryFile(NOW);
  file.discoveries.push(item);
  return file;
}

describe('Discovery feedback semantics', () => {
  it('supports all five feedback actions and records history', () => {
    let file = fileWith();
    for (const action of [
      'accepted',
      'rejected',
      'corrected',
      'low-value',
      'needs-verification',
    ] as const) {
      file = applyDiscoveryFeedback(file, 'd1', action, NOW);
      expect(file.discoveries[0]?.feedbackStatus).toBe(action);
      expect(file.discoveries[0]?.feedbackHistory).toHaveLength(
        ['accepted', 'rejected', 'corrected', 'low-value', 'needs-verification'].indexOf(action) + 1,
      );
    }
  });

  it('corrected preserves original text and stores correction separately', () => {
    const file = applyDiscoveryFeedback(fileWith(), 'd1', 'corrected', NOW, {
      title: '修正标题',
      description: '修正描述',
      createdAt: NOW,
    });
    const item = file.discoveries[0]!;
    expect(item.feedbackStatus).toBe('corrected');
    expect(item.status).toBe('active');
    expect(item.title).toBe('原始标题');
    expect(item.description).toBe('原始描述');
    expect(item.correction).toMatchObject({
      title: '修正标题',
      description: '修正描述',
    });
  });

  it('low-value dismisses only this discovery and is not rejected', () => {
    const file = applyDiscoveryFeedback(fileWith(), 'd1', 'low-value', NOW);
    expect(file.discoveries[0]?.status).toBe('dismissed');
    expect(file.discoveries[0]?.feedbackStatus).toBe('low-value');
    expect(file.discoveries[0]?.feedbackStatus).not.toBe('rejected');
  });

  it('undo restores each feedback action to none/active', () => {
    for (const action of [
      'accepted',
      'rejected',
      'corrected',
      'low-value',
      'needs-verification',
    ] as const) {
      let file = applyDiscoveryFeedback(fileWith(), 'd1', action, NOW);
      file = undoDiscoveryFeedback(file, 'd1', NOW);
      expect(file.discoveries[0]?.feedbackStatus).toBe('none');
      expect(file.discoveries[0]?.status).toBe('active');
      expect(file.discoveries[0]?.feedbackHistory?.at(-1)?.action).toBe('undo');
    }
  });

  it('undo restores none/active and does not delete history', () => {
    let file = applyDiscoveryFeedback(fileWith(), 'd1', 'rejected', NOW);
    file = undoDiscoveryFeedback(file, 'd1', NOW);
    const item = file.discoveries[0]!;
    expect(item.feedbackStatus).toBe('none');
    expect(item.status).toBe('active');
    expect(item.feedbackHistory?.at(-1)?.action).toBe('undo');
  });

  it('undo does not remove an already applied graph relation', () => {
    const applied = discovery({
      feedbackStatus: 'accepted',
      application: { state: 'applied', edgeId: 'edge-1' },
    });
    const file = undoDiscoveryFeedback(fileWith(applied), 'd1', NOW);
    expect(file.discoveries[0]?.feedbackStatus).toBe('none');
    expect(file.discoveries[0]?.status).toBe('active');
    expect(file.discoveries[0]?.application).toEqual({
      state: 'applied',
      edgeId: 'edge-1',
    });
  });

  it('does not undo while applying or recovery is unresolved', () => {
    for (const state of ['applying', 'recovery-required'] as const) {
      const item = discovery({
        feedbackStatus: 'accepted',
        application: { state, edgeId: 'edge-1' },
      });
      const initial = fileWith(item);
      const result = undoDiscoveryFeedback(initial, 'd1', NOW);
      expect(result).toBe(initial);
    }
  });

  it('does not change feedback while applying or recovery is unresolved', () => {
    for (const state of ['applying', 'recovery-required'] as const) {
      const initial = fileWith(
        discovery({
          feedbackStatus: 'none',
          application: { state, edgeId: 'edge-1' },
        }),
      );
      expect(applyDiscoveryFeedback(initial, 'd1', 'accepted', NOW)).toBe(initial);
      expect(undoDiscoveryFeedback(initial, 'd1', NOW)).toBe(initial);
    }
  });

  it('repeated undo is idempotent', () => {
    let file = applyDiscoveryFeedback(fileWith(), 'd1', 'accepted', NOW);
    file = undoDiscoveryFeedback(file, 'd1', NOW);
    const before = file;
    const after = undoDiscoveryFeedback(file, 'd1', NOW);
    expect(after).toBe(before);
    expect(after.discoveries[0]?.feedbackHistory).toHaveLength(2);
  });
});
