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
  /** 需要本地进程的入口：移动端不注册 ribbon，避免用户点了才看到报错。 */
  desktopOnly?: boolean;
}

/**
 * 顺序固定：兴趣图谱 → AI 建议 → Agent。
 * 视图类型由调用方传入，避免这里在运行时 import 三个 UI 模块
 *（那会把整个 UI 拽进覆盖率统计范围）。
 */
export const SURFACES: readonly SurfaceSpec[] = [
  { key: 'graph', icon: 'sprout', title: '打开兴趣图谱' },
  { key: 'ai', icon: 'sparkles', title: '打开 InterestSeed AI 建议' },
  { key: 'agent', icon: 'bot', title: '打开 InterestSeed Agent', desktopOnly: true },
];

/**
 * 注册视图与 ribbon 入口。
 * - 所有视图都注册：命令面板里的入口仍然存在，由宿主给出友好提示。
 * - 仅 ribbon 会按平台裁剪：移动端不暴露 Agent 按钮。
 */
export function registerSurfaces(input: {
  registry: SurfaceRegistry;
  viewTypes: Record<SurfaceKey, string>;
  createView: (viewType: string, leaf: WorkspaceLeaf) => unknown;
  actions: SurfaceActions;
  isDesktop?: boolean;
}): void {
  const isDesktop = input.isDesktop ?? true;

  for (const surface of SURFACES) {
    const viewType = input.viewTypes[surface.key];
    input.registry.registerView(viewType, (leaf) => input.createView(viewType, leaf));
  }

  for (const surface of SURFACES) {
    if (surface.desktopOnly && !isDesktop) continue;
    const action = input.actions[surface.key];
    input.registry.addRibbonIcon(surface.icon, surface.title, () => action());
  }
}
