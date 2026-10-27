import { describe, expect, it } from 'vitest';

import { notifyDiscoveryListenersSafely } from '../src/discovery/notify';

describe('notifyDiscoveryListenersSafely', () => {
  it('单个监听器抛错不阻断后续监听器', () => {
    const called: string[] = [];
    const errors: unknown[] = [];

    notifyDiscoveryListenersSafely(
      [
        () => {
          called.push('first');
          throw new Error('监听器失败');
        },
        () => {
          called.push('second');
        },
      ],
      (error) => errors.push(error),
    );

    expect(called).toEqual(['first', 'second']);
    expect(errors).toHaveLength(1);
  });

  it('无异常时不调用错误处理', () => {
    const called: string[] = [];
    const errors: unknown[] = [];

    notifyDiscoveryListenersSafely(
      [() => called.push('first'), () => called.push('second')],
      (error) => errors.push(error),
    );

    expect(called).toEqual(['first', 'second']);
    expect(errors).toHaveLength(0);
  });

  it('错误处理函数自身抛错也不阻断后续监听器或调用方', () => {
    const called: string[] = [];

    expect(() =>
      notifyDiscoveryListenersSafely(
        [
          () => {
            called.push('first');
            throw new Error('监听器失败');
          },
          () => called.push('second'),
        ],
        () => {
          throw new Error('错误处理失败');
        },
      ),
    ).not.toThrow();

    expect(called).toEqual(['first', 'second']);
  });
});
