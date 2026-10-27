import { afterEach, describe, expect, it, vi } from 'vitest';

import { PersistenceService } from '../src/plugin/PersistenceService';

describe('PersistenceService dirty tracking', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not save a clean graph on flush', async () => {
    let saves = 0;
    const service = new PersistenceService({
      store: { toJSON: () => ({}) } as never,
      repository: { save: async () => { saves += 1; } } as never,
      onStateChange: () => {},
      onError: () => {},
    });

    await service.flush();
    expect(saves).toBe(0);
  });

  it('saves once after a scheduled change, then stays clean', async () => {
    let saves = 0;
    const timers: Array<() => void> = [];
    vi.stubGlobal('window', {
      setTimeout: (callback: () => void) => {
        timers.push(callback);
        return timers.length;
      },
      clearTimeout: () => {},
    });
    const service = new PersistenceService({
      store: { toJSON: () => ({}) } as never,
      repository: { save: async () => { saves += 1; } } as never,
      debounceMs: 0,
      onStateChange: () => {},
      onError: () => {},
    });

    service.scheduleSave();
    expect(timers).toHaveLength(1);
    timers[0]!();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(saves).toBe(1);

    await service.flush();
    expect(saves).toBe(1);
  });
});
