import { describe, expect, it, vi } from 'vitest';
import { UndoHistory } from '../src/core/UndoManager';

describe('UndoHistory', () => {
  it('execute 执行并记录，undo 只回退最近一次', () => {
    const state = { value: 0 };
    const manager = new UndoHistory();

    manager.execute(
      '加一',
      () => {
        state.value += 1;
      },
      () => {
        state.value -= 1;
      },
    );
    manager.execute(
      '再加一',
      () => {
        state.value += 1;
      },
      () => {
        state.value -= 1;
      },
    );

    expect(state.value).toBe(2);
    expect(manager.canUndo()).toBe(true);
    expect(manager.undoLabel()).toBe('再加一');

    expect(manager.undo()).toBe(true);
    expect(state.value).toBe(1);
    expect(manager.canUndo()).toBe(true);

    expect(manager.undo()).toBe(true);
    expect(state.value).toBe(0);
    expect(manager.canUndo()).toBe(false);
    expect(manager.undo()).toBe(false);
  });

  it('apply 抛错时不产生撤销记录', () => {
    const manager = new UndoHistory();
    const revert = vi.fn();

    expect(() =>
      manager.execute(
        '会失败',
        () => {
          throw new Error('boom');
        },
        revert,
      ),
    ).toThrowError('boom');

    expect(manager.canUndo()).toBe(false);
  });

  it('redo 可以重放最近一次撤销', () => {
    const state = { value: 0 };
    const manager = new UndoHistory();

    manager.execute(
      '加一',
      () => {
        state.value += 1;
      },
      () => {
        state.value -= 1;
      },
    );

    manager.undo();
    expect(manager.canRedo()).toBe(true);
    expect(manager.redo()).toBe(true);
    expect(state.value).toBe(1);
  });

  it('新命令会清空重做栈', () => {
    const manager = new UndoHistory();
    const noop = (): void => undefined;

    manager.execute('a', noop, noop);
    manager.undo();
    expect(manager.canRedo()).toBe(true);

    manager.execute('b', noop, noop);
    expect(manager.canRedo()).toBe(false);
  });

  it('超过 maxDepth 时丢弃最旧记录', () => {
    const state = { value: 0 };
    const manager = new UndoHistory({ maxDepth: 2 });

    for (let index = 0; index < 3; index += 1) {
      manager.execute(
        `第 ${index} 次`,
        () => {
          state.value += 1;
        },
        () => {
          state.value -= 1;
        },
      );
    }

    expect(manager.depth()).toBe(2);
    manager.undo();
    manager.undo();
    expect(state.value).toBe(1);
    expect(manager.undo()).toBe(false);
  });

  it('撤销失败时丢弃命令并上报错误', () => {
    const errorSpy = vi.fn();
    const manager = new UndoHistory({ onError: errorSpy });

    manager.execute(
      '坏命令',
      () => undefined,
      () => {
        throw new Error('revert failed');
      },
    );

    expect(manager.undo()).toBe(false);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(manager.canUndo()).toBe(false);
  });

  it('clear 清空全部历史', () => {
    const manager = new UndoHistory();
    const noop = (): void => undefined;
    manager.execute('a', noop, noop);
    manager.undo();
    manager.clear();

    expect(manager.canUndo()).toBe(false);
    expect(manager.canRedo()).toBe(false);
    expect(manager.depth()).toBe(0);
  });

  it('状态变化会通知订阅者', () => {
    const manager = new UndoHistory();
    const listener = vi.fn();
    const unsubscribe = manager.subscribe(listener);
    const noop = (): void => undefined;

    manager.execute('a', noop, noop);
    manager.undo();
    unsubscribe();
    manager.redo();

    expect(listener).toHaveBeenCalledTimes(2);
  });
});
