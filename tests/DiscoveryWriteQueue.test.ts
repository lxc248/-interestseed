import { describe, expect, it, vi } from 'vitest';

import { DiscoveryWriteQueue } from '../src/discovery/DiscoveryWriteQueue';
import { applyDiscoveryFeedback } from '../src/discovery/feedback';
import { emptyDiscoveryFile } from '../src/discovery/types';
import type { DiscoveryFile } from '../src/discovery/types';

const NOW = '2026-01-01T00:00:00.000Z';

function fileWith(id: string, feedback: 'none' | 'accepted' | 'rejected' = 'none'): DiscoveryFile {
  const file = emptyDiscoveryFile(NOW);
  file.discoveries.push({
    id,
    kind: 'cross-project-topic',
    title: '共同主题',
    description: '说明',
    nodeIds: ['a', 'b'],
    projectKeys: ['P1', 'P2'],
    subjectKeys: ['tag'],
    evidence: [{ kind: 'source', nodeId: 'a', sourceUri: 'vault:a.md', text: '来源' }],
    ruleVersion: 'v1',
    strength: 'moderate',
    dedupeKey: id,
    status: 'active',
    feedbackStatus: feedback,
    createdAt: NOW,
    updatedAt: NOW,
  });
  return file;
}

function mutatorWith(id: string): (_state: DiscoveryFile) => DiscoveryFile {
  return (_state) => {
    const next = emptyDiscoveryFile(NOW);
    next.discoveries = [fileWith(id).discoveries[0]!];
    return next;
  };
}

describe('DiscoveryWriteQueue 串行化', () => {
  it('反馈操作与刷新共享同一队列，反馈不会被后提交的刷新覆盖', async () => {
    const saved: DiscoveryFile[] = [];
    let releaseFirst: (() => void) | undefined;
    let markFirstStarted: (() => void) | undefined;
    const firstStarted = new Promise<void>((resolve) => {
      markFirstStarted = resolve;
    });
    const save = (file: DiscoveryFile): Promise<void> =>
      new Promise((resolve) => {
        saved.push(file);
        if (saved.length === 1) {
          releaseFirst = resolve;
          markFirstStarted?.();
        } else {
          resolve();
        }
      });

    const queue = new DiscoveryWriteQueue(emptyDiscoveryFile(NOW), save);

    const refresh = queue.enqueue(mutatorWith('d1'));
    await firstStarted;
    const feedback = queue.enqueue((state) =>
      applyDiscoveryFeedback(state, 'd1', 'rejected', NOW),
    );
    releaseFirst?.();

    await refresh;
    await feedback;

    expect(queue.getState().discoveries[0]?.id).toBe('d1');
    expect(queue.getState().discoveries[0]?.feedbackStatus).toBe('rejected');
    expect(queue.getState().discoveries[0]?.status).toBe('dismissed');
  });

  it('连续两次反馈按提交顺序处理', async () => {
    const queue = new DiscoveryWriteQueue(fileWith('d1'), async () => {});

    await queue.enqueue((state) =>
      applyDiscoveryFeedback(state, 'd1', 'accepted', NOW),
    );
    await queue.enqueue((state) =>
      applyDiscoveryFeedback(state, 'd1', 'needs-verification', NOW),
    );

    expect(queue.getState().discoveries[0]?.feedbackStatus).toBe('needs-verification');
  });

  it('第一次保存失败后，后续任务仍继续并基于未更新状态执行', async () => {
    let calls = 0;
    const queue = new DiscoveryWriteQueue(emptyDiscoveryFile(NOW), async () => {
      calls += 1;
      if (calls === 1) throw new Error('第一次失败');
    });

    await expect(queue.enqueue(mutatorWith('d1'))).rejects.toThrowError(/第一次失败/);
    await queue.enqueue(mutatorWith('d2'));

    expect(queue.getState().discoveries[0]?.id).toBe('d2');
  });

  it('所有操作完成后内存状态与最终写入一致', async () => {
    const saved: DiscoveryFile[] = [];
    const queue = new DiscoveryWriteQueue(fileWith('d1'), async (file) => {
      saved.push(file);
    });

    await queue.enqueue((state) =>
      applyDiscoveryFeedback(state, 'd1', 'rejected', NOW),
    );

    expect(saved.at(-1)?.discoveries[0]?.feedbackStatus).toBe('rejected');
    expect(queue.getState()).toEqual(saved.at(-1));
  });

  it('受保护存储的保存失败不会更新内存状态', async () => {
    const queue = new DiscoveryWriteQueue(fileWith('d1'), async () => {
      throw new Error('已暂停写入');
    });

    await expect(
      queue.enqueue((state) =>
        applyDiscoveryFeedback(state, 'd1', 'accepted', NOW),
      ),
    ).rejects.toThrowError(/已暂停写入/);

    expect(queue.getState().discoveries[0]?.feedbackStatus).toBe('none');
  });

  it('保存成功但 onSaved 抛错时，保存结果仍为成功且队列可继续', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let saves = 0;
    const queue = new DiscoveryWriteQueue(
      emptyDiscoveryFile(NOW),
      async () => {
        saves += 1;
      },
      () => {
        throw new Error('通知失败');
      },
    );

    await expect(queue.enqueue(mutatorWith('d1'))).resolves.toBeUndefined();
    expect(saves).toBe(1);
    expect(queue.getState().discoveries[0]?.id).toBe('d1');
    expect(errorSpy).toHaveBeenCalled();

    await queue.enqueue(mutatorWith('d2'));
    expect(queue.getState().discoveries[0]?.id).toBe('d2');
    errorSpy.mockRestore();
  });

  it('保存失败时不会通知 onSaved', async () => {
    let notified = 0;
    const queue = new DiscoveryWriteQueue(
      fileWith('d1'),
      async () => {
        throw new Error('磁盘失败');
      },
      () => {
        notified += 1;
      },
    );

    await expect(
      queue.enqueue((state) =>
        applyDiscoveryFeedback(state, 'd1', 'accepted', NOW),
      ),
    ).rejects.toThrowError(/磁盘失败/);
    expect(notified).toBe(0);
    expect(queue.getState().discoveries[0]?.feedbackStatus).toBe('none');
  });

  it('空队列 flush 立即完成', async () => {
    const queue = new DiscoveryWriteQueue(emptyDiscoveryFile(NOW), async () => {});
    await expect(queue.flush()).resolves.toBeUndefined();
    expect(queue.pendingCount).toBe(0);
  });

  it('flush 等待正在执行的任务与多个已提交任务', async () => {
    let releaseFirst: (() => void) | undefined;
    let startedFirst: (() => void) | undefined;
    const firstStarted = new Promise<void>((resolve) => {
      startedFirst = resolve;
    });
    let saves = 0;
    const queue = new DiscoveryWriteQueue(
      emptyDiscoveryFile(NOW),
      async () => {
        saves += 1;
        if (saves === 1) {
          startedFirst?.();
          await new Promise<void>((resolve) => {
            releaseFirst = resolve;
          });
        }
      },
    );

    const first = queue.enqueue(mutatorWith('d1'));
    await firstStarted;
    const second = queue.enqueue(mutatorWith('d2'));
    expect(queue.pendingCount).toBe(2);

    let flushed = false;
    const flushing = queue.flush().then(() => {
      flushed = true;
    });
    await Promise.resolve();
    expect(flushed).toBe(false);

    releaseFirst?.();
    await flushing;
    await first;
    await second;

    expect(flushed).toBe(true);
    expect(queue.pendingCount).toBe(0);
    expect(queue.getState().discoveries[0]?.id).toBe('d2');
  });

  it('flush 只等待调用时已提交的任务，不等待之后新增任务', async () => {
    let releaseFirst: (() => void) | undefined;
    let releaseSecond: (() => void) | undefined;
    let startedFirst: (() => void) | undefined;
    let startedSecond: (() => void) | undefined;
    const firstStarted = new Promise<void>((resolve) => {
      startedFirst = resolve;
    });
    const secondStarted = new Promise<void>((resolve) => {
      startedSecond = resolve;
    });
    let saves = 0;
    const queue = new DiscoveryWriteQueue(
      emptyDiscoveryFile(NOW),
      async () => {
        saves += 1;
        if (saves === 1) {
          startedFirst?.();
          await new Promise<void>((resolve) => {
            releaseFirst = resolve;
          });
        } else if (saves === 2) {
          startedSecond?.();
          await new Promise<void>((resolve) => {
            releaseSecond = resolve;
          });
        }
      },
    );

    const first = queue.enqueue(mutatorWith('d1'));
    await firstStarted;
    const flushing = queue.flush();
    const second = queue.enqueue(mutatorWith('d2'));

    releaseFirst?.();
    await flushing;
    await secondStarted;

    // 第二个任务不在本次 flush 的等待范围内。
    expect(queue.pendingCount).toBe(1);
    expect(queue.getState().discoveries[0]?.id).toBe('d1');

    releaseSecond?.();
    await first;
    await second;
    expect(queue.pendingCount).toBe(0);
    expect(queue.getState().discoveries[0]?.id).toBe('d2');
  });

  it('任务失败后 flush 仍完成，后续任务继续', async () => {
    let calls = 0;
    const queue = new DiscoveryWriteQueue(emptyDiscoveryFile(NOW), async () => {
      calls += 1;
      if (calls === 1) throw new Error('第一次失败');
    });

    await expect(queue.enqueue(mutatorWith('d1'))).rejects.toThrowError(/第一次失败/);
    await expect(queue.flush()).resolves.toBeUndefined();
    await queue.enqueue(mutatorWith('d2'));

    expect(queue.pendingCount).toBe(0);
    expect(queue.getState().discoveries[0]?.id).toBe('d2');
  });

  it('重复调用 flush 都安全完成', async () => {
    const queue = new DiscoveryWriteQueue(emptyDiscoveryFile(NOW), async () => {});
    const first = queue.flush();
    const second = queue.flush();
    await expect(Promise.all([first, second])).resolves.toEqual([undefined, undefined]);
  });

  it('关闭前已接受任务完成，关闭后新任务被拒绝', async () => {
    let release: (() => void) | undefined;
    let started: (() => void) | undefined;
    const startedPromise = new Promise<void>((resolve) => {
      started = resolve;
    });
    const queue = new DiscoveryWriteQueue(
      emptyDiscoveryFile(NOW),
      async () => {
        started?.();
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      },
    );

    const accepted = queue.enqueue(mutatorWith('d1'));
    await startedPromise;
    queue.close();
    queue.close();

    await expect(queue.enqueue(mutatorWith('d2'))).rejects.toThrowError(/已关闭/);
    release?.();
    await accepted;
    await queue.flush();

    expect(queue.isClosed).toBe(true);
    expect(queue.pendingCount).toBe(0);
    expect(queue.getState().discoveries[0]?.id).toBe('d1');
  });

  it('关闭后 enqueue 明确拒绝，pending 保持为 0', async () => {
    const queue = new DiscoveryWriteQueue(emptyDiscoveryFile(NOW), async () => {});
    queue.close();

    await expect(queue.enqueue(mutatorWith('d1'))).rejects.toThrowError(/已关闭/);
    expect(queue.pendingCount).toBe(0);
    await expect(queue.flush()).resolves.toBeUndefined();
  });

  it('onSaved 与错误记录同时抛错时，保存仍成功', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      throw new Error('日志失败');
    });
    const queue = new DiscoveryWriteQueue(
      emptyDiscoveryFile(NOW),
      async () => {},
      () => {
        throw new Error('通知失败');
      },
    );

    await expect(queue.enqueue(mutatorWith('d1'))).resolves.toBeUndefined();
    expect(queue.getState().discoveries[0]?.id).toBe('d1');
    errorSpy.mockRestore();
  });

  it('does not save when mutator returns the same state reference', async () => {
    let saves = 0;
    const queue = new DiscoveryWriteQueue(emptyDiscoveryFile(NOW), async () => {
      saves += 1;
    });
    const same = queue.getState();
    await expect(queue.enqueue((state) => state)).resolves.toBeUndefined();
    expect(saves).toBe(0);
    expect(queue.getState()).toBe(same);
  });

  it('keeps the failed marker after a no-change skipped task', async () => {
    let shouldFail = true;
    const queue = new DiscoveryWriteQueue(emptyDiscoveryFile(NOW), async () => {
      if (shouldFail) throw new Error('save failed');
    });
    await expect(queue.enqueue(mutatorWith('fail'))).rejects.toThrow('save failed');
    expect(queue.hasSaveFailed).toBe(true);
    shouldFail = false;
    await expect(queue.enqueue((state) => state)).resolves.toBeUndefined();
    expect(queue.hasSaveFailed).toBe(true);
    expect(queue.pendingCount).toBe(0);
  });

  it('does not save when feedback id is missing', async () => {
    const initial = fileWith('d1');
    let saves = 0;
    const queue = new DiscoveryWriteQueue(initial, async () => {
      saves += 1;
    });
    await expect(
      queue.enqueue((state) => applyDiscoveryFeedback(state, 'missing', 'accepted')),
    ).resolves.toBeUndefined();
    expect(saves).toBe(0);
    expect(queue.getState()).toBe(initial);
  });

  it('tracks the most recent save failure without exposing raw data', async () => {    let shouldFail = true;
    const queue = new DiscoveryWriteQueue(emptyDiscoveryFile(NOW), async () => {
      if (shouldFail) throw new Error('save failed');
    });

    await expect(queue.enqueue(mutatorWith('fail'))).rejects.toThrow('save failed');
    expect(queue.hasSaveFailed).toBe(true);

    shouldFail = false;
    await expect(queue.enqueue(mutatorWith('success'))).resolves.toBeUndefined();
    expect(queue.hasSaveFailed).toBe(false);
  });
});
