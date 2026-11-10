/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Copyright (C) 2026 aicoder
 */
import { Notice } from 'obsidian';

import { DiscoveryEngine } from '../discovery/DiscoveryEngine';
import { applyDiscoveryFeedback, undoDiscoveryFeedback } from '../discovery/feedback';
import { hasDiscoveryContentChanged } from '../discovery/refresh';
import type {
  DiscoveryCorrection,
  DiscoveryFeedbackAction,
  DiscoveryFile,
} from '../discovery/types';
import type { InterestSeedGraph } from '../types/graph';

type Enqueue = (mutator: (state: DiscoveryFile) => DiscoveryFile) => Promise<unknown>;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function reconcileDiscoveries(input: {
  reconcile: () => Promise<void>;
  refresh: () => Promise<void>;
}): Promise<void> {
  await input.reconcile();
  await input.refresh();
  new Notice('InterestSeed：发现应用状态已按当前图谱核对。');
}

export async function refreshDiscoveries(input: {
  blockedReason: string | null;
  getGraph: () => InterestSeedGraph;
  enqueue: Enqueue;
}): Promise<void> {
  if (input.blockedReason) {
    new Notice(`InterestSeed：${input.blockedReason}`, 8000);
    return;
  }
  try {
    await input.enqueue((state) => {
      // 在队列任务内部基于最新状态重算，避免反馈/其他保存刚写入后被旧快照覆盖。
      const next = new DiscoveryEngine().generate(input.getGraph(), state);
      return hasDiscoveryContentChanged(state, next) ? next : state;
    });
  } catch (error) {
    new Notice(`InterestSeed：发现数据保存失败——${errorMessage(error)}`, 10_000);
  }
}

export async function setDiscoveryFeedback(input: {
  blockedReason: string | null;
  getState: () => DiscoveryFile;
  enqueue: Enqueue;
  id: string;
  action: DiscoveryFeedbackAction;
  correction?: DiscoveryCorrection;
}): Promise<void> {
  if (input.blockedReason) {
    new Notice(`InterestSeed：${input.blockedReason}`, 8000);
    return;
  }
  const discovery = input.getState().discoveries.find((item) => item.id === input.id);
  if (!discovery) {
    new Notice('这条发现已不存在，无法操作。');
    return;
  }
  try {
    await input.enqueue((state) =>
      applyDiscoveryFeedback(state, input.id, input.action, undefined, input.correction),
    );
  } catch (error) {
    new Notice(`InterestSeed：反馈保存失败——${errorMessage(error)}`, 10_000);
  }
}

export async function undoDiscoveryFeedbackById(input: {
  blockedReason: string | null;
  enqueue: Enqueue;
  id: string;
}): Promise<void> {
  if (input.blockedReason) {
    new Notice(`InterestSeed：${input.blockedReason}`, 8000);
    return;
  }
  try {
    await input.enqueue((state) => undoDiscoveryFeedback(state, input.id));
  } catch (error) {
    new Notice(`InterestSeed：撤销反馈失败——${errorMessage(error)}`, 10_000);
  }
}
