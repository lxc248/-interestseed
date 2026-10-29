import { describe, expect, it } from 'vitest';
import { resolveTaskState } from '../src/core/taskState';

describe('Interest task state', () => {
  it('keeps an explicit task state', () => {
    expect(resolveTaskState({ taskState: 'reviewed' }, false)).toBe('reviewed');
  });

  it('promotes captured or judged nodes once they have a connection', () => {
    expect(resolveTaskState({ taskState: 'captured' }, true)).toBe('connected');
    expect(resolveTaskState({ taskState: 'judged' }, true)).toBe('connected');
  });

  it('infers legacy states from experiment and connections', () => {
    expect(resolveTaskState({ nextStep: true }, false)).toBe('experimenting');
    expect(resolveTaskState({}, true)).toBe('connected');
    expect(resolveTaskState({}, false)).toBe('captured');
  });
});
