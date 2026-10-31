import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { activeExperiment, logExperiment, startExperiment } from '../standalone/src/experiments';

const dirs: string[] = [];

async function vault(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'interestseed-exp-'));
  dirs.push(dir);
  return dir;
}

afterEach(async () => {
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
});

describe('standalone experiments', () => {
  it('starts a 3-day experiment and records one real observation per day', async () => {
    const root = await vault();
    const experiment = await startExperiment(root, {
      title: 'AI 工具 × 习惯',
      hypothesis: '我愿意连续三天用 AI 记录一次行动。',
      targetDays: 3,
    });
    expect(experiment.state.targetDays).toBe(3);
    expect(experiment.state.logs).toHaveLength(0);

    const first = await logExperiment(
      root,
      experiment.id,
      { interest: 4, energy: 4, evidence: '今天用 AI 整理了三条笔记。' },
      new Date('2026-01-01T10:00:00Z'),
    );
    expect(first.state.logs).toHaveLength(1);
    expect(first.state.logs[0]?.evidence).toContain('三条笔记');

    await expect(
      logExperiment(
        root,
        experiment.id,
        { interest: 3, energy: 3, evidence: '同一天再写一条。' },
        new Date('2026-01-01T12:00:00Z'),
      ),
    ).rejects.toThrow('今天已经记录过了');

    expect((await activeExperiment(root))?.id).toBe(experiment.id);
  });

  it('refuses evidence shorter than four characters', async () => {
    const root = await vault();
    const experiment = await startExperiment(root, { title: '写作' });
    await expect(
      logExperiment(
        root,
        experiment.id,
        { interest: 3, energy: 3, evidence: '短' },
        new Date('2026-01-02T10:00:00Z'),
      ),
    ).rejects.toThrow('至少 4 个字');
  });
});
