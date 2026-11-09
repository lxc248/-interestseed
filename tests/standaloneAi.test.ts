import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { connectSuggestion, resolveApiKey, suggestRelations } from '../standalone/src/ai';
import { DEFAULT_CONFIG, loadState, saveConfig, saveGraph } from '../standalone/src/state';
import { emptyGraph, type InterestSeedGraph } from '../src/types/graph';

const dirs: string[] = [];
const envKeys = ['INTERESTSEED_TEST_KEY', 'INTERESTSEED_MISSING_KEY'];

async function vault(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'interestseed-ai-'));
  dirs.push(dir);
  return dir;
}

function graphWithTwoNodes(): InterestSeedGraph {
  const now = new Date().toISOString();
  const graph = emptyGraph(now);
  graph.nodes.push(
    {
      id: 'a',
      type: 'topic',
      title: 'A',
      tags: ['focus'],
      createdAt: now,
      updatedAt: now,
      metadata: {},
    },
    {
      id: 'b',
      type: 'document',
      title: 'B',
      tags: [],
      createdAt: now,
      updatedAt: now,
      metadata: {},
    },
  );
  return graph;
}

afterEach(async () => {
  for (const key of envKeys) delete process.env[key];
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
});

describe('standalone AI key resolution', () => {
  it('reads the dedicated environment variable first', async () => {
    const root = await vault();
    process.env.INTERESTSEED_AI_API_KEY = 'env-key';
    const key = await resolveApiKey(root, { ...DEFAULT_CONFIG, keyEnv: 'INTERESTSEED_AI_API_KEY' });
    expect(key).toBe('env-key');
  });

  it('ignores unrelated environment variables', async () => {
    const root = await vault();
    process.env.INTERESTSEED_TEST_KEY = 'wrong-key';
    const key = await resolveApiKey(root, { ...DEFAULT_CONFIG, keyEnv: 'INTERESTSEED_TEST_KEY' });
    expect(key).toBeUndefined();
  });

  it('falls back to .interestseed/key', async () => {
    const root = await vault();
    await mkdir(join(root, '.interestseed'), { recursive: true });
    await writeFile(join(root, '.interestseed', 'key'), 'local-key\n', 'utf8');
    const key = await resolveApiKey(root, {
      ...DEFAULT_CONFIG,
      keyEnv: 'INTERESTSEED_MISSING_KEY',
    });
    expect(key).toBe('local-key');
  });
});

describe('standalone AI suggestion persistence', () => {
  it('connects a valid AI suggestion and records evidence', async () => {
    const root = await vault();
    await saveGraph(root, graphWithTwoNodes());
    const result = await connectSuggestion(root, {
      source: 'a',
      target: 'b',
      relation: 'shared method',
      reason: 'both use the same framing',
      confidence: 0.8,
    });
    expect(result.ok).toBe(true);
    expect(result.edge?.origin).toBe('ai');
    expect(result.edge?.status).toBe('confirmed');
    expect(result.edge?.evidence).toContain('用户确认');
    const state = await loadState(root);
    expect(state.graph.edges).toHaveLength(1);
    expect(state.graph.edges[0]?.relation).toBe('shared method');
  });

  it('rejects a duplicate pair', async () => {
    const root = await vault();
    await saveGraph(root, graphWithTwoNodes());
    await connectSuggestion(root, { source: 'a', target: 'b', relation: 'related' });
    const result = await connectSuggestion(root, { source: 'b', target: 'a', relation: 'related' });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/already connected/i);
  });

  it('rejects missing nodes, self-loops and empty relations', async () => {
    const root = await vault();
    await saveGraph(root, graphWithTwoNodes());
    await expect(
      connectSuggestion(root, { source: 'a', target: 'missing', relation: 'related' }),
    ).resolves.toEqual({ ok: false, message: 'Source or target node is missing.' });
    await expect(
      connectSuggestion(root, { source: 'a', target: 'a', relation: 'related' }),
    ).resolves.toEqual({ ok: false, message: 'Self-loops are not supported.' });
    await expect(
      connectSuggestion(root, { source: 'a', target: 'b', relation: '  ' }),
    ).resolves.toEqual({ ok: false, message: 'Relation name is empty.' });
  });
});

describe('standalone AI preconditions', () => {
  it('rejects suggestions without a key', async () => {
    const root = await vault();
    await saveConfig(root, {
      ...DEFAULT_CONFIG,
      keyEnv: 'INTERESTSEED_MISSING_KEY',
    });
    await expect(suggestRelations(root)).rejects.toThrow(/Missing API key/);
  });

  it('rejects suggestions when AI is disabled or consent is missing', async () => {
    const root = await vault();
    await mkdir(join(root, '.interestseed'), { recursive: true });
    await writeFile(join(root, '.interestseed', 'key'), 'key\n', 'utf8');
    await saveConfig(root, {
      ...DEFAULT_CONFIG,
      keyEnv: 'INTERESTSEED_MISSING_KEY',
      enableAI: false,
    });
    await expect(suggestRelations(root)).rejects.toThrow(/AI 已关闭/);

    await saveConfig(root, {
      ...DEFAULT_CONFIG,
      keyEnv: 'INTERESTSEED_MISSING_KEY',
      enableAI: true,
      aiConsentGranted: false,
    });
    await expect(suggestRelations(root)).rejects.toThrow(/还没有确认 AI 请求边界/);
  });
});
