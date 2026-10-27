import type { DiscoveryFile } from './types';

/**
 * 串行化发现数据修改与持久化。
 *
 * 所有修改都以“任务执行时刻的最新状态”作为输入，避免在异步保存前
 * 捕获过期快照；前一个保存失败不会阻断后续任务，且内存状态只在保存
 * 成功后更新，保证 UI 与磁盘一致。
 */
export class DiscoveryWriteQueue {
  private chain: Promise<void> = Promise.resolve();
  private pending = 0;
  private closed = false;
  private saveFailed = false;

  constructor(
    private state: DiscoveryFile,
    private readonly save: (file: DiscoveryFile) => Promise<void>,
    private readonly onSaved: (file: DiscoveryFile) => void = () => {},
  ) {}

  getState(): DiscoveryFile {
    return this.state;
  }

  /** 当前已提交但尚未结束的任务数（包含正在执行的任务）。 */
  get pendingCount(): number {
    return this.pending;
  }

  hasPending(): boolean {
    return this.pending > 0;
  }

  get isClosed(): boolean {
    return this.closed;
  }

  /** 最近一次已结束的保存任务是否失败；后续成功任务会清除该标记。 */
  get hasSaveFailed(): boolean {
    return this.saveFailed;
  }

  /** 关闭后拒绝新任务；已接受任务继续完成。 */
  close(): void {
    this.closed = true;
  }

  /**
   * 等待调用时已经提交的任务全部结束。
   *
   * 语义：
   * - 只等待调用当下已经提交的任务，不等待调用期间新提交的任务；
   * - 单个任务失败不会让 flush 拒绝；失败由对应 enqueue 的 Promise 报告；
   * - 空队列或已失败任务之后调用，立即 resolve，不会死锁。
   */
  async flush(): Promise<void> {
    const chainAtCall = this.chain;
    await chainAtCall;
  }

  enqueue(mutator: (state: DiscoveryFile) => DiscoveryFile): Promise<void> {
    if (this.closed) {
      return Promise.reject(new Error('发现写入队列已关闭'));
    }

    this.pending += 1;
    let didSave = false;
    const task = this.chain.then(async () => {
      const next = mutator(this.state);
      // 调用方返回同一状态引用表示没有业务变化；不保存，避免无意义的 updatedAt/SHA 变化。
      if (next === this.state) return;
      await this.save(next);
      didSave = true;
      this.state = next;
      try {
        this.onSaved(next);
      } catch (error) {
        // 保存已成功；通知失败不能把本次保存重新判定为失败。
        try {
          console.error('[InterestSeed] 发现保存后通知失败', error);
        } catch {
          // 错误记录机制自身异常也不能破坏已完成的保存。
        }
      }
    });

    // 保存失败不能让后续任务永远卡住；错误由调用方处理。
    this.chain = task.then(
      () => undefined,
      () => undefined,
    );
    // pending 只反映任务生命周期，不改变 task 的 rejection 语义。
    task.then(
      () => {
        if (didSave) this.saveFailed = false;
        this.pending -= 1;
      },
      () => {
        this.saveFailed = true;
        this.pending -= 1;
      },
    );
    return task;
  }
}
