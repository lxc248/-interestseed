import { InterestSeedGraphBuilder } from '../../src/core/GraphBuilder';
import type { InterestSeedGraph } from '../../src/types/graph';
import { loadConfig, loadState, saveGraph } from './state';
import { scanVault } from './vault';

export interface BuildResult {
  graph: InterestSeedGraph;
  files: number;
  skipped: number;
  warnings: string[];
  unresolvedLinks: string[];
}

export async function scanAndBuild(vaultPath: string): Promise<BuildResult> {
  const config = await loadConfig(vaultPath);
  const state = await loadState(vaultPath);
  const scan = await scanVault(vaultPath, config);
  const builder = new InterestSeedGraphBuilder(() => state.graph);
  builder.configure({ enableRuleSuggestions: true });
  const result = builder.buildWithReport(scan.nodes, {
    includeFolders: config.includeFolders,
    includeTags: config.includeTags,
    includeOutgoingLinks: true,
  });
  await saveGraph(vaultPath, result.graph);
  return {
    graph: result.graph,
    files: scan.files,
    skipped: scan.skipped,
    warnings: result.report.warnings,
    unresolvedLinks: result.report.unresolvedLinks,
  };
}
