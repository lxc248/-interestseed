import { describe, expect, it } from 'vitest';
import { InterestSeedGraphStore } from '../src/core/GraphStore';
import { VaultGraphRepository as GraphRepository, type GraphStorageAdapter } from '../src/storage/GraphRepository';
import type { InterestSeedEdge } from '../src/types/graph';

const NOW = '2026-01-01T00:00:00.000Z';

class MemoryAdapter implements GraphStorageAdapter {
  readonly data = new Map<string, string>();
  async read(key: string): Promise<string | null> {
    return this.data.get(key) ?? null;
  }
  async write(key: string, data: string): Promise<void> {
    this.data.set(key, data);
  }
  async remove(key: string): Promise<void> {
    this.data.delete(key);
  }
}

describe('AI accepted suggestion persistence', () => {
  it('persists an accepted AI edge across repository reload', async () => {
    const adapter = new MemoryAdapter();
    const repository = new GraphRepository(adapter, { key: 'graph.json', now: () => NOW });
    const store = new InterestSeedGraphStore(undefined, { now: () => NOW });
    store.addNode({ id: 'a', title: 'A' });
    store.addNode({ id: 'b', title: 'B' });
    const edge: InterestSeedEdge = {
      id: 'ai-edge',
      source: 'a',
      target: 'b',
      relation: '相关',
      origin: 'ai',
      status: 'confirmed',
      evidence: ['AI 建议，用户确认'],
      createdAt: NOW,
      updatedAt: NOW,
    };
    store.addEdge(edge);

    await repository.save(store.toJSON());
    const reloaded = await new GraphRepository(adapter, {
      key: 'graph.json',
      now: () => NOW,
    }).loadDetailed();

    expect(reloaded.graph.edges).toEqual([
      expect.objectContaining({
        id: 'ai-edge',
        origin: 'ai',
        status: 'confirmed',
      }),
    ]);
  });
});
