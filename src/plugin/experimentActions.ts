import { Notice } from 'obsidian';
import type { GraphSession } from '../core/GraphSession';
import type { InterestSeedNode } from '../types/graph';
import { appendObservation } from '../core/observations';
import {
  QUICK_CHECK_INS,
  STARTER_DAYS,
  canRecordToday,
  createExperiment,
  experimentSummary,
  parseExperiment,
  recordExperimentLog,
  type ExperimentInput,
  type ExperimentState,
  type QuickCheckInKind,
} from '../experiment/experiment';

export interface ActiveExperimentSnapshot {
  node: InterestSeedNode;
  state: ExperimentState;
  day: number;
  gate: ReturnType<typeof canRecordToday>;
  summary: ReturnType<typeof experimentSummary>;
}

interface ExperimentActions {
  updateNode: (nodeId: string, patch: Parameters<GraphSession['updateNode']>[1], message: string) => void;
  invalidateInsights: () => void;
  notifyStatus: () => void;
  persist: () => void;
}

export function getActiveExperiment(input: {
  listNodes: () => InterestSeedNode[];
}): ActiveExperimentSnapshot | null {
  const node = input.listNodes().find((candidate) => candidate.metadata?.nextStep === true);
  if (!node) return null;
  const state =
    parseExperiment(node.metadata, node.title) ??
    createExperiment({ title: node.title, hypothesis: '这个兴趣值得我投入一周的真实注意力。' });
  return {
    node,
    state,
    day: Math.min(state.targetDays, state.logs.length + 1),
    gate: canRecordToday(state),
    summary: experimentSummary(state),
  };
}

export function recordExperimentCheckIn(
  actions: ExperimentActions,
  active: ActiveExperimentSnapshot | null,
  input: ExperimentInput,
): boolean {
  if (!active) {
    new Notice('没有进行中的兴趣实验。');
    return false;
  }
  try {
    const state = recordExperimentLog(active.state, input);
    const now = new Date().toISOString();
    actions.updateNode(
      active.node.id,
      {
        metadata: {
          ...active.node.metadata,
          experimentState: state,
          experimentDay: state.logs.length,
          experimentStatus: state.status,
          experimentLastCheckInAt: now,
          taskState: state.status === 'complete' ? 'reviewed' : 'experimenting',
          taskStateUpdatedAt: now,
          observations: appendObservation(active.node.metadata, {
            source: 'experiment',
            evidence: input.evidence,
            belief: input.interest >= 4 ? 'stronger' : input.interest <= 2 ? 'weaker' : 'changed',
          }),
        },
      },
      `兴趣实验：记录第 ${state.logs.length} 天`,
    );
    actions.invalidateInsights();
    actions.notifyStatus();
    actions.persist();
    new Notice(
      state.status === 'complete'
        ? `${state.targetDays} 天实验完成。现在可以回看你的兴趣曲线。`
        : `第 ${state.logs.length} 天已记录。明天再来。`,
    );
    return true;
  } catch (error) {
    new Notice(error instanceof Error ? error.message : '实验记录失败。');
    return false;
  }
}

export function recordQuickExperiment(
  actions: ExperimentActions,
  active: ActiveExperimentSnapshot | null,
  kind: QuickCheckInKind,
): boolean {
  const preset = QUICK_CHECK_INS[kind];
  return recordExperimentCheckIn(actions, active, {
    interest: preset.interest,
    energy: preset.energy,
    evidence: preset.evidence,
  });
}

export function startStarterExperiment(
  actions: ExperimentActions,
  active: ActiveExperimentSnapshot | null,
): boolean {
  if (!active) {
    new Notice('还没有进行中的实验。');
    return false;
  }
  if (active.state.logs.length > 0 || active.state.status === 'complete') {
    new Notice('已经有记录，不能再切换成 3 天试跑。');
    return false;
  }
  const state: ExperimentState = {
    ...active.state,
    title: '3 天兴趣试跑',
    targetDays: STARTER_DAYS,
    hypothesis: active.state.hypothesis.replace('7 天', '3 天').replace('一周', '三天'),
    metric: '先做 3 天：每天记录一次兴趣强度、精力值和一个具体证据；3 条有效记录即完成。',
  };
  actions.updateNode(
    active.node.id,
    {
      title: state.title,
      metadata: {
        ...active.node.metadata,
        experimentState: state,
        experimentStatus: state.status,
        taskState: 'experimenting',
        taskStateUpdatedAt: new Date().toISOString(),
      },
    },
    '开始 3 天兴趣试跑',
  );
  actions.invalidateInsights();
  actions.notifyStatus();
  actions.persist();
  new Notice('已切换为 3 天试跑。先看它能不能自然发生。');
  return true;
}

export function extendExperimentToSeven(
  actions: ExperimentActions,
  active: ActiveExperimentSnapshot | null,
): boolean {
  if (!active || active.state.targetDays !== STARTER_DAYS) return false;
  if (active.state.logs.length < STARTER_DAYS) {
    new Notice('先完成 3 天试跑，再决定是否延长。');
    return false;
  }
  const state: ExperimentState = {
    ...active.state,
    title: '7 天兴趣实验',
    targetDays: 7,
    status: 'active',
    metric: '继续 4 天：每天记录一次兴趣强度、精力值和一个具体证据；7 条有效记录才完成。',
  };
  actions.updateNode(
    active.node.id,
    {
      title: state.title,
      metadata: {
        ...active.node.metadata,
        experimentState: state,
        experimentStatus: state.status,
        taskState: 'experimenting',
        taskStateUpdatedAt: new Date().toISOString(),
      },
    },
    '把 3 天试跑延长为 7 天实验',
  );
  actions.invalidateInsights();
  actions.notifyStatus();
  actions.persist();
  new Notice('已延长为 7 天实验。接下来 4 天继续记录。');
  return true;
}
