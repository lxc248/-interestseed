/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Copyright (C) 2026 aicoder
 */
import { describe, expect, it, vi } from 'vitest';

import { SURFACES, registerSurfaces, type SurfaceRegistry, type SurfaceKey } from '../../src/plugin/surfaces';

const VIEW_TYPES: Record<SurfaceKey, string> = {
  graph: 'interestseed-view',
  ai: 'interestseed-ai-view',
  agent: 'interestseed-agent-view',
};

type ViewFactory = Parameters<SurfaceRegistry['registerView']>[1];

function makeRegistry() {
  const views: Array<{ type: string; factory: ViewFactory }> = [];
  const ribbons: Array<{ icon: string; title: string; run: () => void }> = [];
  const registry: SurfaceRegistry = {
    registerView: (type, factory) => {
      views.push({ type, factory });
    },
    addRibbonIcon: (icon, title, callback) => {
      ribbons.push({ icon, title, run: callback });
      return undefined;
    },
  };
  return { registry, views, ribbons };
}

describe('surfaces', () => {
  it('declares graph, ai and agent in that order', () => {
    expect(SURFACES.map((surface) => surface.key)).toEqual(['graph', 'ai', 'agent']);
    expect(SURFACES.map((surface) => surface.icon)).toEqual(['sprout', 'sparkles', 'bot']);
  });

  it('registers one view per surface using the same view types', () => {
    const { registry, views } = makeRegistry();
    registerSurfaces({ registry, viewTypes: VIEW_TYPES, createView: () => ({}), actions: {
      graph: vi.fn(),
      ai: vi.fn(),
      agent: vi.fn(),
    } });
    expect(views.map((view) => view.type)).toEqual(SURFACES.map((surface) => VIEW_TYPES[surface.key]));
  });

  it('passes the registered view type back into createView', () => {
    const { registry, views } = makeRegistry();
    const createView = vi.fn(() => ({}));
    registerSurfaces({ registry, viewTypes: VIEW_TYPES, createView, actions: {
      graph: vi.fn(),
      ai: vi.fn(),
      agent: vi.fn(),
    } });
    const leaf = { id: 'leaf' } as never;
    views[1]?.factory(leaf);
    expect(createView).toHaveBeenCalledWith(VIEW_TYPES[SURFACES[1]?.key as SurfaceKey], leaf);
  });

  it('wires each ribbon to its own action', () => {
    const { registry, ribbons } = makeRegistry();
    const actions = { graph: vi.fn(), ai: vi.fn(), agent: vi.fn() };
    registerSurfaces({ registry, viewTypes: VIEW_TYPES, createView: () => ({}), actions });

    expect(ribbons.map((ribbon) => ribbon.title)).toEqual([
      '打开兴趣图谱',
      '打开 InterestSeed AI 建议',
      '打开 InterestSeed Agent',
    ]);

    for (const ribbon of ribbons) ribbon.run();

    expect(actions.graph).toHaveBeenCalledTimes(1);
    expect(actions.ai).toHaveBeenCalledTimes(1);
    expect(actions.agent).toHaveBeenCalledTimes(1);
  });

  it('does not cross-wire the agent ribbon to the ai action', () => {
    const { registry, ribbons } = makeRegistry();
    const actions = { graph: vi.fn(), ai: vi.fn(), agent: vi.fn() };
    registerSurfaces({ registry, viewTypes: VIEW_TYPES, createView: () => ({}), actions });

    const agentRibbon = ribbons.find((ribbon) => ribbon.title.includes('Agent'));
    expect(agentRibbon).toBeDefined();
    agentRibbon?.run();

    expect(actions.agent).toHaveBeenCalledTimes(1);
    expect(actions.ai).not.toHaveBeenCalled();
    expect(actions.graph).not.toHaveBeenCalled();
  });

  it('keeps ribbon labels unique', () => {
    const titles = SURFACES.map((surface) => surface.title);
    expect(new Set(titles).size).toBe(titles.length);
  });
});
