import { describe, expect, it } from 'vitest';
import { pathFromUri } from '../src/utils/paths';
import { isValidSourceUri } from '../src/ui/discoveryPresentation';

describe('bug hunt: source URI boundaries', () => {
  it('rejects absolute and Windows drive paths', () => {
    expect(isValidSourceUri('/etc/passwd')).toBe(false);
    expect(isValidSourceUri('C:\\Users\\me\\secret.md')).toBe(false);
    expect(isValidSourceUri('C:/Users/me/secret.md')).toBe(false);
    expect(isValidSourceUri('\\\\server\\share\\secret.md')).toBe(false);
  });

  it('keeps vault-relative paths valid', () => {
    expect(isValidSourceUri('Notes/a.md')).toBe(true);
    expect(isValidSourceUri('vault:Notes/a.md')).toBe(true);
    expect(pathFromUri('vault:Notes/a.md')).toBe('Notes/a.md');
  });
});
