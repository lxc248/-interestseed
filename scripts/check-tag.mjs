/**
 * Validate a release tag against the conventions this repository actually uses.
 *
 * Two tracks exist and they are easy to confuse:
 *   plugin       tag = `3.7.3`            (no prefix, must equal manifest.version)
 *   standalone   tag = `standalone-v4.0.11` (v prefixed, must equal standalone/package.json)
 *
 * A wrong tag used to fail deep inside the release job with a confusing message
 * (`4.0.11 != standalone-4.0.11`), so this runs first and says what is wrong.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SEMVER = /^\d+\.\d+\.\d+$/;
const PLUGIN_TAG = /^\d+\.\d+\.\d+$/;
const STANDALONE_TAG = /^standalone-v(\d+\.\d+\.\d+)$/;

/**
 * @returns {string[]} human readable problems; empty means the tag is usable.
 */
export function validateTag(tag, kind, versions = {}) {
  const problems = [];
  const value = typeof tag === 'string' ? tag.trim() : '';

  if (!value) {
    return ['标签为空'];
  }

  if (kind === 'plugin') {
    if (!PLUGIN_TAG.test(value)) {
      problems.push(`插件标签必须是 x.y.z，不接受前缀或 v：收到 "${value}"`);
    }
    if (versions.plugin && value !== versions.plugin) {
      problems.push(`标签 "${value}" 与 manifest.version "${versions.plugin}" 不一致`);
    }
    return problems;
  }

  if (kind === 'standalone') {
    const match = STANDALONE_TAG.exec(value);
    if (!match) {
      const hint = SEMVER.test(value)
        ? `看起来是插件标签；独立版需要 standalone-v 前缀`
        : value.startsWith('standalone-')
          ? `缺少 v：应为 "standalone-v${value.slice('standalone-'.length)}"`
          : `应为 "standalone-v<version>"`;
      problems.push(`独立版标签格式错误：收到 "${value}"，${hint}`);
    }
    const version = match?.[1] ?? '';
    if (version && versions.standalone && version !== versions.standalone) {
      problems.push(
        `标签版本 "${version}" 与 standalone/package.json "${versions.standalone}" 不一致`,
      );
    }
    return problems;
  }

  problems.push(`未知发布类型："${kind}"（应为 plugin 或 standalone）`);
  return problems;
}

export function readVersions(root) {
  const read = (path, key) => {
    try {
      const parsed = JSON.parse(readFileSync(resolve(root, path), 'utf8'));
      return typeof parsed?.[key] === 'string' ? parsed[key] : '';
    } catch {
      return '';
    }
  };
  return {
    plugin: read('manifest.json', 'version'),
    standalone: read('standalone/package.json', 'version'),
  };
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isDirectRun) {
  const [kind, tag] = process.argv.slice(2);
  const root = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
  const problems = validateTag(tag, kind, readVersions(root));
  if (problems.length > 0) {
    console.error(`Tag check failed for "${tag ?? ''}" (${kind ?? 'no kind'}):`);
    for (const problem of problems) console.error(`- ${problem}`);
    process.exit(1);
  }
  console.log(`Tag check passed: ${tag} (${kind})`);
}
