import { describe, expect, it } from 'vitest';

import { generateDiscoveries } from '../src/discovery/DiscoveryEngine';
import { emptyDiscoveryFile } from '../src/discovery/types';
import { qualityEdge, qualityGraph, qualityNode } from './discoveryQuality';

const NOW = '2026-01-01T00:00:00.000Z';

function performanceGraph(perGroup: number) {
  const p1 = Array.from({ length: perGroup }, (_, index) =>
    qualityNode(
      `a${index}`,
      `P1/a${index}.md`,
      ['perf'],
      undefined,
      `A${index}`,
    ),
  );
  const p2 = Array.from({ length: perGroup }, (_, index) =>
    qualityNode(
      `b${index}`,
      `P2/b${index}.md`,
      ['perf'],
      undefined,
      `B${index}`,
    ),
  );
  const edges = [];
  for (let index = 0; index < perGroup; index += 2) {
    edges.push(
      qualityEdge(
        `e-a${index}-a${index + 1}`,
        `a${index}`,
        `a${index + 1}`,
      ),
      qualityEdge(
        `e-b${index}-b${index + 1}`,
        `b${index}`,
        `b${index + 1}`,
      ),
    );
  }
  return qualityGraph([...p1, ...p2], edges);
}

describe('Discovery truncation performance', () => {
  it('固定内存夹具记录不同规模的生成耗时', () => {
    const sizes = [10, 30, 50];
    const repetitions = 3;
    const measurements: Array<{
      perGroup: number;
      nodes: number;
      combinations: number;
      milliseconds: number[];
      retained: number;
    }> = [];

    for (const perGroup of sizes) {
      const graph = performanceGraph(perGroup);
      const milliseconds: number[] = [];
      for (let run = 0; run < repetitions; run += 1) {
        const start = performance.now();
        const file = generateDiscoveries(
          graph,
          emptyDiscoveryFile(NOW),
          () => NOW,
        );
        milliseconds.push(performance.now() - start);
        expect(file.discoveries).toHaveLength(20);
      }
      measurements.push({
        perGroup,
        nodes: perGroup * 2,
        combinations: perGroup * perGroup,
        milliseconds,
        retained: 20,
      });
    }

    for (const measurement of measurements) {
      console.warn(
        `[DiscoveryPerformance] nodes=${measurement.nodes} combinations=${measurement.combinations} retained=${measurement.retained} ms=${measurement.milliseconds.map((value) => value.toFixed(2)).join(',')}`,
      );
    }

    expect(measurements).toHaveLength(3);
    expect(measurements.every((item) => item.retained === 20)).toBe(true);
  });
});
