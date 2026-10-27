import { describe, expect, it } from 'vitest';

import { generateDiscoveries } from '../src/discovery/DiscoveryEngine';
import { hasDiscoveryContentChanged } from '../src/discovery/refresh';
import { emptyDiscoveryFile } from '../src/discovery/types';
import { qualityEdge, qualityFixture, qualityNode } from './discoveryQuality';

const NOW = '2026-01-01T00:00:00.000Z';
const LATER = '2026-01-02T00:00:00.000Z';

describe('Discovery refresh change detection', () => {
  it('same graph at a later time does not count as a content change', () => {
    const { graph } = qualityFixture();
    const first = generateDiscoveries(graph, emptyDiscoveryFile(NOW), () => NOW);
    const second = generateDiscoveries(graph, first, () => LATER);

    expect(second.updatedAt).toBe(LATER);
    expect(hasDiscoveryContentChanged(first, second)).toBe(false);
  });

  it('a changed graph with additional candidates counts as a content change', () => {
    const { graph } = qualityFixture();
    const first = generateDiscoveries(graph, emptyDiscoveryFile(NOW), () => NOW);
    const extra = {
      ...graph,
      nodes: [
        ...graph.nodes,
        qualityNode('b3', 'P2/b3.md', ['shared'], undefined, 'B3'),
      ],
      edges: [...graph.edges, qualityEdge('e-b1-b3', 'b1', 'b3')],
    };
    const second = generateDiscoveries(extra, first, () => LATER);

    expect(hasDiscoveryContentChanged(first, second)).toBe(true);
  });
});
