import { describe, expect, it } from 'vitest';
import {
  VaultGraphRepository as GraphRepository,
  GraphRepositoryError,
  type GraphStorageAdapter,
} from '../src/storage/GraphRepository';
import { InterestSeedGraphStore as GraphStore } from '../src/core/GraphStore';
import { emptyGraph, type InterestSeedGraph } from '../src/types/graph';

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

/** 可模拟磁盘写失败的适配器。 */
class FailingAdapter extends MemoryAdapter {
  failContains: string[] = [];

  override async write(key: string, data: string): Promise<void> {
    if (this.failContains.some((part) => key.includes(part))) {
      throw new Error('disk full');
    }
    await super.write(key, data);
  }
}

const NOW = '2026-01-01T00:00:00.000Z';
const LEGACY_EPOCH = 1_700_000_000_000;

function createRepository(adapter: MemoryAdapter): GraphRepository {
  return new GraphRepository(adapter, { key: 'graph.json', now: () => NOW });
}

describe('GraphRepository 接口、首次写入与备份', () => {
  it('load() 直接返回图谱对象', async () => {
    const adapter = new MemoryAdapter();
    const repository = createRepository(adapter);
    const store = new GraphStore(undefined, { now: () => NOW });
    store.addNode({ id: 'a', title: 'A' });

    await repository.save(store.toJSON());
    const graph = await repository.load();

    expect(graph.nodes).toHaveLength(1);
    expect(graph.nodes[0]?.title).toBe('A');
    expect(graph.schemaVersion).toBe(2);
  });

  it('首次保存会创建文件并写入当前版本', async () => {
    const adapter = new MemoryAdapter();
    const repository = createRepository(adapter);

    expect(adapter.data.size).toBe(0);
    await repository.save(emptyGraph(NOW));

    expect(adapter.data.has('graph.json')).toBe(true);
    const parsed = JSON.parse(adapter.data.get('graph.json') ?? '{}') as {
      schemaVersion?: number;
    };
    expect(parsed.schemaVersion).toBe(2);
  });

  it('validate() 返回结构错误，空图谱无错误', () => {
    const repository = createRepository(new MemoryAdapter());

    expect(repository.validate(emptyGraph(NOW))).toEqual([]);

    const invalid: InterestSeedGraph = {
      schemaVersion: 2,
      updatedAt: 'not-a-date',
      nodes: [],
      edges: [],
    };
    expect(repository.validate(invalid).length).toBeGreaterThan(0);
  });

  it('createBackup() 复制当前文件并可读回', async () => {
    const adapter = new MemoryAdapter();
    const repository = createRepository(adapter);
    await repository.save(emptyGraph(NOW));

    const backupKey = await repository.createBackup();
    expect(backupKey).toBeUndefined();
    expect(repository.lastBackupKey).toContain('.backup-');
    expect(adapter.data.get(repository.lastBackupKey ?? '')).toBe(
      adapter.data.get('graph.json'),
    );
  });

  it('没有可备份文件时 createBackup() 抛出明确错误', async () => {
    const repository = createRepository(new MemoryAdapter());

    await expect(repository.createBackup()).rejects.toMatchObject({
      code: 'backup-failed',
    });
  });

  it('备份写入失败会抛出 backup-failed，而不是假装成功', async () => {
    const adapter = new FailingAdapter();
    adapter.failContains = ['.backup-'];
    const repository = createRepository(adapter);
    await repository.save(emptyGraph(NOW));

    await expect(repository.createBackup()).rejects.toMatchObject({
      code: 'backup-failed',
    });
  });

  it('保存写入失败时原文件保持不变并向上抛错', async () => {
    const adapter = new FailingAdapter();
    const repository = createRepository(adapter);
    await repository.save(emptyGraph(NOW));
    const before = adapter.data.get('graph.json');

    const store = new GraphStore(undefined, { now: () => NOW });
    store.addNode({ id: 'a', title: 'A' });
    adapter.failContains = ['graph.json'];

    await expect(repository.save(store.toJSON())).rejects.toThrow('disk full');
    expect(adapter.data.get('graph.json')).toBe(before);
  });

  it('损坏数据备份失败时暂停写入并保留原文件', async () => {
    const adapter = new FailingAdapter();
    adapter.failContains = ['.corrupt-'];
    const original = '{"nodes": ';
    adapter.data.set('graph.json', original);

    const repository = createRepository(adapter);
    const result = await repository.loadDetailed();

    expect(result.blocked).toBe(true);
    expect(result.corruptedBackupKey).toBeNull();
    await expect(repository.save(emptyGraph(NOW))).rejects.toMatchObject({ code: 'blocked' });
    expect(adapter.data.get('graph.json')).toBe(original);
  });

  it('迁移前备份失败时暂停写入并保留原文件', async () => {
    const adapter = new FailingAdapter();
    adapter.failContains = ['backup-v1'];
    const original = JSON.stringify({
      schemaVersion: 1,
      updatedAt: LEGACY_EPOCH,
      nodes: {},
      edges: {},
    });
    adapter.data.set('graph.json', original);

    const repository = createRepository(adapter);
    const result = await repository.loadDetailed();

    expect(result.blocked).toBe(true);
    expect(result.preMigrationBackupKey).toBeNull();
    await expect(repository.save(emptyGraph(NOW))).rejects.toMatchObject({ code: 'blocked' });
    expect(adapter.data.get('graph.json')).toBe(original);
  });
});

describe('GraphRepository', () => {
  it('没有存储数据时返回空图谱', async () => {
    const adapter = new MemoryAdapter();
    const result = await createRepository(adapter).loadDetailed();

    expect(result.source).toBe('empty');
    expect(result.graph.nodes).toEqual([]);
    expect(result.graph.edges).toEqual([]);
    expect(result.issues).toEqual([]);
  });

  it('保存后可以完整读回（含视口）', async () => {
    const adapter = new MemoryAdapter();
    const repository = createRepository(adapter);
    const store = new GraphStore(undefined, { now: () => NOW });
    store.addNode({ id: 'a', title: 'A', type: 'project', tags: ['x'] });
    store.addNode({ id: 'b', title: 'B' });
    store.addEdge({
      source: 'a',
      target: 'b',
      relation: 'contains',
      origin: 'user',
      status: 'confirmed',
    });
    store.setViewport({ zoom: 1.2, panX: 5, panY: -8 });

    await repository.save(store.toJSON());
    const result = await repository.loadDetailed();

    expect(result.source).toBe('store');
    expect(result.issues).toEqual([]);
    expect(result.graph.nodes).toEqual(store.toJSON().nodes);
    expect(result.graph.edges).toEqual(store.toJSON().edges);
    expect(result.graph.viewport).toEqual({ zoom: 1.2, panX: 5, panY: -8 });
    expect(result.graph.schemaVersion).toBe(2);
    expect(result.graph.nodes[0]?.createdAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
  });

  it('保存时写入当前 schemaVersion 与时间戳', async () => {
    const adapter = new MemoryAdapter();
    const repository = createRepository(adapter);
    await repository.save({ schemaVersion: 1, nodes: [], edges: [], updatedAt: NOW });

    const raw = adapter.data.get('graph.json');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw ?? '{}') as Record<string, unknown>;
    expect(parsed.schemaVersion).toBe(2);
    expect(parsed.updatedAt).toBe(NOW);
  });

  it('损坏的 JSON 且没有备份时暂停写入并保留原文件', async () => {
    const adapter = new MemoryAdapter();
    adapter.data.set('graph.json', '{"nodes": ');

    const repository = createRepository(adapter);
    const result = await repository.loadDetailed();

    expect(result.source).toBe('recovered');
    expect(result.blocked).toBe(true);
    expect(result.corruptedBackupKey).toBe('graph.json.corrupt-2026-01-01T00-00-00-000Z');
    expect(result.corruptedBackupKey).not.toContain(':');
    expect(adapter.data.get('graph.json.corrupt-2026-01-01T00-00-00-000Z')).toBe(
      '{"nodes": ',
    );
    await expect(repository.save(emptyGraph(NOW))).rejects.toMatchObject({ code: 'blocked' });
    expect(adapter.data.get('graph.json')).toBe('{"nodes": ');
  });

  it('自动迁移 v1 兴趣模型到 v2 种子模型', async () => {
    const adapter = new MemoryAdapter();
    adapter.data.set(
      'graph.json',
      JSON.stringify({
        schemaVersion: 1,
        updatedAt: LEGACY_EPOCH,
        nodes: {
          a: {
            id: 'a',
            title: '笔记A',
            kind: 'note',
            status: 'sprout',
            summary: '摘要文本',
            tags: ['x'],
            sourcePath: '笔记/a.md',
            weight: 0.5,
            createdAt: LEGACY_EPOCH,
            updatedAt: LEGACY_EPOCH,
          },
          b: {
            id: 'b',
            title: '兴趣B',
            kind: 'seed',
            status: 'seed',
            summary: '',
            tags: ['x'],
            sourcePath: null,
            weight: 0.8,
            createdAt: LEGACY_EPOCH,
            updatedAt: LEGACY_EPOCH,
          },
        },
        edges: {
          e1: {
            id: 'e1',
            source: 'a',
            target: 'b',
            kind: 'related',
            origin: 'tag',
            weight: 0.6,
            createdAt: LEGACY_EPOCH,
            updatedAt: LEGACY_EPOCH,
          },
        },
      }),
    );

    const result = await createRepository(adapter).loadDetailed();
    const nodeA = result.graph.nodes.find((node) => node.id === 'a');
    const nodeB = result.graph.nodes.find((node) => node.id === 'b');
    const edge = result.graph.edges[0];

    expect(result.source).toBe('store');
    expect(result.migratedFrom).toBe(1);
    expect(result.appliedMigrations).toHaveLength(1);
    expect(result.graph.schemaVersion).toBe(2);
    expect(result.preMigrationBackupKey).toContain('backup-v1');
    const preMigrationBackup = result.preMigrationBackupKey
      ? adapter.data.get(result.preMigrationBackupKey)
      : undefined;
    expect(preMigrationBackup).toBeTruthy();
    expect((JSON.parse(preMigrationBackup ?? '{}') as { schemaVersion?: number }).schemaVersion).toBe(1);

    expect(nodeA?.type).toBe('document');
    expect(nodeA?.sourceUri).toBe('笔记/a.md');
    expect(nodeA?.metadata.summary).toBe('摘要文本');
    expect(nodeB?.type).toBe('topic');

    expect(edge?.relation).toBe('related-to');
    expect(edge?.origin).toBe('rule');
    expect(edge?.status).toBe('suggested');
    expect(edge?.confidence).toBe(0.6);
    expect(edge?.evidence?.[0]).toContain('迁移');
    expect(result.graph.updatedAt).toBe(new Date(LEGACY_EPOCH).toISOString());
  });

  it('自动迁移 v0 数组格式（0 → 1 → 2）', async () => {
    const adapter = new MemoryAdapter();
    adapter.data.set(
      'graph.json',
      JSON.stringify({
        version: 0,
        updatedAt: LEGACY_EPOCH,
        nodes: [
          { id: 'a', name: '旧节点', path: '旧/a.md' },
          { id: 'b', title: '另一个节点' },
        ],
        links: [{ from: 'a', to: 'b', relationship: 'link', weight: 0.8 }],
      }),
    );

    const result = await createRepository(adapter).loadDetailed();

    expect(result.migratedFrom).toBe(0);
    expect(result.appliedMigrations).toHaveLength(2);
    expect(result.graph.nodes.map((node) => node.type)).toEqual(['document', 'document']);

    const edge = result.graph.edges[0];
    expect(edge?.relation).toBe('references');
    expect(edge?.origin).toBe('user');
    expect(edge?.status).toBe('confirmed');
    expect(edge?.confidence).toBe(0.8);
  });

  it('拒绝比插件更新的图谱版本', async () => {
    const adapter = new MemoryAdapter();
    adapter.data.set(
      'graph.json',
      JSON.stringify({ schemaVersion: 99, nodes: [], edges: [] }),
    );

    const result = await createRepository(adapter).loadDetailed();

    expect(result.source).toBe('recovered');
    expect(result.issues[0]).toContain('高于');
    expect(result.corruptedBackupKey).toBeTruthy();
    expect(result.blocked).toBe(true);
  });

  it('保存前校验结构，非法图谱不会写入', async () => {
    const adapter = new MemoryAdapter();
    const repository = createRepository(adapter);

    const invalid: InterestSeedGraph = {
      schemaVersion: 2,
      updatedAt: NOW,
      nodes: [
        {
          id: 'a',
          type: 'document',
          title: 'A',
          tags: [],
          createdAt: NOW,
          updatedAt: NOW,
          metadata: {},
        },
      ],
      edges: [
        {
          id: 'broken',
          source: 'a',
          target: 'ghost',
          relation: 'references',
          origin: 'user',
          status: 'confirmed',
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
    };

    await expect(repository.save(invalid)).rejects.toBeInstanceOf(GraphRepositoryError);
    expect(adapter.data.has('graph.json')).toBe(false);
  });

  it('序列化失败时保留原有文件', async () => {
    const adapter = new MemoryAdapter();
    const repository = createRepository(adapter);
    const valid: InterestSeedGraph = {
      schemaVersion: 2,
      updatedAt: NOW,
      nodes: [
        {
          id: 'a',
          type: 'document',
          title: 'A',
          tags: [],
          createdAt: NOW,
          updatedAt: NOW,
          metadata: {},
        },
      ],
      edges: [],
    };

    await repository.save(valid);
    const before = adapter.data.get('graph.json');

    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const cyclic: InterestSeedGraph = {
      ...valid,
      nodes: [{ ...valid.nodes[0]!, metadata: circular }],
    };

    await expect(repository.save(cyclic)).rejects.toMatchObject({
      code: 'serialize-failed',
    });
    expect(adapter.data.get('graph.json')).toBe(before);
  });

  it('迁移失败时暂停写入并保留原文件，备份后可恢复', async () => {
    const adapter = new MemoryAdapter();
    const original = JSON.stringify({
      schemaVersion: 99,
      updatedAt: NOW,
      nodes: [],
      edges: [],
    });
    adapter.data.set('graph.json', original);

    const repository = createRepository(adapter);
    const result = await repository.loadDetailed();

    expect(result.blocked).toBe(true);
    await expect(repository.save(emptyGraph(NOW))).rejects.toMatchObject({
      code: 'blocked',
    });
    expect(adapter.data.get('graph.json')).toBe(original);

    const backup = await repository.releaseBlockAfterBackup();
    expect(backup).toContain('migration-failed');
    expect(adapter.data.get(backup ?? '')).toBe(original);

    await repository.save(emptyGraph(NOW));
    expect(JSON.parse(adapter.data.get('graph.json') ?? '{}')).toMatchObject({
      schemaVersion: 2,
      nodes: [],
      edges: [],
    });
  });

  it('丢弃指向不存在节点的关系并报告问题', async () => {
    const adapter = new MemoryAdapter();
    adapter.data.set(
      'graph.json',
      JSON.stringify({
        schemaVersion: 2,
        updatedAt: NOW,
        nodes: [
          {
            id: 'a',
            type: 'document',
            title: 'A',
            tags: [],
            createdAt: NOW,
            updatedAt: NOW,
            metadata: {},
          },
        ],
        edges: [
          {
            id: 'bad',
            source: 'a',
            target: 'ghost',
            relation: 'references',
            origin: 'user',
            status: 'confirmed',
            createdAt: NOW,
            updatedAt: NOW,
          },
        ],
      }),
    );

    const result = await createRepository(adapter).loadDetailed();

    expect(result.source).toBe('store');
    expect(result.graph.nodes).toHaveLength(1);
    expect(result.graph.edges).toHaveLength(0);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('历史规则关系缺少 evidence 时补充占位说明并可保存', async () => {
    const adapter = new MemoryAdapter();
    const node = (id: string) => ({
      id,
      type: 'document',
      title: id.toUpperCase(),
      tags: [],
      createdAt: NOW,
      updatedAt: NOW,
      metadata: {},
    });

    adapter.data.set(
      'graph.json',
      JSON.stringify({
        schemaVersion: 2,
        updatedAt: NOW,
        nodes: [node('a'), node('b')],
        edges: [
          {
            id: 'e',
            source: 'a',
            target: 'b',
            relation: 'related-to',
            origin: 'rule',
            status: 'suggested',
            createdAt: NOW,
            updatedAt: NOW,
          },
        ],
      }),
    );

    const repository = createRepository(adapter);
    const result = await repository.loadDetailed();

    expect(result.graph.edges[0]?.evidence).toEqual(['历史数据：缺少来源说明']);
    expect(result.issues.length).toBeGreaterThan(0);

    await repository.save(result.graph);
    const saved = JSON.parse(adapter.data.get('graph.json') ?? '{}') as {
      edges: Array<{ evidence?: string[] }>;
    };
    expect(saved.edges[0]?.evidence).toEqual(['历史数据：缺少来源说明']);
  });

  describe('GraphRepository corrupt primary recovery', () => {
  const node = (id: string, title: string) => ({
    id,
    type: 'document',
    title,
    tags: [],
    createdAt: NOW,
    updatedAt: NOW,
    metadata: { path: `${id}.md` },
  });

  const edge = (id: string, source: string, target: string) => ({
    id,
    source,
    target,
    relation: 'references',
    origin: 'user',
    status: 'confirmed',
    createdAt: NOW,
    updatedAt: NOW,
  });

  const validGraphRaw = () =>
    JSON.stringify({
      schemaVersion: 2,
      updatedAt: NOW,
      nodes: [node('a', 'A'), node('b', 'B')],
      edges: [edge('e', 'a', 'b')],
    });

  it('主文件损坏但备份有效时从 .bak 恢复并保留内容', async () => {
    const adapter = new MemoryAdapter();
    adapter.data.set('graph.json', '{"nodes": ');
    adapter.data.set('graph.json.bak', validGraphRaw());

    const result = await createRepository(adapter).loadDetailed();

    expect(result.blocked).toBe(false);
    expect(result.source).toBe('recovered');
    expect(result.graph.nodes).toHaveLength(2);
    expect(result.graph.edges).toHaveLength(1);
    expect(result.graph.nodes.map((item) => item.id)).toEqual(['a', 'b']);
    expect(result.graph.edges[0]?.relation).toBe('references');
    const primary = JSON.parse(adapter.data.get('graph.json') ?? '{}') as {
      nodes: Array<{ id: string }>;
    };
    expect(primary.nodes.map((item) => item.id)).toEqual(['a', 'b']);
    expect(adapter.data.get('graph.json.bak')).toBe(validGraphRaw());
    expect(adapter.data.has('graph.json.recovered-2026-01-01T00-00-00-000Z')).toBe(true);
  });

  it('恢复后再次重启仍能读取备份中的图谱', async () => {
    const adapter = new MemoryAdapter();
    adapter.data.set('graph.json', '{"nodes": ');
    adapter.data.set('graph.json.bak', validGraphRaw());

    const first = await createRepository(adapter).loadDetailed();
    const second = await createRepository(adapter).loadDetailed();

    expect(first.blocked).toBe(false);
    expect(second.blocked).toBe(false);
    expect(second.graph.nodes.map((item) => item.id)).toEqual(['a', 'b']);
    expect(second.graph.edges.map((item) => item.relation)).toEqual(['references']);
  });

  it('主文件与备份均损坏时阻断写入并保留原始文件', async () => {
    const adapter = new MemoryAdapter();
    adapter.data.set('graph.json', '{"nodes": ');
    adapter.data.set('graph.json.bak', '{"edges": ');

    const repository = createRepository(adapter);
    const result = await repository.loadDetailed();

    expect(result.blocked).toBe(true);
    expect(adapter.data.get('graph.json')).toBe('{"nodes": ');
    expect(adapter.data.get('graph.json.bak')).toBe('{"edges": ');
    await expect(repository.save(emptyGraph(NOW))).rejects.toMatchObject({ code: 'blocked' });
  });

  it('主文件损坏、备份缺失时安全失败并保留原文件', async () => {
    const adapter = new MemoryAdapter();
    adapter.data.set('graph.json', '{"nodes": ');

    const repository = createRepository(adapter);
    const result = await repository.loadDetailed();

    expect(result.blocked).toBe(true);
    expect(result.graph.nodes).toEqual([]);
    expect(adapter.data.get('graph.json')).toBe('{"nodes": ');
    await expect(repository.save(emptyGraph(NOW))).rejects.toMatchObject({ code: 'blocked' });
  });

  it('主文件损坏、备份读取异常时安全失败', async () => {
    const adapter = new FailingAdapter();
    adapter.data.set('graph.json', '{"nodes": ');
    adapter.data.set('graph.json.bak', validGraphRaw());
    const originalRead = adapter.read.bind(adapter);
    adapter.read = async (key) => {
      if (key === 'graph.json.bak') throw new Error('permission denied');
      return originalRead(key);
    };

    const repository = createRepository(adapter);
    const result = await repository.loadDetailed();

    expect(result.blocked).toBe(true);
    expect(adapter.data.get('graph.json')).toBe('{"nodes": ');
    expect(adapter.data.get('graph.json.bak')).toBe(validGraphRaw());
  });

  it('备份可解析但 Schema 无效时拒绝恢复', async () => {
    const adapter = new MemoryAdapter();
    adapter.data.set('graph.json', '{"nodes": ');
    adapter.data.set(
      'graph.json.bak',
      JSON.stringify({ schemaVersion: 99, nodes: [], edges: [] }),
    );

    const repository = createRepository(adapter);
    const result = await repository.loadDetailed();

    expect(result.blocked).toBe(true);
    expect(result.graph.nodes).toEqual([]);
  });

  it('备份结构合法但包含无效关系时拒绝恢复', async () => {
    const adapter = new MemoryAdapter();
    adapter.data.set('graph.json', '{"nodes": ');
    adapter.data.set(
      'graph.json.bak',
      JSON.stringify({
        schemaVersion: 2,
        updatedAt: NOW,
        nodes: [node('a', 'A')],
        edges: [edge('bad', 'a', 'ghost')],
      }),
    );

    const repository = createRepository(adapter);
    const result = await repository.loadDetailed();

    expect(result.blocked).toBe(true);
    expect(adapter.data.get('graph.json.bak')).toContain('ghost');
  });

  it('保存原主文件备份失败时不尝试覆盖主文件', async () => {
    const adapter = new FailingAdapter();
    adapter.failContains = ['.corrupt-'];
    adapter.data.set('graph.json', '{"nodes": ');
    adapter.data.set('graph.json.bak', validGraphRaw());

    const repository = createRepository(adapter);
    const result = await repository.loadDetailed();

    expect(result.blocked).toBe(true);
    expect(adapter.data.get('graph.json')).toBe('{"nodes": ');
    expect(adapter.data.get('graph.json.bak')).toBe(validGraphRaw());
  });

  it('同一时间戳内重复恢复不会覆盖已有的 corrupt 备份', async () => {
    const adapter = new MemoryAdapter();
    adapter.data.set('graph.json', '{"nodes": ');
    adapter.data.set('graph.json.bak', validGraphRaw());

    const first = await createRepository(adapter).loadDetailed();
    expect(first.blocked).toBe(false);

    // 模拟同一毫秒内主文件再次损坏，触发第二次恢复。
    adapter.data.set('graph.json', '{"nodes": ');
    const second = await createRepository(adapter).loadDetailed();

    expect(second.blocked).toBe(false);
    expect(adapter.data.get('graph.json.corrupt-2026-01-01T00-00-00-000Z')).toBe('{"nodes": ');
    expect(adapter.data.get('graph.json.corrupt-2026-01-01T00-00-00-000Z-1')).toBe('{"nodes": ');
  });

  it('恢复后保存会把内存图谱写回主文件，并保留 corrupt 原件', async () => {
    const adapter = new MemoryAdapter();
    adapter.data.set('graph.json', '{"nodes": ');
    adapter.data.set('graph.json.bak', validGraphRaw());

    const repository = createRepository(adapter);
    const result = await repository.loadDetailed();
    expect(result.blocked).toBe(false);

    await repository.save(result.graph);

    const saved = JSON.parse(adapter.data.get('graph.json') ?? '{}') as {
      nodes: Array<{ id: string }>;
      edges: Array<{ relation: string }>;
    };
    expect(saved.nodes.map((item) => item.id)).toEqual(['a', 'b']);
    expect(saved.edges.map((item) => item.relation)).toEqual(['references']);
    expect(adapter.data.get('graph.json.corrupt-2026-01-01T00-00-00-000Z')).toBe('{"nodes": ');
  });
});

it('exists / clear 与存储状态一致', async () => {    const adapter = new MemoryAdapter();
    const repository = createRepository(adapter);
    const graph: InterestSeedGraph = { schemaVersion: 2, nodes: [], edges: [], updatedAt: NOW };

    expect(await repository.exists()).toBe(false);
    await repository.save(graph);
    expect(await repository.exists()).toBe(true);
    await repository.clear();
    expect(await repository.exists()).toBe(false);
  });
});
