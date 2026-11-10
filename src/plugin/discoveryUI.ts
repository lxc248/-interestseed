import type { App } from 'obsidian';

import { buildDiscoveryOverview } from '../discovery/overview';
import { buildExploration } from '../discovery/exploration';
import { DiscoveryOverviewModal } from '../ui/DiscoveryOverviewModal';
import { DiscoveryExplorerModal } from '../ui/DiscoveryExplorerModal';
import { INTERESTSEED_VIEW_TYPE, InterestSeedView } from '../ui/InterestSeedView';
import type {
  ExplorationInsight,
  ExplorationRequest,
} from '../services/ModelProvider';

type OverviewState = Parameters<typeof buildDiscoveryOverview>[0];
type OverviewGraph = Parameters<typeof buildDiscoveryOverview>[1];

export function openDiscoveryOverview(
  app: App,
  state: OverviewState,
  graph: OverviewGraph,
): void {
  const overview = buildDiscoveryOverview(state, graph);
  new DiscoveryOverviewModal(app, overview).open();
}

export function openDiscoveryExplorer(input: {
  app: App;
  file: OverviewState;
  graph: OverviewGraph;
  aiAvailable: boolean;
  aiUnavailableReason: string | undefined;
  onThemeSelect: (theme: string) => void;
  onGenerateAi: (request: ExplorationRequest) => Promise<ExplorationInsight>;
}): void {
  const overview = buildDiscoveryOverview(input.file, input.graph);
  const data = buildExploration(input.file);
  new DiscoveryExplorerModal(input.app, data, overview, {
    onThemeSelect: input.onThemeSelect,
    aiAvailable: input.aiAvailable,
    aiUnavailableReason: input.aiUnavailableReason,
    onGenerateAi: input.onGenerateAi,
  }).open();
}

export async function showDiscoveriesForTheme(input: {
  app: App;
  theme: string;
  activateView: () => Promise<void>;
}): Promise<void> {
  await input.activateView();
  const leaf = input.app.workspace.getLeavesOfType(INTERESTSEED_VIEW_TYPE)[0];
  const view = leaf?.view;
  if (view instanceof InterestSeedView) view.showDiscoveriesForTheme(input.theme);
}
