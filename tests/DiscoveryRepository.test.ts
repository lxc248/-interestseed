import { describe, expect, it, vi } from 'vitest';

import { DiscoveryEngine, generateDiscoveries } from '../src/discovery/DiscoveryEngine';
import { DiscoveryRepository } from '../src/discovery/DiscoveryRepository';
import { DiscoveryWriteQueue } from '../src/discovery/DiscoveryWriteQueue';
import { applyDiscoveryFeedback } from '../src/discovery/feedback';
import { emptyDiscoveryFile } from '../src/discovery/types';
import { emptyGraph } from '../src/types/graph';
import { qualityFixture } from './discoveryQuality';
import type { GraphStorageAdapter } from '../src/storage/GraphRepository';

const NOW = '2026-01-01T00:00:00.000Z';

class MemoryAdapter implements GraphStorageAdapter {
  readonly files = new Map<string, string>();

  constructor(
    private readonly onWrite?: (key: string, data: string) => void,
    private readonly failWrite = false,
  ) {}

  async read(key: string): Promise<string | null> {
    return this.files.get(key) ?? null;
  }

  async write(key: string, data: string): Promise<void> {
    if (this.failWrite) throw new Error('模拟写入失败');
    this.onWrite?.(key, data);
    this.files.set(key, data);
  }

  async remove(key: string): Promise<void> {
    this.files.delete(key);
  }
}

function sampleFile() {
  const file = emptyDiscoveryFile(NOW);
  file.discoveries.push({
    id: 'd1',
    kind: 'cross-project-topic',
    title: '共同主题',
    description: '说明',
    nodeIds: ['a', 'b'],
    projectKeys: ['P1', 'P2'],
    subjectKeys: ['tag'],
    evidence: [{ kind: 'source', nodeId: 'a', sourceUri: 'vault:a.md', text: '来源' }],
    ruleVersion: 'cross-project-topic-v1',
    strength: 'moderate',
    dedupeKey: 'd1',
    suppressionKey: 's1',
    identityVersion: 2,
    status: 'active',
    feedbackStatus: 'none',
    createdAt: NOW,
    updatedAt: NOW,
  });
  return file;
}

describe('DiscoveryRepository', () => {
  it('首次加载返回空数据，且不立即写文件', async () => {
    const adapter = new MemoryAdapter();
    const repo = new DiscoveryRepository(adapter, 'discoveries.json', () => NOW);
    const file = await repo.load();

    expect(file.discoveries).toEqual([]);
    expect(adapter.files.size).toBe(0);
  });

  it('保存后能重新加载', async () => {
    const adapter = new MemoryAdapter();
    const repo = new DiscoveryRepository(adapter, 'discoveries.json', () => NOW);
    const file = sampleFile();

    await repo.save(file);
    const loaded = await repo.load();

    expect(loaded.discoveries).toHaveLength(1);
    expect(loaded.discoveries[0]?.id).toBe('d1');
  });

  it('保存并重新加载反馈状态与应用状态', async () => {
    const adapter = new MemoryAdapter();
    const repo = new DiscoveryRepository(adapter, 'discoveries.json', () => NOW);
    const file = sampleFile();
    file.discoveries[0]!.feedbackStatus = 'accepted';
    file.discoveries[0]!.status = 'active';
    file.discoveries[0]!.application = { state: 'applied', edgeId: 'edge_1' };

    await repo.save(file);
    const loaded = await repo.load();

    expect(loaded.discoveries[0]?.feedbackStatus).toBe('accepted');
    expect(loaded.discoveries[0]?.application?.state).toBe('applied');
  });

  it('保存并重新加载 corrected 修正与反馈历史', async () => {
    const adapter = new MemoryAdapter();
    const repo = new DiscoveryRepository(adapter, 'discoveries.json', () => NOW);
    const file = applyDiscoveryFeedback(sampleFile(), 'd1', 'corrected', NOW, {
      title: '修正标题',
      description: '修正描述',
      createdAt: NOW,
    });

    await repo.save(file);
    const loaded = await repo.load();

    expect(loaded.discoveries[0]?.feedbackStatus).toBe('corrected');
    expect(loaded.discoveries[0]?.title).toBe('共同主题');
    expect(loaded.discoveries[0]?.correction?.title).toBe('修正标题');
    expect(loaded.discoveries[0]?.feedbackHistory).toHaveLength(1);
  });

  it('保存失败时抛出错误', async () => {
    const adapter = new MemoryAdapter(undefined, true);
    const repo = new DiscoveryRepository(adapter, 'discoveries.json', () => NOW);
    await expect(repo.save(sampleFile())).rejects.toThrowError(/模拟写入失败/);
  });

  it('JSON 损坏时进入 blocked，并保留损坏原始数据', async () => {
    const adapter = new MemoryAdapter();
    adapter.files.set('discoveries.json', 'not-json{{');
    const repo = new DiscoveryRepository(adapter, 'discoveries.json', () => NOW);

    const result = await repo.loadDetailed();

    expect(result.blocked).toBe(true);
    expect(result.blockedReason).toContain('JSON');
    const backupKey = [...adapter.files.keys()].find(
      (key) => key.startsWith('discoveries.json.corrupt-'),
    );
    expect(backupKey).toBeTruthy();
    expect(result.backupStatus).toBe('succeeded');
    expect(result.backupKey).toBe(backupKey);
    expect(adapter.files.get(backupKey ?? '')).toBe('not-json{{');
  });

  it('损坏后阻止覆盖原文件', async () => {
    const adapter = new MemoryAdapter();
    adapter.files.set('discoveries.json', 'not-json{{');
    const repo = new DiscoveryRepository(adapter, 'discoveries.json', () => NOW);
    await repo.loadDetailed();

    await expect(repo.save(sampleFile())).rejects.toThrowError(/已暂停写入/);
  });

  it('未知更高版本进入 blocked', async () => {
    const adapter = new MemoryAdapter();
    adapter.files.set(
      'discoveries.json',
      JSON.stringify({ discoverySchemaVersion: 99, discoveries: [] }),
    );
    const repo = new DiscoveryRepository(adapter, 'discoveries.json', () => NOW);
    const result = await repo.loadDetailed();

    expect(result.blocked).toBe(true);
    expect(result.blockedReason).toContain('版本');
    expect(result.backupStatus).toBe('not-needed');
  });

  it('缺失必要字段时进入 blocked 并保护原始数据', async () => {
    const raw = JSON.stringify({
      discoverySchemaVersion: 1,
      discoveries: [
        { id: 'good', kind: 'cross-project-topic', nodeIds: ['a', 'b'] },
        { kind: 'cross-project-topic', nodeIds: ['a', 'b'] },
      ],
    });
    const adapter = new MemoryAdapter();
    adapter.files.set('discoveries.json', raw);
    const repo = new DiscoveryRepository(adapter, 'discoveries.json', () => NOW);
    const result = await repo.loadDetailed();

    expect(result.blocked).toBe(true);
    expect(result.blockedReason).toContain('无法无损处理');
    expect(result.issues.join(' ')).toContain('缺少 id');
    expect(result.backupStatus).toBe('succeeded');
    expect(adapter.files.get('discoveries.json')).toBe(raw);

    await expect(repo.save(sampleFile())).rejects.toThrowError(/已暂停写入/);
  });

  it('节点数量不足的记录进入 blocked，原始数据不被覆盖', async () => {
    const raw = JSON.stringify({
      discoverySchemaVersion: 1,
      discoveries: [{ id: 'd1', kind: 'cross-project-topic', nodeIds: ['a'] }],
    });
    const adapter = new MemoryAdapter();
    adapter.files.set('discoveries.json', raw);
    const repo = new DiscoveryRepository(adapter, 'discoveries.json', () => NOW);
    const result = await repo.loadDetailed();

    expect(result.blocked).toBe(true);
    expect(result.issues.join(' ')).toContain('nodeIds');
    expect(adapter.files.get('discoveries.json')).toBe(raw);
  });

  it('重复 id 进入 blocked，不自动选择保留哪一条', async () => {
    const raw = JSON.stringify({
      discoverySchemaVersion: 1,
      discoveries: [
        { id: 'd1', kind: 'cross-project-topic', nodeIds: ['a', 'b'] },
        { id: 'd1', kind: 'cross-project-topic', nodeIds: ['c', 'd'] },
      ],
    });
    const adapter = new MemoryAdapter();
    adapter.files.set('discoveries.json', raw);
    const repo = new DiscoveryRepository(adapter, 'discoveries.json', () => NOW);
    const result = await repo.loadDetailed();

    expect(result.blocked).toBe(true);
    expect(result.issues.join(' ')).toContain('重复');
    expect(adapter.files.get('discoveries.json')).toBe(raw);
  });

  it('读取失败时进入 blocked 而不抛出', async () => {
    const adapter = new MemoryAdapter();
    adapter.read = async () => {
      throw new Error('模拟读取失败');
    };
    const repo = new DiscoveryRepository(adapter, 'discoveries.json', () => NOW);
    const result = await repo.loadDetailed();

    expect(result.blocked).toBe(true);
    expect(result.blockedReason).toContain('读取失败');
    expect(result.backupStatus).toBe('unavailable');
  });

  it('discoveries 字段缺失时进入 blocked，原始内容不被覆盖', async () => {
    const raw = JSON.stringify({ discoverySchemaVersion: 1 });
    const adapter = new MemoryAdapter();
    adapter.files.set('discoveries.json', raw);
    const repo = new DiscoveryRepository(adapter, 'discoveries.json', () => NOW);
    const result = await repo.loadDetailed();

    expect(result.blocked).toBe(true);
    expect(result.issues.join(' ')).toContain('discoveries');
    expect(adapter.files.get('discoveries.json')).toBe(raw);

    await expect(repo.save(sampleFile())).rejects.toThrowError(/已暂停写入/);
    expect(adapter.files.get('discoveries.json')).toBe(raw);
  });

  it.each([
    ['字符串', JSON.stringify({ discoverySchemaVersion: 1, discoveries: 'bad' })],
    ['对象', JSON.stringify({ discoverySchemaVersion: 1, discoveries: { id: 'x' } })],
    ['null', JSON.stringify({ discoverySchemaVersion: 1, discoveries: null })],
  ])('discoveries 为%s时进入 blocked，原始内容保留', async (_label, raw) => {
    const adapter = new MemoryAdapter();
    adapter.files.set('discoveries.json', raw);
    const repo = new DiscoveryRepository(adapter, 'discoveries.json', () => NOW);
    const result = await repo.loadDetailed();

    expect(result.blocked).toBe(true);
    expect(adapter.files.get('discoveries.json')).toBe(raw);
  });

  it('空数组是合法数据，不进入 blocked', async () => {
    const raw = JSON.stringify({ discoverySchemaVersion: 1, discoveries: [] });
    const adapter = new MemoryAdapter();
    adapter.files.set('discoveries.json', raw);
    const repo = new DiscoveryRepository(adapter, 'discoveries.json', () => NOW);
    const result = await repo.loadDetailed();

    expect(result.blocked).toBe(false);
    expect(result.file.discoveries).toEqual([]);
  });

  it('异常备份失败时仍 blocked，且不覆盖原始文件', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const raw = JSON.stringify({ discoverySchemaVersion: 1 });
    const adapter = new MemoryAdapter();
    adapter.files.set('discoveries.json', raw);
    adapter.write = async (key, data) => {
      if (key.includes('.corrupt-')) throw new Error('备份失败');
      adapter.files.set(key, data);
    };
    const repo = new DiscoveryRepository(adapter, 'discoveries.json', () => NOW);
    const result = await repo.loadDetailed();

    expect(result.blocked).toBe(true);
    expect(result.backupStatus).toBe('failed');
    expect(adapter.files.get('discoveries.json')).toBe(raw);
    await expect(repo.save(sampleFile())).rejects.toThrowError(/已暂停写入/);
    expect(adapter.files.get('discoveries.json')).toBe(raw);
    errorSpy.mockRestore();
  });

  it('重复加载 schema v3 文件及新实例读取保持稳定，不重新迁移', async () => {
    const adapter = new MemoryAdapter();
    const repo = new DiscoveryRepository(adapter, 'discoveries.json', () => NOW);
    await repo.save(sampleFile());

    const first = await repo.loadDetailed();
    const second = await repo.loadDetailed();
    const third = await new DiscoveryRepository(
      adapter,
      'discoveries.json',
      () => NOW,
    ).loadDetailed();

    expect(first.blocked).toBe(false);
    expect(first.migration).toMatchObject({ legacyRecords: 0, currentRecords: 1 });
    expect(second.file).toEqual(first.file);
    expect(third.file).toEqual(first.file);
    expect(first.file.discoverySchemaVersion).toBe(3);
    expect(first.file.discoveries[0]?.id).toBe('d1');
    expect(first.file.discoveries[0]?.identityVersion).toBe(2);
  });

  it('同一实例并发保存时拒绝第二个旧快照', async () => {
    const adapter = new MemoryAdapter();
    const seed = new DiscoveryRepository(adapter, 'discoveries.json', () => NOW);
    await seed.save(sampleFile());
    const repo = new DiscoveryRepository(adapter, 'discoveries.json', () => NOW);
    const base = await repo.load();
    const first = { ...base, discoveries: [{ ...base.discoveries[0]!, feedbackStatus: 'accepted' as const }] };
    const second = { ...base, discoveries: [{ ...base.discoveries[0]!, feedbackStatus: 'rejected' as const, status: 'dismissed' as const }] };
    const results = await Promise.allSettled([repo.save(first), repo.save(second)]);
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((item) => item.status === 'rejected')).toHaveLength(1);
  });

  it('拒绝第二个实例用旧快照覆盖较新的磁盘状态', async () => {
    const adapter = new MemoryAdapter();
    const seed = new DiscoveryRepository(adapter, 'discoveries.json', () => NOW);
    await seed.save(sampleFile());
    const first = new DiscoveryRepository(adapter, 'discoveries.json', () => NOW);
    const second = new DiscoveryRepository(adapter, 'discoveries.json', () => NOW);
    const firstFile = await first.load();
    const secondFile = await second.load();
    firstFile.discoveries[0]!.feedbackStatus = 'accepted';
    await first.save(firstFile);
    secondFile.discoveries[0]!.feedbackStatus = 'rejected';
    secondFile.discoveries[0]!.status = 'dismissed';
    await expect(second.save(secondFile)).rejects.toMatchObject({ code: 'conflict' });
    const reloaded = await new DiscoveryRepository(adapter, 'discoveries.json', () => NOW).load();
    expect(reloaded.discoveries[0]?.feedbackStatus).toBe('accepted');
  });

  it('同一时间窗口多次损坏备份使用不同键且不覆盖', async () => {
    const raw = 'not-json{{';
    const adapter = new MemoryAdapter();
    adapter.files.set('discoveries.json', raw);
    const repo = new DiscoveryRepository(adapter, 'discoveries.json', () => NOW);

    const first = await repo.loadDetailed();
    const second = await repo.loadDetailed();
    const backupKeys = [...adapter.files.keys()].filter((key) =>
      key.startsWith('discoveries.json.corrupt-'),
    );

    expect(first.backupStatus).toBe('succeeded');
    expect(second.backupStatus).toBe('succeeded');
    expect(first.backupKey).not.toBe(second.backupKey);
    expect(backupKeys).toHaveLength(2);
    for (const key of backupKeys) {
      expect(adapter.files.get(key)).toBe(raw);
    }
  });

  it('blocked 状态下队列反馈不能覆盖原始文件', async () => {
    const raw = JSON.stringify({ discoverySchemaVersion: 1 });
    const adapter = new MemoryAdapter();
    adapter.files.set('discoveries.json', raw);
    const repo = new DiscoveryRepository(adapter, 'discoveries.json', () => NOW);
    await repo.loadDetailed();

    const queue = new DiscoveryWriteQueue(
      sampleFile(),
      (file) => repo.save(file),
    );
    await expect(
      queue.enqueue((state) => applyDiscoveryFeedback(state, 'd1', 'accepted', NOW)),
    ).rejects.toThrowError(/已暂停写入/);
    expect(adapter.files.get('discoveries.json')).toBe(raw);
  });

  it('blocked 状态下刷新写入不能覆盖原始文件', async () => {
    const raw = JSON.stringify({ discoverySchemaVersion: 1 });
    const adapter = new MemoryAdapter();
    adapter.files.set('discoveries.json', raw);
    const repo = new DiscoveryRepository(adapter, 'discoveries.json', () => NOW);
    await repo.loadDetailed();

    const queue = new DiscoveryWriteQueue(
      sampleFile(),
      (file) => repo.save(file),
    );
    await expect(
      queue.enqueue((state) =>
        new DiscoveryEngine(() => NOW).generate(emptyGraph(NOW), state),
      ),
    ).rejects.toThrowError(/已暂停写入/);
    expect(adapter.files.get('discoveries.json')).toBe(raw);
  });

  it('v1 文件成功迁移到 v2 并保留发现元数据', async () => {
    const raw = JSON.stringify({
      discoverySchemaVersion: 1,
      updatedAt: NOW,
      discoveries: [
        {
          id: 'd1',
          kind: 'cross-project-topic',
          title: '旧发现',
          description: '旧描述',
          nodeIds: ['a', 'b'],
          projectKeys: ['P1', 'P2'],
          subjectKeys: ['topic'],
          evidence: [
            {
              kind: 'source',
              nodeId: 'a',
              sourceUri: 'vault:P1/a.md',
              text: '来源 A',
            },
          ],
          ruleVersion: 'v1',
          strength: 'strong',
          dedupeKey: 'd1',
          status: 'active',
          feedbackStatus: 'accepted',
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
    });
    const adapter = new MemoryAdapter();
    adapter.files.set('discoveries.json', raw);
    const repo = new DiscoveryRepository(adapter, 'discoveries.json', () => NOW);

    const result = await repo.loadDetailed();
    expect(result.blocked).toBe(false);
    expect(result.file.discoverySchemaVersion).toBe(3);
    expect(result.file.discoveries[0]?.id).toBe('d1');
    expect(result.file.discoveries[0]?.feedbackStatus).toBe('accepted');
    expect(result.file.discoveries[0]?.evidence[0]?.sourceUri).toBe('vault:P1/a.md');
    expect(result.file.discoveries[0]?.application?.state).toBe('none');

    await repo.save(result.file);
    const saved = JSON.parse(adapter.files.get('discoveries.json') ?? '{}');
    expect(saved.discoverySchemaVersion).toBe(3);
    expect(saved.discoveries[0]?.feedbackStatus).toBe('accepted');
    expect(saved.discoveries[0]?.application?.state).toBe('none');

    const again = await repo.loadDetailed();
    expect(again.blocked).toBe(false);
    expect(again.file.discoveries).toHaveLength(1);
  });

  it('v1 非法记录迁移失败时阻止写入并保护原文件', async () => {
    const raw = JSON.stringify({
      discoverySchemaVersion: 1,
      discoveries: [{ id: 'd1', nodeIds: ['a'] }],
    });
    const adapter = new MemoryAdapter();
    adapter.files.set('discoveries.json', raw);
    const repo = new DiscoveryRepository(adapter, 'discoveries.json', () => NOW);

    const result = await repo.loadDetailed();
    expect(result.blocked).toBe(true);
    expect(adapter.files.get('discoveries.json')).toBe(raw);
    await expect(repo.save(sampleFile())).rejects.toThrowError(/已暂停写入/);
  });

  it('未知 application 状态不会被静默丢弃', async () => {
    const raw = JSON.stringify({
      discoverySchemaVersion: 2,
      discoveries: [
        {
          id: 'd1',
          kind: 'cross-project-topic',
          nodeIds: ['a', 'b'],
          application: { state: 'unknown-state' },
        },
      ],
    });
    const adapter = new MemoryAdapter();
    adapter.files.set('discoveries.json', raw);
    const repo = new DiscoveryRepository(adapter, 'discoveries.json', () => NOW);

    const result = await repo.loadDetailed();
    expect(result.blocked).toBe(true);
    expect(adapter.files.get('discoveries.json')).toBe(raw);
  });

  it('迁移补齐的 suppressionKey 与同内容新候选一致', async () => {
    const { graph } = qualityFixture();
    const generated = generateDiscoveries(graph, emptyDiscoveryFile(NOW), () => NOW);
    const source = generated.discoveries[0];
    if (!source) throw new Error('缺少发现夹具');
    const legacy = JSON.parse(JSON.stringify(generated)) as typeof generated;
    legacy.discoverySchemaVersion = 2;
    delete legacy.identityVersion;
    delete legacy.discoveries[0]!.suppressionKey;
    delete legacy.discoveries[0]!.identityVersion;

    const adapter = new MemoryAdapter();
    adapter.files.set('discoveries.json', JSON.stringify(legacy));
    const loaded = await new DiscoveryRepository(
      adapter,
      'discoveries.json',
      () => NOW,
    ).load();
    const migrated = loaded.discoveries.find((item) => item.id === source.id);
    if (!migrated) throw new Error('迁移记录缺失');

    const candidate = generateDiscoveries(graph, loaded, () => NOW).discoveries.find(
      (item) =>
        item.nodeIds.length === migrated.nodeIds.length &&
        item.nodeIds.every((id) => migrated.nodeIds.includes(id)),
    );
    expect(candidate?.suppressionKey).toBe(migrated.suppressionKey);
  });

  it('迁移诊断统计当前/空证据记录，且不写入持久化结果', async () => {
    const adapter = new MemoryAdapter();
    const file = sampleFile();
    file.discoveries[0]!.evidence = [];
    await new DiscoveryRepository(adapter, 'discoveries.json', () => NOW).save(file);
    const loaded = await new DiscoveryRepository(
      adapter,
      'discoveries.json',
      () => NOW,
    ).loadDetailed();
    expect(loaded.blocked).toBe(false);
    expect(loaded.migration).toMatchObject({
      totalRecords: 1,
      legacyRecords: 0,
      currentRecords: 1,
      emptyEvidenceRecords: 1,
      persistedInThisInstance: 'not-attempted',
      persistedHistory: 'unknown',
    });
  });

  it('真实 v1 证据形状经迁移与引擎消费时不错误抑制不同画像', async () => {
    const { graph } = qualityFixture();
    const base = generateDiscoveries(graph, emptyDiscoveryFile(NOW), () => NOW).discoveries[0];
    if (!base) throw new Error('缺少发现夹具');
    const legacy = emptyDiscoveryFile(NOW);
    legacy.discoverySchemaVersion = 2;
    legacy.identityVersion = 1;
    legacy.discoveries.push({
      ...base,
      id: 'discovery_v1_shape',
      identityVersion: 1,
      dedupeKey: 'discovery_v1_shape',
      suppressionKey: undefined,
      status: 'dismissed',
      feedbackStatus: 'rejected',
      evidence: base.evidence.filter((item) => item.kind !== 'confirmed-edge'),
    });
    const adapter = new MemoryAdapter();
    adapter.files.set('discoveries.json', JSON.stringify(legacy));
    const loaded = await new DiscoveryRepository(
      adapter,
      'discoveries.json',
      () => NOW,
    ).load();
    const migrated = loaded.discoveries[0];
    if (!migrated) throw new Error('迁移记录缺失');

    const result = generateDiscoveries(graph, loaded, () => NOW);
    const samePair = result.discoveries.filter(
      (item) =>
        item.nodeIds.length === migrated.nodeIds.length &&
        item.nodeIds.every((id) => migrated.nodeIds.includes(id)),
    );
    const candidate = samePair.find((item) => item.id !== migrated.id);
    expect(migrated.status).toBe('dismissed');
    expect(migrated.feedbackStatus).toBe('rejected');
    expect(candidate?.suppressionKey).not.toBe(migrated.suppressionKey);
    expect(samePair.filter((item) => item.status === 'active')).toHaveLength(1);
  });

  it('非法时间戳在加载时 blocked，在保存时 invalid-data', async () => {
    const adapter = new MemoryAdapter();
    const raw = sampleFile();
    raw.discoveries[0]!.createdAt = 'not-a-date';
    adapter.files.set('discoveries.json', JSON.stringify(raw));
    const before = adapter.files.get('discoveries.json');
    const loaded = await new DiscoveryRepository(
      adapter,
      'discoveries.json',
      () => NOW,
    ).loadDetailed();
    expect(loaded.blocked).toBe(true);
    expect(loaded.issues.join(' ')).toContain('时间戳');
    expect(adapter.files.get('discoveries.json')).toBe(before);

    const file = sampleFile();
    file.discoveries[0]!.updatedAt = 'not-a-date';
    const repo = new DiscoveryRepository(adapter, 'discoveries.json', () => NOW);
    await expect(repo.save(file)).rejects.toMatchObject({ code: 'invalid-data' });
  });

  it('证据 nodeId 空字符串或无对应节点时 blocked，不写盘', async () => {
    const adapter = new MemoryAdapter();
    const raw = sampleFile();
    raw.discoveries[0]!.evidence = [
      { kind: 'source', nodeId: '', text: 'bad' },
    ];
    adapter.files.set('discoveries.json', JSON.stringify(raw));
    const before = adapter.files.get('discoveries.json');
    const loaded = await new DiscoveryRepository(
      adapter,
      'discoveries.json',
      () => NOW,
    ).loadDetailed();
    expect(loaded.blocked).toBe(true);
    expect(loaded.issues.join(' ')).toContain('evidence');
    expect(adapter.files.get('discoveries.json')).toBe(before);
  });

  it('保存拒绝缺少身份字段的记录', async () => {
    const adapter = new MemoryAdapter();
    const repo = new DiscoveryRepository(adapter, 'discoveries.json', () => NOW);
    const file = sampleFile();
    delete file.discoveries[0]!.suppressionKey;
    await expect(repo.save(file)).rejects.toMatchObject({ code: 'invalid-data' });
  });

  it('v2 旧记录迁移到 v3，补齐 suppressionKey/identityVersion 且保留反馈与应用', async () => {
    const legacy = sampleFile();
    legacy.discoverySchemaVersion = 2;
    legacy.identityVersion = undefined;
    legacy.discoveries[0]!.feedbackStatus = 'accepted';
    legacy.discoveries[0]!.application = {
      state: 'applied',
      edgeId: 'edge_1',
      sourceNodeId: 'a',
      targetNodeId: 'b',
      relation: 'related-to',
      appliedAt: NOW,
      updatedAt: NOW,
    };
    legacy.discoveries[0]!.suppressionKey = undefined;
    legacy.discoveries[0]!.identityVersion = undefined;

    const adapter = new MemoryAdapter();
    adapter.files.set('discoveries.json', JSON.stringify(legacy));
    const repo = new DiscoveryRepository(adapter, 'discoveries.json', () => NOW);
    const loaded = await repo.load();

    expect(loaded.discoverySchemaVersion).toBe(3);
    expect(loaded.identityVersion).toBe(1);
    expect(loaded.discoveries[0]?.suppressionKey).toEqual(expect.any(String));
    expect(loaded.discoveries[0]?.identityVersion).toBe(1);
    expect(loaded.discoveries[0]?.feedbackStatus).toBe('accepted');
    expect(loaded.discoveries[0]?.application?.state).toBe('applied');

    const suppressionKey = loaded.discoveries[0]?.suppressionKey;
    await repo.save(loaded);
    const reloaded = await new DiscoveryRepository(adapter, 'discoveries.json', () => NOW).load();
    expect(reloaded.discoveries[0]?.suppressionKey).toBe(suppressionKey);
  });
});
