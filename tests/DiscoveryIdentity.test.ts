import { describe, expect, it } from 'vitest';
import {
  dedupeKeyFor,
  discoveryIdFor,
  encodeIdentityFields,
  evidenceProfile,
  identitySlotKey,
  suppressionKeyFor,
} from '../src/discovery/identity';

describe('discovery identity v2', () => {
  it('uses unambiguous length-prefixed field encoding', () => {
    expect(encodeIdentityFields(['a|b', 'c'])).not.toBe(
      encodeIdentityFields(['a', 'b|c']),
    );
  });

  it('normalizes order and case for dedupe and suppression keys', () => {
    const left = dedupeKeyFor(['P2', 'P1'], ['Tag', 'tag']);
    const right = dedupeKeyFor(['p1', 'p2'], ['TAG']);
    expect(left).toBe(right);

    const evidence = [
      { kind: 'source', nodeId: 'b' },
      { kind: 'source', nodeId: 'a' },
    ];
    expect(suppressionKeyFor(['P1', 'P2'], ['tag'], evidence)).toBe(
      suppressionKeyFor(['p2', 'p1'], ['TAG'], [...evidence].reverse()),
    );
  });

  it('keeps dedupe stable while different evidence changes suppression scope', () => {
    const dedupe = dedupeKeyFor(['P1', 'P2'], ['tag']);
    const first = suppressionKeyFor(['P1', 'P2'], ['tag'], [
      { kind: 'source', nodeId: 'a' },
    ]);
    const second = suppressionKeyFor(['P1', 'P2'], ['tag'], [
      { kind: 'source', nodeId: 'b' },
    ]);
    expect(first).not.toBe(second);
    expect(dedupe).toBe(dedupeKeyFor(['P1', 'P2'], ['tag']));
  });

  it('normalizes subject tags with leading hash', () => {
    expect(dedupeKeyFor(['P1'], ['#Tag'])).toBe(dedupeKeyFor(['p1'], ['tag']));
  });

  it('identity slots separate node pairs and ignore order', () => {
    const dedupe = dedupeKeyFor(['P1', 'P2'], ['tag']);
    expect(identitySlotKey(dedupe, ['a', 'b'])).toBe(
      identitySlotKey(dedupe, ['b', 'a']),
    );
    expect(identitySlotKey(dedupe, ['a', 'b'])).not.toBe(
      identitySlotKey(dedupe, ['a', 'c']),
    );
  });

  it('empty evidence uses record-scoped suppression, not a shared theme key', () => {
    const first = suppressionKeyFor(['P1', 'P2'], ['tag'], [], 'record-a');
    const second = suppressionKeyFor(['P1', 'P2'], ['tag'], [], 'record-b');
    expect(first).not.toBe(second);
    expect(first).not.toBe(
      suppressionKeyFor(['P1', 'P2'], ['tag'], [{ kind: 'source', nodeId: 'a' }]),
    );
  });

  it('changes discovery id with rule version but not dedupe key', () => {
    const dedupe = dedupeKeyFor(['P1', 'P2'], ['tag']);
    const evidence = evidenceProfile([{ kind: 'source', nodeId: 'a' }]);
    expect(discoveryIdFor(dedupe, evidence, 'v1')).not.toBe(
      discoveryIdFor(dedupe, evidence, 'v2'),
    );
    expect(dedupe).toBe(dedupeKeyFor(['P2', 'P1'], ['tag']));
  });
});
