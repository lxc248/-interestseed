/**
 * 7-day interest experiment.
 *
 * This is deliberately stricter than a streak counter:
 * - one check-in per calendar day;
 * - every check-in needs a concrete observation;
 * - interest and energy are captured on a 1–5 scale;
 * - the experiment cannot skip to day 7 by clicking a button;
 * - completion requires seven valid logs.
 */

export const EXPERIMENT_DAYS = 7;
export const STARTER_DAYS = 3;

export interface ExperimentLog {
  day: number;
  date: string;
  recordedAt: string;
  interest: number;
  energy: number;
  evidence: string;
  next?: string;
}

export interface ExperimentState {
  title: string;
  hypothesis: string;
  metric: string;
  startedAt: string;
  targetDays: number;
  status: 'active' | 'complete';
  logs: ExperimentLog[];
}

export interface ExperimentInput {
  interest: number;
  energy: number;
  evidence: string;
  next?: string;
}

export type QuickCheckInKind = 'did' | 'thought' | 'missed';

export const QUICK_CHECK_INS: Record<
  QuickCheckInKind,
  { interest: number; energy: number; evidence: string; notice: string }
> = {
  did: {
    interest: 4,
    energy: 4,
    evidence: '今天实际做了一件和这个兴趣有关的事。',
    notice: '已记录：今天做了。',
  },
  thought: {
    interest: 3,
    energy: 2,
    evidence: '今天没有行动，但想起过这个兴趣。',
    notice: '已记录：只想过。',
  },
  missed: {
    interest: 2,
    energy: 1,
    evidence: '今天没有做，也没有特别想起这个兴趣。',
    notice: '已记录：今天没做。',
  },
};

function localDate(now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function clampTarget(value: unknown): number {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return EXPERIMENT_DAYS;
  return Math.min(30, Math.max(1, Math.round(number)));
}

function clampScore(value: unknown): number {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(5, Math.max(1, Math.round(number)));
}

export function createExperiment(input: {
  title: string;
  hypothesis: string;
  metric?: string;
  startedAt?: string;
  targetDays?: number;
}): ExperimentState {
  return {
    title: input.title.trim() || '7 天兴趣实验',
    hypothesis: input.hypothesis.trim() || '这个兴趣值得我投入一周的真实注意力。',
    metric: input.metric?.trim() || '每天记录一次兴趣强度（1–5）与一个具体证据。',
    startedAt: input.startedAt ?? new Date().toISOString(),
    targetDays: clampTarget(input.targetDays),
    status: 'active',
    logs: [],
  };
}

/** Import old `experimentDay` metadata without inventing fake evidence. */
export function parseExperiment(
  metadata: Record<string, unknown> | undefined,
  fallbackTitle = '7 天兴趣实验',
): ExperimentState | null {
  if (!metadata?.nextStep && !metadata?.experimentState) return null;
  const raw = metadata.experimentState;
  if (raw && typeof raw === 'object') {
    const state = raw as Partial<ExperimentState>;
    const logs = Array.isArray(state.logs)
      ? state.logs
          .filter((log): log is ExperimentLog => Boolean(log && typeof log === 'object'))
          .map((log) => ({
            day: Number(log.day) || 1,
            date: String(log.date ?? ''),
            recordedAt: String(log.recordedAt ?? ''),
            interest: clampScore(log.interest),
            energy: clampScore(log.energy),
            evidence: String(log.evidence ?? ''),
            ...(log.next ? { next: String(log.next) } : {}),
          }))
          .slice(0, clampTarget(state.targetDays))
      : [];
    const targetDays = clampTarget(state.targetDays);
    return {
      title: String(state.title ?? fallbackTitle),
      hypothesis: String(state.hypothesis ?? '这个兴趣值得我投入一周的真实注意力。'),
      metric: String(state.metric ?? '每天记录一次兴趣强度（1–5）与一个具体证据。'),
      startedAt: String(state.startedAt ?? metadata.experimentStartedAt ?? ''),
      targetDays,
      status: logs.length >= targetDays ? 'complete' : 'active',
      logs,
    };
  }
  return {
    title: fallbackTitle,
    hypothesis: String(metadata.experimentHypothesis ?? '这个兴趣值得我投入一周的真实注意力。'),
    metric: String(metadata.experimentMetric ?? '每天记录一次兴趣强度（1–5）与一个具体证据。'),
    startedAt: String(metadata.experimentStartedAt ?? ''),
    targetDays: EXPERIMENT_DAYS,
    status: 'active',
    logs: [],
  };
}

export function experimentDay(state: ExperimentState): number {
  return Math.min(state.targetDays, state.logs.length + 1);
}

export function canRecordToday(
  state: ExperimentState,
  now = new Date(),
): { ok: boolean; reason?: string; day: number } {
  if (state.status === 'complete' || state.logs.length >= state.targetDays) {
    return {
      ok: false,
      reason: state.targetDays === STARTER_DAYS ? '3 天试跑已经完成。' : '7 天实验已经完成。',
      day: state.targetDays,
    };
  }
  const today = localDate(now);
  if (state.logs.some((log) => log.date === today)) {
    return { ok: false, reason: '今天已经记录过了，明天再来。', day: experimentDay(state) };
  }
  return { ok: true, day: experimentDay(state) };
}

export function recordExperimentLog(
  state: ExperimentState,
  input: ExperimentInput,
  now = new Date(),
): ExperimentState {
  const gate = canRecordToday(state, now);
  if (!gate.ok) throw new Error(gate.reason ?? '今天不能记录。');
  const evidence = input.evidence.trim();
  if (evidence.length < 4) {
    throw new Error('写下至少 4 个字的真实观察，才算一条实验记录。');
  }
  const log: ExperimentLog = {
    day: gate.day,
    date: localDate(now),
    recordedAt: now.toISOString(),
    interest: clampScore(input.interest),
    energy: clampScore(input.energy),
    evidence,
    ...(input.next?.trim() ? { next: input.next.trim() } : {}),
  };
  const logs = [...state.logs, log];
  return {
    ...state,
    logs,
    status: logs.length >= state.targetDays ? 'complete' : 'active',
  };
}

export function experimentSummary(state: ExperimentState): {
  averageInterest: number;
  averageEnergy: number;
  days: number;
  complete: boolean;
} {
  const days = state.logs.length;
  const average = (key: 'interest' | 'energy') =>
    days === 0
      ? 0
      : Math.round((state.logs.reduce((sum, log) => sum + log[key], 0) / days) * 10) / 10;
  return {
    averageInterest: average('interest'),
    averageEnergy: average('energy'),
    days,
    complete: days >= state.targetDays,
  };
}
