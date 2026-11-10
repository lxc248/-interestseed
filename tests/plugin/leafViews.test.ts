import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/ui/AiSuggestionView', () => {
  class AiSuggestionView {}
  return { AiSuggestionView, INTERESTSEED_AI_VIEW_TYPE: 'ai-view' };
});
vi.mock('../../src/ui/AgentView', () => ({
  INTERESTSEED_AGENT_VIEW_TYPE: 'agent-view',
}));

import {
  activateAgentView,
  activateAiView,
  activateGraphView,
} from '../../src/plugin/leafViews';
import { AiSuggestionView } from '../../src/ui/AiSuggestionView';

function makeWorkspace() {
  const leaf = {
    view: new AiSuggestionView({} as never, {} as never),
    setViewState: vi.fn(async () => undefined),
  };
  const workspace = {
    getLeavesOfType: vi.fn(() => []),
    getLeaf: vi.fn(() => leaf),
    getRightLeaf: vi.fn(() => null),
    revealLeaf: vi.fn(async () => undefined),
    activeLeaf: leaf,
  };
  return { app: { workspace } as never, workspace, leaf };
}

describe('leafViews', () => {
  it('activates the graph view leaf', async () => {
    const { app, leaf, workspace } = makeWorkspace();
    await activateGraphView(app, 'graph-view');
    expect(leaf.setViewState).toHaveBeenCalledWith({ type: 'graph-view', active: true });
    expect(workspace.revealLeaf).toHaveBeenCalled();
  });

  it('reuses an existing graph view leaf', async () => {
    const { app, leaf, workspace } = makeWorkspace();
    workspace.getLeavesOfType = vi.fn(() => [leaf]);
    await activateGraphView(app, 'graph-view');
    expect(leaf.setViewState).toHaveBeenCalledWith({ type: 'graph-view', active: true });
    expect(workspace.revealLeaf).toHaveBeenCalledWith(leaf);
  });

  it('activates the agent view leaf', async () => {
    const { app, leaf } = makeWorkspace();
    await activateAgentView(app);
    expect(leaf.setViewState).toHaveBeenCalledWith({ type: 'agent-view', active: true });
  });

  it('returns the AI view instance', async () => {
    const { app, leaf } = makeWorkspace();
    await expect(activateAiView(app)).resolves.toBe(leaf.view);
    expect(leaf.setViewState).toHaveBeenCalledWith({ type: 'ai-view', active: true });
  });
});
