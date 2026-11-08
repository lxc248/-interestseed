// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { GraphCanvas } from '../src/ui/GraphCanvas';
import type { InterestSeedGraph } from '../src/types/graph';
import { installDomShims } from './ui-test-shim';

installDomShims();

function fakeContext(): CanvasRenderingContext2D {
  const context = new Proxy(
    {},
    {
      get(_target, property) {
        if (property === 'measureText') return () => ({ width: 10 });
        if (property === 'createLinearGradient') return () => ({ addColorStop() {} });
        if (property === 'canvas') return undefined;
        return () => undefined;
      },
      set() {
        return true;
      },
    },
  );
  return context as CanvasRenderingContext2D;
}

const now = '2026-01-01T00:00:00.000Z';
const graph: InterestSeedGraph = {
  schemaVersion: 2,
  updatedAt: now,
  nodes: [
    {
      id: 'a',
      type: 'topic',
      title: 'A',
      tags: [],
      createdAt: now,
      updatedAt: now,
      metadata: {},
    },
    {
      id: 'b',
      type: 'document',
      title: 'B',
      tags: [],
      createdAt: now,
      updatedAt: now,
      metadata: {},
    },
  ],
  edges: [
    {
      id: 'e1',
      source: 'a',
      target: 'b',
      relation: 'related',
      origin: 'user',
      status: 'confirmed',
      createdAt: now,
      updatedAt: now,
    },
  ],
};

let canvas: GraphCanvas | undefined;
let container: HTMLDivElement | undefined;
const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');

beforeAll(() => {
  getContext.mockImplementation(() => fakeContext());
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
});

afterEach(() => {
  canvas?.destroy();
  canvas = undefined;
  container?.remove();
  container = undefined;
  getContext.mockClear();
});

function mount(): GraphCanvas {
  container = document.createElement('div');
  Object.defineProperty(container, 'clientWidth', { configurable: true, value: 800 });
  Object.defineProperty(container, 'clientHeight', { configurable: true, value: 600 });
  container.getBoundingClientRect = () => ({
    width: 800,
    height: 600,
    top: 0,
    left: 0,
    bottom: 600,
    right: 800,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  document.body.appendChild(container);
  canvas = new GraphCanvas(container, { onSelect: () => undefined });
  return canvas;
}

describe('GraphCanvas runtime', () => {
  it('loads a graph and produces a finite viewport', () => {
    const view = mount();
    view.setGraph(graph);
    const viewport = view.getViewport();
    expect(Number.isFinite(viewport.zoom)).toBe(true);
    expect(Number.isFinite(viewport.panX)).toBe(true);
    expect(Number.isFinite(viewport.panY)).toBe(true);
    expect(viewport.zoom).toBeGreaterThan(0);
  });

  it('supports selection, focus and viewport clamping', () => {
    const view = mount();
    view.setGraph(graph);
    view.setSelected('a');
    view.focusNode('a');
    view.setViewport({ zoom: 9, panX: 20, panY: 30 });
    expect(view.getViewport().zoom).toBeLessThanOrEqual(3.5);
    view.resetLayout();
    expect(() => view.destroy()).not.toThrow();
  });

  it('handles an empty graph safely', () => {
    const view = mount();
    view.setGraph({ schemaVersion: 2, updatedAt: now, nodes: [], edges: [] });
    expect(view.getViewport().zoom).toBeGreaterThan(0);
  });
});
