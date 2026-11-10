import { describe, expect, it, vi } from 'vitest';

const overviewOpen = vi.fn();
const explorerOpen = vi.fn();
let explorerOptions: Record<string, unknown> | undefined;
const viewShowTheme = vi.fn();

vi.mock('../../src/ui/DiscoveryOverviewModal', () => ({
  DiscoveryOverviewModal: class {
    constructor(_app: unknown, public overview: unknown) {}
    open() {
      overviewOpen(this);
    }
  },
}));

vi.mock('../../src/ui/DiscoveryExplorerModal', () => ({
  DiscoveryExplorerModal: class {
    constructor(
      _app: unknown,
      public data: unknown,
      public overview: unknown,
      public options: Record<string, unknown>,
    ) {
      explorerOptions = options;
    }
    open() {
      explorerOpen(this);
    }
  },
}));

vi.mock('../../src/ui/InterestSeedView', () => {
  class InterestSeedView {
    showDiscoveriesForTheme = viewShowTheme;
  }
  return { InterestSeedView, INTERESTSEED_VIEW_TYPE: 'interestseed-view' };
});

vi.mock('../../src/discovery/overview', () => ({
  buildDiscoveryOverview: vi.fn((state, graph) => ({ state, graph })),
}));

vi.mock('../../src/discovery/exploration', () => ({
  buildExploration: vi.fn(() => ({ explored: true })),
}));

import {
  openDiscoveryExplorer,
  openDiscoveryOverview,
  showDiscoveriesForTheme,
} from '../../src/plugin/discoveryUI';
import { InterestSeedView } from '../../src/ui/InterestSeedView';

describe('discoveryUI', () => {
  it('opens the discovery overview', () => {
    openDiscoveryOverview({} as never, { theme: 'x' } as never, { nodes: [] } as never);
    expect(overviewOpen).toHaveBeenCalledTimes(1);
  });

  it('opens the discovery explorer with callbacks', () => {
    const onThemeSelect = vi.fn();
    const onGenerateAi = vi.fn(async () => ({}) as never);
    openDiscoveryExplorer({
      app: {} as never,
      file: { theme: 'x' } as never,
      graph: { nodes: [] } as never,
      aiAvailable: true,
      aiUnavailableReason: undefined,
      onThemeSelect,
      onGenerateAi,
    });
    expect(explorerOpen).toHaveBeenCalledTimes(1);
    expect(explorerOptions?.aiAvailable).toBe(true);
    (explorerOptions?.onThemeSelect as (theme: string) => void)('x');
    expect(onThemeSelect).toHaveBeenCalledWith('x');
  });

  it('shows a theme on the graph view', async () => {
    const view = new InterestSeedView();
    await showDiscoveriesForTheme({
      app: {
        workspace: { getLeavesOfType: () => [{ view }] },
      } as never,
      theme: '测试主题',
      activateView: vi.fn(async () => undefined),
    });
    expect(viewShowTheme).toHaveBeenCalledWith('测试主题');
  });
});
