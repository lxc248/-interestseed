import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DISCOVERY_RELATION,
  discoveryApplicationDefaults,
} from '../src/discovery/applicationDefaults';
import type { Discovery } from '../src/discovery/types';

const discovery = {
  id: 'd1',
  nodeIds: ['b', 'a'],
} as Discovery;

describe('discovery application defaults', () => {
  it('prefills source, target and a product default relation', () => {
    expect(discoveryApplicationDefaults(discovery)).toEqual({
      sourceNodeId: 'b',
      targetNodeId: 'a',
      relation: DEFAULT_DISCOVERY_RELATION,
    });
  });

  it('does not apply anything by itself', () => {
    expect(DEFAULT_DISCOVERY_RELATION).toBe('related-to');
    expect(discoveryApplicationDefaults(discovery).relation).toBe('related-to');
  });
});
