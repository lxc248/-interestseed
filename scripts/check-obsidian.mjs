/**
 * Obsidian 社区插件目录的最低合规检查。
 * 只检查“能在本地判定”的条件；release 资产需要网络，用 OBSIDIAN_CHECK_RELEASE=1 开启。
 */
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const errors = [];
const notes = [];

async function readJson(path) {
  const text = await readFile(path, 'utf8');
  return JSON.parse(text);
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

const manifest = await readJson(resolve(root, 'manifest.json'));
const pkg = await readJson(resolve(root, 'package.json'));
const versions = await readJson(resolve(root, 'versions.json'));

for (const key of [
  'id',
  'name',
  'version',
  'minAppVersion',
  'description',
  'author',
  'isDesktopOnly',
]) {
  if (manifest[key] === undefined) errors.push(`manifest.json 缺少字段 ${key}`);
}

if (typeof manifest.id === 'string') {
  if (!/^[a-z0-9-]+$/.test(manifest.id)) {
    errors.push(`manifest.id 只能是小写字母、数字和连字符：${manifest.id}`);
  }
  if (manifest.id.includes('obsidian')) errors.push('manifest.id 不能包含 obsidian');
}

if (typeof manifest.name === 'string') {
  if (/obsidian/i.test(manifest.name)) errors.push('manifest.name 不能包含 Obsidian');
  if (/plugin/i.test(manifest.name)) errors.push('manifest.name 不能包含 Plugin');
}

if (typeof manifest.description === 'string') {
  if (manifest.description.trim().length === 0) errors.push('manifest.description 不能为空');
  if (manifest.description.length > 250) {
    errors.push(`manifest.description 超过 250 字符：${manifest.description.length}`);
  }
}

if (manifest.version !== pkg.version) {
  errors.push(`manifest.version(${manifest.version}) 与 package.json(${pkg.version}) 不一致`);
}

if (!/^\d+\.\d+\.\d+$/.test(String(manifest.version))) {
  errors.push(`manifest.version 必须是 x.y.z 形式：${manifest.version}`);
}

const expectedMinApp = versions[manifest.version];
if (!expectedMinApp) {
  errors.push(`versions.json 缺少版本 ${manifest.version} 的条目`);
} else if (expectedMinApp !== manifest.minAppVersion) {
  errors.push(
    `versions.json[${manifest.version}]=${expectedMinApp} 与 minAppVersion=${manifest.minAppVersion} 不一致`,
  );
}

const notesPath = resolve(root, `RELEASE_NOTES_${manifest.version}.md`);
if (!(await exists(notesPath))) {
  errors.push(`缺少发布说明 RELEASE_NOTES_${manifest.version}.md（发布工作流会用到）`);
}

// README 的安装说明必须指向真实存在的包名，否则用户下不到东西。
for (const readme of ['README.md', 'README.en.md']) {
  const text = await readFile(resolve(root, readme), 'utf8');
  const needle = `interestseed-${manifest.version}.zip`;
  if (!text.includes(needle)) {
    errors.push(`${readme} 未引用实际的插件包名 ${needle}（安装步骤会指向不存在的文件）`);
  }
}

const mainTs = await readFile(resolve(root, 'src/main.ts'), 'utf8');
if (/\beval\s*\(/.test(mainTs)) errors.push('src/main.ts 使用了 eval，Obsidian 审核不允许');

if (process.env.OBSIDIAN_CHECK_RELEASE === '1') {
  // URL 里只允许用重新拼出来的数字版本号和仓库名白名单，避免把文件内容直接带进网络请求。
  const [major, minor, patch] = String(manifest.version)
    .split('.')
    .map((part) => Number.parseInt(part, 10));
  const safeVersion = [major, minor, patch]
    .map((part) => (Number.isInteger(part) && part >= 0 ? part : 0))
    .join('.');

  const rawRepo = process.env.GITHUB_REPOSITORY || 'lxc248/-interestseed';
  const repoMatch = /^([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)$/.exec(rawRepo);
  if (!repoMatch) {
    errors.push(`GITHUB_REPOSITORY 格式不合法：${rawRepo}`);
  } else {
    const repo = `${repoMatch[1]}/${repoMatch[2]}`;
    const token = process.env.GITHUB_TOKEN;
    const response = await fetch(
      `https://api.github.com/repos/${repo}/releases/tags/${safeVersion}`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'User-Agent': 'interestseed-check',
        },
      },
    );
    if (!response.ok) {
      errors.push(`未找到 tag=${safeVersion} 的 release（HTTP ${response.status}）`);
    } else {
      const release = await response.json();
      const names = new Set((release.assets ?? []).map((asset) => asset.name));
      for (const asset of ['main.js', 'manifest.json', 'styles.css']) {
        if (!names.has(asset)) errors.push(`release ${safeVersion} 缺少资产 ${asset}`);
      }
      const zipName = `interestseed-${safeVersion}.zip`;
      if (!names.has(zipName)) {
        errors.push(`release 缺少插件包 ${zipName}（README 安装说明会 404）`);
      }
    }
  }
} else {
  notes.push('未检查 release 资产（设置 OBSIDIAN_CHECK_RELEASE=1 可启用）');
}

if (errors.length > 0) {
  console.error('Obsidian 合规检查失败：');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `Obsidian check passed: id=${manifest.id}, version=${manifest.version}, isDesktopOnly=${manifest.isDesktopOnly}`,
);
for (const note of notes) console.log(`note: ${note}`);
