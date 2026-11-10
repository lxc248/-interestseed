import { describe, expect, it, vi } from 'vitest';
import { readAiApiKey, saveAiApiKey } from '../../src/plugin/aiKeyStore';

function appWithStorage(overrides: Record<string, unknown> = {}) {
  const storage = {
    getSecret: vi.fn(async () => null),
    setSecret: vi.fn(async () => undefined),
    deleteSecret: vi.fn(async () => undefined),
    ...overrides,
  };
  return { app: { secretStorage: storage } as never, storage };
}

describe('aiKeyStore', () => {
  it('returns undefined when no secret storage exists', async () => {
    expect(await readAiApiKey({} as never)).toBeUndefined();
    expect(await saveAiApiKey({} as never, 'x')).toBe(false);
  });

  it('reads and trims a stored key', async () => {
    const { app, storage } = appWithStorage({
      getSecret: vi.fn(async () => '  secret-key  '),
    });
    expect(await readAiApiKey(app)).toBe('secret-key');
    expect(storage.getSecret).toHaveBeenCalledWith('interestseed-ai-key');
  });

  it('saves and deletes a key', async () => {
    const { app, storage } = appWithStorage();
    expect(await saveAiApiKey(app, '  next-key  ')).toBe(true);
    expect(storage.setSecret).toHaveBeenCalledWith('interestseed-ai-key', 'next-key');
    expect(await saveAiApiKey(app, '   ')).toBe(true);
    expect(storage.deleteSecret).toHaveBeenCalledWith('interestseed-ai-key');
  });

  it('treats a storage read failure as no key', async () => {
    const { app } = appWithStorage({
      getSecret: vi.fn(async () => {
        throw new Error('denied');
      }),
    });
    expect(await readAiApiKey(app)).toBeUndefined();
  });

  it('returns false when saving a key fails', async () => {
    const { app } = appWithStorage({
      setSecret: vi.fn(async () => {
        throw new Error('denied');
      }),
    });
    expect(await saveAiApiKey(app, 'key')).toBe(false);
  });

  it('returns false when deleting a blank key fails', async () => {
    const { app } = appWithStorage({
      deleteSecret: vi.fn(async () => {
        throw new Error('denied');
      }),
    });
    expect(await saveAiApiKey(app, '   ')).toBe(false);
  });
});
