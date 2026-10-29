import { describe, expect, it } from 'vitest';
import {
  canRecordToday,
  createExperiment,
  experimentDay,
  experimentSummary,
  recordExperimentLog,
} from '../src/experiment/experiment';

function at(day: number): Date {
  return new Date(2026, 0, day, 12, 0, 0);
}

describe('7-day interest experiment', () => {
  it('starts with a hypothesis, a metric and no fake progress', () => {
    const state = createExperiment({
      title: '验证 AI 工具兴趣',
      hypothesis: '我愿意连续七天观察 AI 工具是否真的改变我的工作方式。',
      startedAt: at(1).toISOString(),
    });
    expect(state.status).toBe('active');
    expect(state.logs).toHaveLength(0);
    expect(experimentDay(state)).toBe(1);
    expect(canRecordToday(state, at(1)).ok).toBe(true);
  });

  it('requires a real observation and prevents two records on the same day', () => {
    const state = createExperiment({ title: '实验', hypothesis: '值得验证。' });
    expect(() =>
      recordExperimentLog(state, { interest: 3, energy: 3, evidence: '好' }, at(1)),
    ).toThrow(/至少 4 个字/);
    const after = recordExperimentLog(
      state,
      { interest: 4, energy: 3, evidence: '今天做了一个小原型。' },
      at(1),
    );
    expect(after.logs).toHaveLength(1);
    expect(canRecordToday(after, at(1)).ok).toBe(false);
    expect(() =>
      recordExperimentLog(
        after,
        { interest: 5, energy: 5, evidence: '重复记录不应该成功。' },
        at(1),
      ),
    ).toThrow(/今天已经记录/);
  });

  it('only completes after seven daily logs', () => {
    let state = createExperiment({ title: '实验', hypothesis: '值得验证。' });
    for (let day = 1; day <= 7; day += 1) {
      state = recordExperimentLog(
        state,
        {
          interest: 3 + (day % 2),
          energy: 4,
          evidence: `第 ${day} 天：一个具体的观察和证据。`,
          next: `第 ${day + 1} 天继续。`,
        },
        at(day),
      );
    }
    expect(state.logs).toHaveLength(7);
    expect(state.status).toBe('complete');
    expect(canRecordToday(state, at(8)).ok).toBe(false);
    expect(experimentSummary(state)).toMatchObject({
      days: 7,
      complete: true,
    });
    expect(experimentSummary(state).averageInterest).toBeGreaterThanOrEqual(3);
  });

  it('supports a missed calendar day without inventing a log', () => {
    const state = createExperiment({ title: '实验', hypothesis: '值得验证。' });
    const after = recordExperimentLog(
      state,
      { interest: 4, energy: 2, evidence: '今天只做了一个很小的尝试。' },
      at(1),
    );
    expect(canRecordToday(after, at(3)).ok).toBe(true);
    expect(experimentDay(after)).toBe(2);
  });

  it('supports a 3-day starter that can be extended later', () => {
    let state = createExperiment({
      title: '3 天试跑',
      hypothesis: '先看看这件事会不会自然发生。',
      targetDays: 3,
      startedAt: at(1).toISOString(),
    });
    expect(state.targetDays).toBe(3);
    for (let day = 1; day <= 3; day += 1) {
      state = recordExperimentLog(
        state,
        { interest: 4, energy: 3, evidence: `第 ${day} 天：一个真实发生的小证据。` },
        at(day),
      );
    }
    expect(state.status).toBe('complete');
    expect(canRecordToday(state, at(4)).reason).toContain('3 天');
    expect(experimentSummary(state).complete).toBe(true);
  });
});
