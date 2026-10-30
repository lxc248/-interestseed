import { describe, expect, it } from 'vitest';
import {
  VaultGraphRepository,
  type GraphStorageAdapter,
} from '../src/storage/GraphRepository';
import { emptyGraph } from '../src/types/graph';

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

describe('bug hunt: BOM persistence', () => {
  it('loads a graph file that starts with a UTF-8 BOM', async () => {
    const adapter = new MemoryAdapter();
    const graph = emptyGraph('2026-01-01T00:00:00.000Z');
    adapter.data.set('graph.json', `\uFEFF${JSON.stringify(graph)}`);
    const repository = new VaultGraphRepository(adapter, {
      key: 'graph.json',
      now: () => '2026-01-01T00:00:00.000Z',
    });
    const result = await repository.loadDetailed();
    expect(result.blocked).toBe(false);
    expect(result.graph.nodes).toEqual([]);
    expect(result.issues).toEqual([]);
  });
});
