import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { scanVault } from '../standalone/src/vault';
import { captureToVault } from '../standalone/src/capture';
import { DEFAULT_CONFIG } from '../standalone/src/state';
import { scanAndBuild } from '../standalone/src/graph';

const dirs: string[] = [];

async function vault(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'interestseed-standalone-'));
  dirs.push(dir);
  return dir;
}

afterEach(async () => {
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
});

describe('standalone vault scan', () => {
  it('reads frontmatter, tags, headings, links, and summary without Obsidian', async () => {
    const root = await vault();
    await writeFile(
      join(root, 'deep-work.md'),
      `---\ntitle: 深度工作\ntags: [focus, ai]\n---\n# 深度工作\n\n如何让人愿意开始。\n[[刻意练习]]\n`,
      'utf8',
    );
    await writeFile(
      join(root, 'practice.md'),
      `---\ntags:\n  - focus\n  - learning\n---\n# 刻意练习\n\n让人愿意开始的训练方法。\n`,
      'utf8',
    );

    const result = await scanVault(root, DEFAULT_CONFIG);
    expect(result.files).toBe(2);
    expect(result.nodes).toHaveLength(2);
    const deep = result.nodes.find((node) => node.title === '深度工作');
    expect(deep?.tags).toContain('focus');
    expect(deep?.tags).toContain('ai');
    expect(deep?.metadata?.summary).toContain('如何让人愿意开始');
    expect(deep?.metadata?.links).toContain('刻意练习');
  });

  it('builds a graph from a plain Markdown folder', async () => {
    const root = await vault();
    await writeFile(
      join(root, 'a.md'),
      `---\ntags: [focus]\n---\n# A\n\nSee [[B]].\n`,
      'utf8',
    );
    await writeFile(
      join(root, 'b.md'),
      `---\ntags: [focus]\n---\n# B\n\nSee [[A]].\n`,
      'utf8',
    );
    const result = await scanAndBuild(root);
    expect(result.graph.nodes).toHaveLength(2);
    expect(result.graph.edges.length).toBeGreaterThan(0);
  });

  it('captures a saved item into the vault inbox', async () => {
    const root = await vault();
    const captured = await captureToVault(root, {
      title: '一条收藏',
      url: 'https://example.com',
      text: '为什么我想保存它。',
    });
    expect(captured.path).toContain('InterestSeed/Inbox/');
    const result = await scanVault(root, DEFAULT_CONFIG);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0]?.title).toBe('一条收藏');
  });
});
