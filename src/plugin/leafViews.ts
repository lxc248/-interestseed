import { type App, type WorkspaceLeaf } from 'obsidian';
import { INTERESTSEED_AGENT_VIEW_TYPE } from '../ui/AgentView';
import { AiSuggestionView, INTERESTSEED_AI_VIEW_TYPE } from '../ui/AiSuggestionView';

export async function activateGraphView(app: App, viewType: string): Promise<void> {
  const { workspace } = app;
  const existing = workspace.getLeavesOfType(viewType);
  let leaf: WorkspaceLeaf | null = existing[0] ?? null;
  if (!leaf) {
    const active = (workspace as unknown as { activeLeaf?: WorkspaceLeaf }).activeLeaf;
    leaf = active ?? workspace.getLeaf('tab');
  }
  await leaf.setViewState({ type: viewType, active: true });
  await workspace.revealLeaf(leaf);
}

export async function activateAgentView(app: App): Promise<void> {
  const { workspace } = app;
  const existing = workspace.getLeavesOfType(INTERESTSEED_AGENT_VIEW_TYPE);
  let leaf: WorkspaceLeaf | null = existing[0] ?? null;
  if (!leaf) {
    const active = (workspace as unknown as { activeLeaf?: WorkspaceLeaf }).activeLeaf;
    leaf = active ?? workspace.getLeaf('tab');
  }
  await leaf.setViewState({ type: INTERESTSEED_AGENT_VIEW_TYPE, active: true });
  await workspace.revealLeaf(leaf);
}

export async function activateAiView(app: App): Promise<AiSuggestionView | null> {
  const { workspace } = app;
  const existing = workspace.getLeavesOfType(INTERESTSEED_AI_VIEW_TYPE);
  let leaf: WorkspaceLeaf | null = existing[0] ?? null;
  if (!leaf) leaf = workspace.getRightLeaf(false);
  if (!leaf) leaf = workspace.getLeaf('tab');
  await leaf.setViewState({ type: INTERESTSEED_AI_VIEW_TYPE, active: true });
  await workspace.revealLeaf(leaf);
  return leaf.view instanceof AiSuggestionView ? leaf.view : null;
}
