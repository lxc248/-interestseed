import type { App, PluginManifest } from 'obsidian';
import type { GraphStorageAdapter } from './GraphRepository';

export const GRAPH_FOLDER = 'graphs';
export const GRAPH_FILE = 'default.json';
export const LEGACY_GRAPH_FILE = 'graph.json';

/** 只需要 app 与 manifest，便于测试替身实现。 */
export interface PluginStorageHost {
  app: App;
  manifest: PluginManifest;
}

/**
 * 插件目录存储：<pluginDir>/graphs/default.json。
 *
 * 写入流程：.tmp → 读回校验 → 旧文件转 .bak → .tmp 重命名为正式文件。
 * 读取顺序：正式文件 → .bak → 旧版 graph.json。
 */
export class PluginDataStorage implements GraphStorageAdapter {
  constructor(
    private readonly host: PluginStorageHost,
    private readonly folder: string = GRAPH_FOLDER,
  ) {}

  async read(key: string): Promise<string | null> {
    const path = this.path(key);
    const adapter = this.host.app.vault.adapter;

    const candidates = [path, `${path}.bak`];
    if (key === GRAPH_FILE) {
      candidates.push(`${this.pluginDir()}/${LEGACY_GRAPH_FILE}`);
    }

    for (const candidate of candidates) {
      if (await adapter.exists(candidate)) return adapter.read(candidate);
    }
    return null;
  }

  async write(key: string, data: string): Promise<void> {
    const target = this.path(key);
    const temp = `${target}.tmp`;
    const backup = `${target}.bak`;
    const adapter = this.host.app.vault.adapter;

    await this.ensureFolder(this.folder);

    try {
      await adapter.write(temp, data);

      const readBack = await adapter.read(temp);
      if (readBack !== data) {
        throw new Error('临时文件写入校验不一致');
      }

      if (await adapter.exists(target)) {
        if (await adapter.exists(backup)) await adapter.remove(backup);
        await adapter.rename(target, backup);
      }

      try {
        await adapter.rename(temp, target);
      } catch (error) {
        if ((await adapter.exists(backup)) && !(await adapter.exists(target))) {
          try {
            await adapter.rename(backup, target);
          } catch {
            // 还原失败时保留 .bak，读取逻辑会兜底使用它。
          }
        }
        throw error;
      }
    } catch (error) {
      try {
        if (await adapter.exists(temp)) await adapter.remove(temp);
      } catch {
        // 清理失败不影响错误上报。
      }
      throw error;
    }
  }

  async remove(key: string): Promise<void> {
    const path = this.path(key);
    const adapter = this.host.app.vault.adapter;
    for (const candidate of [path, `${path}.tmp`, `${path}.bak`]) {
      if (await adapter.exists(candidate)) await adapter.remove(candidate);
    }
  }

  pluginDir(): string {
    return this.host.manifest.dir ?? '.obsidian/plugins/interestseed';
  }

  private async ensureFolder(relativeFolder: string): Promise<void> {
    const adapter = this.host.app.vault.adapter;
    let current = this.pluginDir();

    for (const part of relativeFolder.split('/').filter(Boolean)) {
      current = `${current}/${part}`;
      if (await adapter.exists(current)) continue;
      try {
        await adapter.mkdir(current);
      } catch (error) {
        if (!(await adapter.exists(current))) throw error;
      }
    }
  }

  private path(key: string): string {
    return `${this.pluginDir()}/${this.folder}/${key}`;
  }
}

export type LegacyMigrationResult = 'migrated' | 'kept' | 'none' | 'failed';

/**
 * 把插件根目录的旧 graph.json 迁移到 graphs/default.json。
 * 目标已存在时保留旧文件不动；重命名失败则复制后删除；仍失败则返回 failed，
 * 读取逻辑仍可兜底读取旧文件。
 */
export async function migrateLegacyGraphFile(
  app: App,
  pluginDir: string,
): Promise<LegacyMigrationResult> {
  const adapter = app.vault.adapter;
  const legacy = `${pluginDir}/${LEGACY_GRAPH_FILE}`;
  const target = `${pluginDir}/${GRAPH_FOLDER}/${GRAPH_FILE}`;

  if (!(await adapter.exists(legacy))) return 'none';

  if (await adapter.exists(target)) return 'kept';

  try {
    const folder = `${pluginDir}/${GRAPH_FOLDER}`;
    if (!(await adapter.exists(folder))) await adapter.mkdir(folder);
    await adapter.rename(legacy, target);
    return 'migrated';
  } catch {
    try {
      const data = await adapter.read(legacy);
      await adapter.write(target, data);
      await adapter.remove(legacy);
      return 'migrated';
    } catch {
      return 'failed';
    }
  }
}
