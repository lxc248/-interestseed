import { describe, expect, it } from 'vitest';

import { validateTag } from '../scripts/check-tag.mjs';

const versions = { plugin: '3.7.3', standalone: '4.0.11' };

describe('release tag rules', () => {
  it('accepts a plugin tag that matches manifest.version', () => {
    expect(validateTag('3.7.3', 'plugin', versions)).toEqual([]);
  });

  it('rejects a plugin tag with a v prefix', () => {
    const problems = validateTag('v3.7.3', 'plugin', versions);
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join(' ')).toContain('不接受前缀');
  });

  it('rejects a plugin tag that drifted from manifest.version', () => {
    const problems = validateTag('3.7.2', 'plugin', versions);
    expect(problems.join(' ')).toContain('manifest.version');
  });

  it('accepts the standalone tag shape', () => {
    expect(validateTag('standalone-v4.0.11', 'standalone', versions)).toEqual([]);
  });

  it('explains the missing v on a standalone tag', () => {
    const problems = validateTag('standalone-4.0.11', 'standalone', versions);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('standalone-v4.0.11');
  });

  it('catches a plugin-shaped tag used for the standalone release', () => {
    const problems = validateTag('4.0.11', 'standalone', versions);
    expect(problems[0]).toContain('standalone-v');
  });

  it('rejects a standalone tag that drifted from package.json', () => {
    const problems = validateTag('standalone-v4.0.10', 'standalone', versions);
    expect(problems.join(' ')).toContain('standalone/package.json');
  });

  it('rejects empty tags and unknown kinds', () => {
    expect(validateTag('', 'plugin', versions)).toEqual(['标签为空']);
    expect(validateTag('  ', 'standalone', versions)).toEqual(['标签为空']);
    expect(validateTag('1.0.0', 'nope' as 'plugin', versions)[0]).toContain('未知发布类型');
  });

  it('skips version comparison when the version file is missing', () => {
    expect(validateTag('9.9.9', 'plugin', {})).toEqual([]);
    expect(validateTag('standalone-v9.9.9', 'standalone', {})).toEqual([]);
  });
});
