import type { InterestSeedGraph } from '../types/graph';
import type { SeedSprintDraft } from '../onboarding/seedSprint';
import { appendObservation } from '../core/observations';
import { STARTER_DAYS, createExperiment } from '../experiment/experiment';
import { edgeIdFor, nodeIdForUri } from '../utils/ids';

export function applySeedSprint(input: {
  draft: SeedSprintDraft;
  acceptedNodeIds: ReadonlySet<string>;
  acceptedEdgeIds: ReadonlySet<string>;
  getGraph: () => InterestSeedGraph;
  replaceGraph: (graph: InterestSeedGraph, message: string) => void;
  markSeedSprintCompleted: (now: string) => void;
  invalidateInsights: () => void;
  notifyStatus: () => void;
  saveSettings: () => void;
  persist: () => void;
}): number {
  const now = new Date().toISOString();
  const current = input.getGraph();
  const nodes = [...current.nodes];
  const edges = [...current.edges];
  const knownNodes = new Set(nodes.map((node) => node.id));
  const knownEdges = new Set(edges.map((edge) => edge.id));
  const idMap = new Map<string, string>();

  for (const proposal of input.draft.nodes) {
    if (!input.acceptedNodeIds.has(proposal.id)) continue;
    const id = nodeIdForUri(`interestseed://seed-sprint/${proposal.id}`);
    idMap.set(proposal.id, id);
    if (knownNodes.has(id)) continue;
    nodes.push({
      id,
      type: proposal.type,
      title: proposal.title,
      tags: [...proposal.tags],
      createdAt: now,
      updatedAt: now,
      metadata: {
        seedSprint: true,
        evidence: proposal.evidence,
        confidence: proposal.confidence,
        nextStep: proposal.nextStep === true,
        taskState: proposal.nextStep ? 'experimenting' : 'judged',
        taskStateUpdatedAt: now,
        observations: appendObservation(undefined, {
          source: 'seed-sprint',
          evidence: proposal.evidence,
          belief: 'changed',
        }),
        ...(proposal.nextStep
          ? {
              experimentDay: 0,
              experimentStartedAt: now,
              experimentStatus: 'active',
              experimentState: createExperiment({
                title: proposal.title,
                hypothesis: input.draft.experiment.hypothesis,
                metric: input.draft.experiment.metric,
                startedAt: now,
                targetDays: STARTER_DAYS,
              }),
            }
          : {}),
      },
    });
    knownNodes.add(id);
  }

  for (const proposal of input.draft.edges) {
    if (!input.acceptedEdgeIds.has(proposal.id)) continue;
    const source = idMap.get(proposal.source);
    const target = idMap.get(proposal.target);
    if (!source || !target) continue;
    const id = edgeIdFor(source, target, proposal.relation);
    if (knownEdges.has(id)) continue;
    edges.push({
      id,
      source,
      target,
      relation: proposal.relation,
      origin: 'ai',
      status: 'confirmed',
      confidence: proposal.confidence,
      evidence: [proposal.evidence],
      createdAt: now,
      updatedAt: now,
    });
    knownEdges.add(id);
  }

  const added = nodes.length - current.nodes.length;
  if (added === 0) return 0;
  input.replaceGraph(
    {
      ...current,
      schemaVersion: current.schemaVersion,
      updatedAt: now,
      nodes,
      edges,
    },
    '冷启动问卷：种下第一张星图',
  );
  input.markSeedSprintCompleted(now);
  input.saveSettings();
  input.invalidateInsights();
  input.notifyStatus();
  input.persist();
  return added;
}
