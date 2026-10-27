import type { Discovery } from './types';

/** 产品预填值，仅作为可编辑默认值，不代表事实或用户确认。 */
export const DEFAULT_DISCOVERY_RELATION = 'related-to';

export interface DiscoveryApplicationDefaults {
  sourceNodeId: string;
  targetNodeId: string;
  relation: string;
}

export function discoveryApplicationDefaults(
  discovery: Discovery,
): DiscoveryApplicationDefaults {
  return {
    sourceNodeId: discovery.nodeIds[0] ?? '',
    targetNodeId: discovery.nodeIds[1] ?? '',
    relation: DEFAULT_DISCOVERY_RELATION,
  };
}
