import { TFile, normalizePath } from 'obsidian';
import type { App, CachedMetadata } from 'obsidian';
import { extractSummary } from '../core/GraphBuilder';
import type { InterestSeedNode } from '../types/graph';
import { pathFromUri, vaultUri } from '../utils/paths';
import {
  collectNodeTags,
  createSeedNode,
  matchesIncludeTags,
  nodeTypeFromFrontmatter,
  shouldScanPath,
  titleFromMetadata,
} from './vaultScan';

export interface VaultScanOptions {
  includeFolders: string[];
  excludeFolders: string[];
  includeTags: string[];
  maxFiles?: number;
}

export interface VaultScanResult {
  nodes: InterestSeedNode[];
  warnings: string[];
  scannedCount: number;
}

export interface ObsidianVaultAdapter {
  scanMarkdown(options: VaultScanOptions): Promise<VaultScanResult>;

  openSource(sourceUri: string): Promise<void>;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * 只通过 Obsidian 的 Vault / MetadataCache API 读取资料：
 * - `getMarkdownFiles()` 限定在当前 vault 内；
 * - `metadataCache.getFileCache()` 提供 frontmatter、标签、标题与出链；
 * - `vault.cachedRead()` 只用于生成摘要，不写回文件；
 * - 单个文件失败只记录 warning，不中断整个扫描。
 */
export class ObsidianVaultAdapterImpl implements ObsidianVaultAdapter {
  constructor(private readonly app: App) {}

  async scanMarkdown(options: VaultScanOptions): Promise<VaultScanResult> {
    const warnings: string[] = [];
    const maxFiles =
      options.maxFiles === undefined
        ? Number.POSITIVE_INFINITY
        : Math.max(0, options.maxFiles);

    const files = this.app.vault
      .getMarkdownFiles()
      .filter((file) => shouldScanPath(file.path, options))
      .sort((left, right) =>
        left.path === right.path ? 0 : left.path < right.path ? -1 : 1,
      )
      .slice(0, maxFiles);

    const nodes: InterestSeedNode[] = [];

    for (const file of files) {
      try {
        // MetadataCache 可能在索引中暂不可用；失败也只影响当前文件。
        const cache = this.app.metadataCache.getFileCache(file);
        const node = await this.readNode(file, cache, options, warnings);
        if (node) nodes.push(node);
      } catch (error) {
        warnings.push(`无法读取笔记 ${file.path}：${errorMessage(error)}`);
      }
    }

    return { nodes, warnings, scannedCount: files.length };
  }

  /** 重新扫描前用于展示“预计读取”数量。 */
  countMarkdown(options: VaultScanOptions): number {
    const maxFiles =
      options.maxFiles === undefined
        ? Number.POSITIVE_INFINITY
        : Math.max(0, options.maxFiles);

    return this.app.vault
      .getMarkdownFiles()
      .filter((file) => shouldScanPath(file.path, options))
      .slice(0, maxFiles).length;
  }

  async openSource(sourceUri: string): Promise<void> {
    const path = normalizePath(pathFromUri(sourceUri));
    const file = this.app.vault.getAbstractFileByPath(path);

    if (!(file instanceof TFile)) {
      throw new Error(`找不到文件：${path}`);
    }

    await this.app.workspace.getLeaf(false).openFile(file);
  }

  /** 供“从当前文件创建节点”使用；不属于扫描接口。 */
  getActiveFileUri(): string | null {
    const file = this.app.workspace.getActiveFile();
    return file instanceof TFile ? vaultUri(file.path) : null;
  }

  private async readNode(
    file: TFile,
    cache: CachedMetadata | null,
    options: VaultScanOptions,
    warnings: string[],
  ): Promise<InterestSeedNode | null> {
    const path = normalizePath(file.path);
    const frontmatter = (cache?.frontmatter ?? {}) as Record<string, unknown>;

    const tags = collectNodeTags(
      frontmatter.tags,
      cache?.tags?.map((tag) => tag.tag) ?? [],
    );

    if (!matchesIncludeTags(tags, options.includeTags)) return null;

    const title = titleFromMetadata(frontmatter.title, cache?.headings ?? [], path);
    const links = (cache?.links ?? [])
      .map((link) => link.link)
      .filter((link): link is string => Boolean(link && link.trim()));

    let summary = '';
    try {
      const content = await this.app.vault.cachedRead(file);
      summary = extractSummary(content);
    } catch (error) {
      warnings.push(`无法读取正文 ${path}：${errorMessage(error)}`);
    }

    return createSeedNode({
      uri: vaultUri(path),
      path,
      title,
      type: nodeTypeFromFrontmatter(frontmatter),
      tags,
      createdAt: new Date(file.stat.ctime).toISOString(),
      updatedAt: new Date(file.stat.mtime).toISOString(),
      summary,
      links,
      extension: 'md',
    });
  }
}
