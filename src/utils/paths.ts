/**
 * 仓库路径工具。内部统一使用 POSIX 风格、无前导斜杠的相对路径。
 */

export const VAULT_URI_SCHEME = 'vault:';

export function normalizePath(input: string): string {
  const unix = (input ?? '').replace(/\\/g, '/');
  const parts: string[] = [];
  for (const part of unix.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return parts.join('/');
}

export function basename(path: string): string {
  const normalized = normalizePath(path);
  const index = normalized.lastIndexOf('/');
  return index === -1 ? normalized : normalized.slice(index + 1);
}

export function dirname(path: string): string {
  const normalized = normalizePath(path);
  const index = normalized.lastIndexOf('/');
  return index === -1 ? '' : normalized.slice(0, index);
}

/** 小写扩展名，不带点；没有扩展名时返回空串。 */
export function extensionOf(path: string): string {
  const base = basename(path);
  const index = base.lastIndexOf('.');
  return index <= 0 ? '' : base.slice(index + 1).toLowerCase();
}

export function stripExtension(path: string): string {
  const extension = extensionOf(path);
  if (!extension) return path;
  return path.slice(0, path.length - extension.length - 1);
}

export function isMarkdownFile(path: string): boolean {
  return extensionOf(path) === 'md';
}

/** `兴趣/深度工作_笔记.md` → `深度工作 笔记` */
export function noteTitleFromPath(path: string): string {
  return stripExtension(basename(path))
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 把 `[[目标#标题|别名]]` 中的目标部分转换成笔记路径（补 .md）。 */
export function linkTargetToPath(raw: string): string {
  const withoutAlias = (raw.split('|')[0] ?? raw).split('#')[0] ?? '';
  const trimmed = withoutAlias.trim();
  if (!trimmed) return '';
  const normalized = normalizePath(trimmed);
  return /\.md$/i.test(normalized) ? normalized : `${normalized}.md`;
}

export function isSamePath(left: string, right: string): boolean {
  return normalizePath(left).toLowerCase() === normalizePath(right).toLowerCase();
}

/** path 是否位于 folder 中（含 folder 本身）。 */
export function isInsideFolder(path: string, folder: string): boolean {
  const normalizedPath = normalizePath(path);
  const normalizedFolder = normalizePath(folder);
  if (!normalizedFolder) return true;
  return (
    normalizedPath === normalizedFolder ||
    normalizedPath.startsWith(`${normalizedFolder}/`)
  );
}

/** 生成 node.sourceUri：`vault:笔记/深度工作.md`。 */
export function vaultUri(path: string): string {
  return `${VAULT_URI_SCHEME}${normalizePath(path)}`;
}

/** 从 sourceUri 还原 vault 路径；兼容直接存路径的旧数据。 */
export function pathFromUri(uri: string): string {
  const value = uri.trim();
  if (value.toLowerCase().startsWith(VAULT_URI_SCHEME)) {
    return normalizePath(value.slice(VAULT_URI_SCHEME.length));
  }
  return normalizePath(value);
}

/** 生成安全的文件名：去掉 Windows / Obsidian 不允许的字符。 */
export function slugifyFileName(input: string): string {
  const normalized = input.normalize('NFKC').trim();
  const cleaned = normalized
    .replace(/[\\/:*?"<>|#^[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || '未命名节点';
}
