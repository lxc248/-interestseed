import { isNodeType } from '../types/graph';
import type { InterestSeedNode, NodeType } from '../types/graph';
import { nodeIdForUri } from '../utils/ids';
import { isInsideFolder, noteTitleFromPath } from '../utils/paths';
import { sanitizeTags, tagKey } from '../utils/validation';

export interface ScanScope {
  includeFolders: string[];
  excludeFolders: string[];
}

/**
 * 扫描范围：先排除，再按 include 白名单；include 为空表示整个 vault。
 * 只处理 vault 内相对路径，不涉及任何绝对路径拼接。
 */
export function shouldScanPath(path: string, scope: ScanScope): boolean {
  if (scope.excludeFolders.some((folder) => isInsideFolder(path, folder))) {
    return false;
  }
  if (scope.includeFolders.length === 0) return true;
  return scope.includeFolders.some((folder) => isInsideFolder(path, folder));
}

/** 合并 frontmatter tags 与 MetadataCache 的内联标签。 */
export function collectNodeTags(
  frontmatterTags: unknown,
  inlineTags: readonly string[],
): string[] {
  const raw: string[] = [];

  const push = (value: unknown): void => {
    if (typeof value === 'string') {
      raw.push(...value.split(/[,，;；\s]+/));
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') raw.push(item);
      }
    }
  };

  push(frontmatterTags);
  raw.push(...inlineTags);

  return sanitizeTags(raw);
}

export function matchesIncludeTags(tags: string[], includeTags: string[]): boolean {
  if (includeTags.length === 0) return true;
  const wanted = new Set(includeTags.map((tag) => tagKey(tag)));
  return tags.some((tag) => wanted.has(tagKey(tag)));
}

/**
 * 类型优先级：frontmatter.type → project / activity 标记 → 默认 document。
 * 扫描只处理 Markdown，因此这里不需要扩展名分支。
 */
export function nodeTypeFromFrontmatter(frontmatter: Record<string, unknown>): NodeType {
  const declared = frontmatter.type;
  if (isNodeType(declared)) return declared;

  const project = frontmatter.project;
  if (project === true || project === 'true') return 'project';
  const activity = frontmatter.activity;
  if (activity === true || activity === 'true') return 'activity';

  return 'document';
}

export function titleFromMetadata(
  frontmatterTitle: unknown,
  headings: ReadonlyArray<{ heading: string; level: number }>,
  path: string,
): string {
  if (typeof frontmatterTitle === 'string' && frontmatterTitle.trim()) {
    return frontmatterTitle.trim();
  }

  const firstHeading = headings.find(
    (heading) => heading.level === 1 && heading.heading.trim(),
  );
  if (firstHeading) return firstHeading.heading.trim();

  return noteTitleFromPath(path);
}

export interface SeedNodeInput {
  uri: string;
  path: string;
  title: string;
  type: NodeType;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  summary: string;
  links: string[];
  extension: string;
}

/**
 * 把一次扫描结果转换为节点。节点只保存索引与图谱信息：
 * 路径、扩展名、摘要、出链列表，不保存正文。
 */
export function createSeedNode(input: SeedNodeInput): InterestSeedNode {
  const metadata: Record<string, unknown> = {
    path: input.path,
    extension: input.extension,
    links: [...input.links],
  };
  if (input.summary) metadata.summary = input.summary;

  return {
    id: nodeIdForUri(input.uri),
    type: input.type,
    title: input.title,
    sourceUri: input.uri,
    tags: [...input.tags],
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    metadata,
  };
}
