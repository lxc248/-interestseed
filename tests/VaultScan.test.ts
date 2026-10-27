import { describe, expect, it } from 'vitest';
import {
  collectNodeTags,
  createSeedNode,
  matchesIncludeTags,
  nodeTypeFromFrontmatter,
  shouldScanPath,
  titleFromMetadata,
} from '../src/adapters/vaultScan';

const NOW = '2026-01-01T00:00:00.000Z';

describe('扫描范围', () => {
  it('默认扫描整个 vault', () => {
    expect(shouldScanPath('Notes/a.md', { includeFolders: [], excludeFolders: [] })).toBe(true);
  });

  it('排除配置目录，排除优先于包含', () => {
    expect(
      shouldScanPath('Archive/a.md', {
        includeFolders: [],
        excludeFolders: ['Archive'],
      }),
    ).toBe(false);

    expect(
      shouldScanPath('Projects/Archive/a.md', {
        includeFolders: ['Projects'],
        excludeFolders: ['Projects/Archive'],
      }),
    ).toBe(false);
  });

  it('允许只选择某个项目目录', () => {
    const scope = { includeFolders: ['Projects'], excludeFolders: [] };
    expect(shouldScanPath('Projects/Alpha.md', scope)).toBe(true);
    expect(shouldScanPath('Projects/Alpha/Notes.md', scope)).toBe(true);
    expect(shouldScanPath('Notes/Beta.md', scope)).toBe(false);
  });
});

describe('MetadataCache 数据归一化', () => {
  it('合并 frontmatter 标签与内联标签并去重', () => {
    const tags = collectNodeTags(['focus', '#Focus'], ['#方法', '#focus']);
    expect(tags).toEqual(['focus', '方法']);
  });

  it('includeTags 为空时纳入全部，否则要求命中', () => {
    expect(matchesIncludeTags(['focus'], [])).toBe(true);
    expect(matchesIncludeTags(['focus'], ['focus'])).toBe(true);
    expect(matchesIncludeTags(['other'], ['focus'])).toBe(false);
  });

  it('类型来自 frontmatter，默认 document', () => {
    expect(nodeTypeFromFrontmatter({ type: 'project' })).toBe('project');
    expect(nodeTypeFromFrontmatter({ project: true })).toBe('project');
    expect(nodeTypeFromFrontmatter({ activity: 'true' })).toBe('activity');
    expect(nodeTypeFromFrontmatter({})).toBe('document');
    expect(nodeTypeFromFrontmatter({ type: 'image' })).toBe('image');
  });

  it('标题优先 frontmatter，其次一级标题，最后文件名', () => {
    expect(titleFromMetadata('自定义标题', [], 'Notes/a.md')).toBe('自定义标题');
    expect(
      titleFromMetadata(undefined, [{ heading: '正文标题', level: 1 }], 'Notes/a.md'),
    ).toBe('正文标题');
    expect(titleFromMetadata(undefined, [{ heading: '二级', level: 2 }], 'Notes/方案_初稿.md')).toBe(
      '方案 初稿',
    );
  });
});

describe('createSeedNode', () => {
  it('生成稳定 id 与只含索引的 metadata', () => {
    const input = {
      uri: 'vault:Notes/a.md',
      path: 'Notes/a.md',
      title: 'A',
      type: 'document' as const,
      tags: ['focus'],
      createdAt: NOW,
      updatedAt: NOW,
      summary: '摘要',
      links: ['Notes/b'],
      extension: 'md',
    };

    const first = createSeedNode(input);
    const second = createSeedNode(input);

    expect(first.id).toBe(second.id);
    expect(first.id).toMatch(/^node_/);
    expect(first.sourceUri).toBe('vault:Notes/a.md');
    expect(first.metadata.path).toBe('Notes/a.md');
    expect(first.metadata.links).toEqual(['Notes/b']);
    expect(first.metadata.summary).toBe('摘要');
    expect(first.metadata).not.toHaveProperty('content');
  });

  it('不同路径得到不同 id，来源不同不会冲突', () => {
    const base = {
      title: 'A',
      type: 'document' as const,
      tags: [],
      createdAt: NOW,
      updatedAt: NOW,
      summary: '',
      links: [],
      extension: 'md',
    };
    const a = createSeedNode({ ...base, uri: 'vault:a.md', path: 'a.md' });
    const b = createSeedNode({ ...base, uri: 'vault:b.md', path: 'b.md' });
    expect(a.id).not.toBe(b.id);
  });
});
