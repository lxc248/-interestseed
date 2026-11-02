import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { applyDiscovery, feedbackDiscovery, listDiscoveries, loadDiscoveries, refreshDiscoveries } from '../standalone/src/discoveries';
import { scanAndBuild } from '../standalone/src/graph';
import { statePath } from '../standalone/src/state';

const dirs: string[] = [];

async function vault(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'interestseed-discovery-'));
  dirs.push(dir);
  return dir;
}

afterEach(async () => {
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
});

describe('standalone discoveries', () => {
  it('finds a cross-folder shared topic and can confirm it', async () => {
    const root = await vault();
    const { mkdir } = await import('node:fs/promises');
    await mkdir(join(root, 'P1'), { recursive: true });
    await mkdir(join(root, 'P2'), { recursive: true });
    await writeFile(join(root, 'P1', 'a.md'), '---\ntags: [focus, ai]\n---\n# A\n\n[[B]]\n', 'utf8');
    await writeFile(join(root, 'P1', 'a2.md'), '---\ntags: [focus]\n---\n# A2\n\n[[A]]\n', 'utf8');
    await writeFile(join(root, 'P2', 'b.md'), '---\ntags: [focus, ai]\n---\n# B\n\n[[A]]\n', 'utf8');
    await writeFile(join(root, 'P2', 'b2.md'), '---\ntags: [focus]\n---\n# B2\n\n[[B]]\n', 'utf8');

    const built = await scanAndBuild(root);
    const raw = JSON.parse(await readFile(statePath(root), 'utf8')) as {
      graph: { edges: Array<{ source: string; target: string; status: string }> };
    };
    const nodePath = new Map(built.graph.nodes.map((node) => [node.id, String(node.metadata?.path ?? '')]));
    for (const edge of raw.graph.edges) {
      const sourcePath = nodePath.get(edge.source) ?? '';
      const targetPath = nodePath.get(edge.target) ?? '';
      if (sourcePath.startsWith('P1/') && targetPath.startsWith('P1/')) edge.status = 'confirmed';
      if (sourcePath.startsWith('P2/') && targetPath.startsWith('P2/')) edge.status = 'confirmed';
    }
    await writeFile(statePath(root), JSON.stringify({ schemaVersion: 1, updatedAt: new Date().toISOString(), graph: raw.graph }, null, 2), 'utf8');

    const discoveries = await refreshDiscoveries(root);
    expect(discoveries.length).toBeGreaterThan(0);
    const id = discoveries[0]!.id;
    const result = await applyDiscovery(root, id);
    expect(result.ok).toBe(true);
    expect(result.edge?.status).toBe('confirmed');

    expect((await feedbackDiscovery(root, id, 'needs-verification')).ok).toBe(true);
    let file = await loadDiscoveries(root);
    expect(file.discoveries.find((item) => item.id === id)?.feedbackStatus).toBe('needs-verification');

    expect((await feedbackDiscovery(root, id, 'corrected', '它们共享的是开始阻力。')).ok).toBe(true);
    file = await loadDiscoveries(root);
    expect(file.discoveries.find((item) => item.id === id)?.correction?.description).toContain('开始阻力');

    expect((await feedbackDiscovery(root, id, 'rejected')).ok).toBe(true);
    expect((await listDiscoveries(root)).some((item) => item.id === id)).toBe(false);
  });
});
