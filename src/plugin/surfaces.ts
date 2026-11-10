/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Copyright (C) 2026 aicoder
 */
import type { WorkspaceLeaf } from 'obsidian';

/** 只声明装配需要的最小能力，方便用假对象单测。 */
export interface SurfaceRegistry {
  registerView(type: string, factory: (leaf: WorkspaceLeaf) => unknown): void;
  addRibbonIcon(icon: string, title: string, callback: () => void): unknown;
}

export type SurfaceKey = 'graph' | 'ai' | 'agent';

export type SurfaceActions = Record<SurfaceKey, () => void>;

export interface SurfaceSpec {
  key: SurfaceKey;
  icon: string;
  title: string;
}

/**
 * 顺序固定：兴趣图谱 → AI 建议 → Agent。
 * 视图类型由调用方传入，避免这里在运行时 import 三个 UI 模块
 *（那会把整个 UI 拽进覆盖率统计范围）。
 */
export const SURFACES: readonly SurfaceSpec[] = [
  { key: 'graph', icon: 'sprout', title: '打开兴趣图谱' },
  { key: 'ai', icon: 'sparkles', title: '打开 InterestSeed AI 建议' },
  { key: 'agent', icon: 'bot', title: '打开 InterestSeed Agent' },
];

/**
 * 注册三个视图与三个 ribbon 入口。
 * 每个 ribbon 必须点到自己那个界面；这条约束由单元测试逐条断言。
 */
export function registerSurfaces(input: {
  registry: SurfaceRegistry;
  viewTypes: Record<SurfaceKey, string>;
  createView: (viewType: string, leaf: WorkspaceLeaf) => unknown;
  actions: SurfaceActions;
}): void {
  for (const surface of SURFACES) {
    const viewType = input.viewTypes[surface.key];
    input.registry.registerView(viewType, (leaf) => input.createView(viewType, leaf));
  }
  for (const surface of SURFACES) {
    const action = input.actions[surface.key];
    input.registry.addRibbonIcon(surface.icon, surface.title, () => action());
  }
}
