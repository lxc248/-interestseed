import type { InterestSeedGraphStore } from '../core/GraphStore';
import type { LoadResult, VaultGraphRepository } from '../storage/GraphRepository';

export interface PersistenceState {
  blocked: boolean;
  blockedReason: string | null;
  saveFailed: boolean;
}

export interface PersistenceOptions {
  store: InterestSeedGraphStore;
  repository: VaultGraphRepository;
  debounceMs?: number;
  onStateChange(state: PersistenceState): void;
  onError(message: string): void;
}

/**
 * 负责图谱的读写调度、失败状态与迁移保护。
 * 不持有 UI 逻辑，只通过回调把状态交给插件更新状态栏。
 */
export class PersistenceService {
  private blocked = false;
  private blockedReason: string | null = null;
  private saveFailed = false;
  private dirty = false;
  private timer: number | null = null;
  private queue: Promise<void> = Promise.resolve();
  private lastNoticeAt = 0;
  private revision = 0;

  constructor(private readonly options: PersistenceOptions) {}

  get state(): PersistenceState {
    return {
      blocked: this.blocked,
      blockedReason: this.blockedReason,
      saveFailed: this.saveFailed,
    };
  }

  get isBlocked(): boolean {
    return this.blocked;
  }

  async load(): Promise<LoadResult> {
    const result = await this.options.repository.loadDetailed();
    this.options.store.replace(result.graph, { silent: true });
    this.blocked = result.blocked;
    this.blockedReason = result.blockedReason;
    this.notify();
    return result;
  }

  scheduleSave(): void {
    this.revision += 1;
    this.dirty = true;
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, this.options.debounceMs ?? 900);
  }

  async flush(): Promise<void> {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    if (!this.dirty && !this.saveFailed) return;

    const graph = this.options.store.toJSON();
    const revisionAtStart = this.revision;
    const run = async (): Promise<void> => {
      if (this.blocked) {
        this.notify();
        return;
      }

      try {
        await this.options.repository.save(graph);
        // 保存期间若又发生编辑，scheduleSave 已把 revision 增加；
        // 此时不能把 dirty 清掉，否则最后一次编辑会永远不落盘。
        if (this.revision === revisionAtStart) this.dirty = false;
        if (this.saveFailed) {
          this.saveFailed = false;
          this.notify();
        }
      } catch (error) {
        // 内存中的图谱不回滚，等待用户重试或下一次修改。
        this.dirty = true;
        this.saveFailed = true;
        this.notify();

        const now = Date.now();
        if (now - this.lastNoticeAt > 10_000) {
          this.lastNoticeAt = now;
          this.options.onError(
            `保存图谱失败：${
              error instanceof Error ? error.message : String(error)
            }。修改仍保留在内存中。请先检查磁盘空间与插件目录权限，然后执行命令“重试保存图谱”；若仍失败，请执行“创建图谱备份”并查看开发者控制台。`,
          );
        }
      }
    };

    this.queue = this.queue.then(run, run);
    await this.queue;
  }

  async retry(): Promise<boolean> {
    await this.flush();
    return !this.saveFailed;
  }

  /** 显式备份；失败会抛出带原因的异常，由控制器提示用户。 */
  async createBackup(): Promise<string | null> {
    await this.options.repository.createBackup();
    return this.options.repository.lastBackupKey;
  }

  /** 迁移失败后：先备份原文件，再解除写入保护并保存当前内存图谱。 */
  async repair(): Promise<string | null> {
    if (!this.blocked) return null;
    const backup = await this.options.repository.releaseBlockAfterBackup();
    this.blocked = false;
    this.blockedReason = null;
    await this.flush();
    this.notify();
    return backup;
  }

  dispose(): void {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
  }

  private notify(): void {
    this.options.onStateChange(this.state);
  }
}
