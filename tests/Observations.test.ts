import { describe, expect, it } from 'vitest';
import {
  appendObservation,
  latestObservation,
  normalizeObservations,
} from '../src/core/observations';

describe('Observation timeline', () => {
  it('appends newest observations and keeps valid fields', () => {
    const first = appendObservation(undefined, {
      source: 'note',
      sourceRef: 'A.md',
      evidence: '第一次观察',
      belief: 'changed',
      at: '2026-10-01T00:00:00.000Z',
    });
    const second = appendObservation({ observations: first }, {
      source: 'experiment',
      evidence: '第二次观察',
      belief: 'stronger',
      at: '2026-10-02T00:00:00.000Z',
    });
    expect(second[0]?.evidence).toBe('第二次观察');
    expect(second[1]?.sourceRef).toBe('A.md');
    expect(latestObservation({ observations: second })?.belief).toBe('stronger');
  });

  it('ignores malformed observations and caps the list', () => {
    const malformed = normalizeObservations([null, { id: 'x' }, { id: 'y', at: 'z', evidence: 'ok' }]);
    expect(malformed).toHaveLength(1);
    expect(malformed[0]?.belief).toBe('changed');
  });
});
