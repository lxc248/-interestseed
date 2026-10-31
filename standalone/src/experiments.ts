import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  createExperiment,
  experimentDay,
  experimentSummary,
  recordExperimentLog,
  type ExperimentInput,
  type ExperimentState,
} from '../../src/experiment/experiment';
import { ensureStateDir, stateDir } from './state';

export interface StoredExperiment {
  id: string;
  nodeId?: string;
  state: ExperimentState;
}

interface ExperimentFile {
  schemaVersion: 1;
  experiments: StoredExperiment[];
}

const FILE = 'experiments.json';

function filePath(vaultPath: string): string {
  return join(stateDir(vaultPath), FILE);
}

async function loadFile(vaultPath: string): Promise<ExperimentFile> {
  const path = filePath(vaultPath);
  if (!existsSync(path)) return { schemaVersion: 1, experiments: [] };
  const raw = (await readFile(path, 'utf8')).replace(/^\uFEFF/, '');
  const parsed = JSON.parse(raw) as Partial<ExperimentFile>;
  return {
    schemaVersion: 1,
    experiments: Array.isArray(parsed.experiments) ? parsed.experiments : [],
  };
}

async function saveFile(vaultPath: string, file: ExperimentFile): Promise<void> {
  await ensureStateDir(vaultPath);
  const { writeFile, rename } = await import('node:fs/promises');
  const path = filePath(vaultPath);
  const temp = `${path}.tmp`;
  await writeFile(temp, `${JSON.stringify(file, null, 2)}\n`, 'utf8');
  await rename(temp, path);
}

export async function listExperiments(vaultPath: string): Promise<StoredExperiment[]> {
  return (await loadFile(vaultPath)).experiments;
}

export async function activeExperiment(vaultPath: string): Promise<StoredExperiment | null> {
  const experiments = await listExperiments(vaultPath);
  return experiments.find((item) => item.state.status === 'active') ?? null;
}

export async function startExperiment(
  vaultPath: string,
  input: { title: string; hypothesis?: string; nodeId?: string; targetDays?: number },
): Promise<StoredExperiment> {
  const file = await loadFile(vaultPath);
  const title = input.title.trim();
  if (!title) throw new Error('Experiment title is required.');
  const state = createExperiment({
    title,
    hypothesis:
      input.hypothesis?.trim() ||
      `我愿意连续 ${input.targetDays ?? 3} 天为「${title}」做一次真实行动。`,
    targetDays: input.targetDays ?? 3,
  });
  const experiment: StoredExperiment = {
    id: `exp_${randomUUID().slice(0, 8)}`,
    ...(input.nodeId ? { nodeId: input.nodeId } : {}),
    state,
  };
  file.experiments.unshift(experiment);
  await saveFile(vaultPath, file);
  return experiment;
}

export async function logExperiment(
  vaultPath: string,
  id: string,
  input: ExperimentInput,
  now = new Date(),
): Promise<StoredExperiment> {
  const file = await loadFile(vaultPath);
  const index = file.experiments.findIndex((item) => item.id === id);
  if (index < 0) throw new Error('Experiment not found.');
  const current = file.experiments[index]!;
  const next = recordExperimentLog(current.state, input, now);
  const experiment: StoredExperiment = { ...current, state: next };
  file.experiments[index] = experiment;
  await saveFile(vaultPath, file);
  return experiment;
}

export async function extendExperiment(
  vaultPath: string,
  id: string,
  targetDays: number,
): Promise<StoredExperiment> {
  const file = await loadFile(vaultPath);
  const index = file.experiments.findIndex((item) => item.id === id);
  if (index < 0) throw new Error('Experiment not found.');
  const current = file.experiments[index]!;
  if (current.state.status === 'complete') throw new Error('这个实验已经完成。');
  const days = Math.min(30, Math.max(3, Math.round(targetDays)));
  const state: ExperimentState = {
    ...current.state,
    targetDays: Math.max(current.state.targetDays, days),
  };
  const experiment: StoredExperiment = { ...current, state };
  file.experiments[index] = experiment;
  await saveFile(vaultPath, file);
  return experiment;
}

export function experimentView(experiment: StoredExperiment): Record<string, unknown> {
  return {
    id: experiment.id,
    ...(experiment.nodeId ? { nodeId: experiment.nodeId } : {}),
    title: experiment.state.title,
    hypothesis: experiment.state.hypothesis,
    metric: experiment.state.metric,
    status: experiment.state.status,
    day: experimentDay(experiment.state),
    targetDays: experiment.state.targetDays,
    logs: experiment.state.logs,
    summary: experimentSummary(experiment.state),
  };
}
