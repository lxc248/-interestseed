import type {
  GraphViewport,
  InterestSeedGraph,
  InterestSeedNode,
  NodeType,
  RelationStatus,
} from '../types/graph';
import { clamp01 } from '../utils/validation';

export interface GraphCanvasOptions {
  onSelect(nodeId: string | null): void;
  onHover?(nodeId: string | null): void;
  onDoubleClick?(nodeId: string): void;
  onViewportChange?(viewport: GraphViewport): void;
  /** 拖动结束后回调，用于持久化节点位置。 */
  onNodeMoved?(nodeId: string, position: { x: number; y: number }): void;
}

interface LayoutNode {
  node: InterestSeedNode;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  degree: number;
}

interface LayoutEdge {
  edge: InterestSeedGraph['edges'][number];
  source: LayoutNode;
  target: LayoutNode;
}

interface TypeStyle {
  variable: string;
  fallback: string;
  glyph: string;
}

/** 颜色只从 Obsidian 主题变量读取，回退值仅用于非 Obsidian 环境。 */
const TYPE_STYLES: Record<NodeType, TypeStyle> = {
  project: { variable: '--color-pink', fallback: '#f472b6', glyph: '项' },
  document: { variable: '--color-blue', fallback: '#60a5fa', glyph: '文' },
  topic: { variable: '--color-purple', fallback: '#a78bfa', glyph: '主' },
  image: { variable: '--color-green', fallback: '#34d399', glyph: '图' },
  audio: { variable: '--color-yellow', fallback: '#fbbf24', glyph: '音' },
  video: { variable: '--color-red', fallback: '#fb7185', glyph: '视' },
  activity: { variable: '--color-cyan', fallback: '#22d3ee', glyph: '活' },
};

export function readNodePosition(node: InterestSeedNode): {
  x: number;
  y: number;
} | null {
  const value = node.metadata.position;
  if (typeof value !== 'object' || value === null) return null;
  const position = value as { x?: unknown; y?: unknown };
  if (typeof position.x !== 'number' || typeof position.y !== 'number') return null;
  if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) return null;
  return { x: position.x, y: position.y };
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * 纯 Canvas 力导向图：不引入 d3 / cytoscape 等运行时依赖。
 *
 * - 初始布局用黄金角螺旋（确定性，无需随机种子）；
 * - 斥力 + 弹簧 + 向心力的迭代模拟，节点少时精确计算，多时用空间网格近似；
 * - 支持拖拽节点、平移画布、滚轮缩放、悬停高亮、选中高亮邻居；
 * - confirmed / suggested / rejected 用线型与颜色区分；
 * - 视口可读写，便于随图谱持久化。
 */
export class GraphCanvas {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;

  private nodes: LayoutNode[] = [];
  private edges: LayoutEdge[] = [];
  private selectedId: string | null = null;
  private hoveredId: string | null = null;

  private width = 0;
  private height = 0;
  private dpr = 1;
  private zoom = 1;
  private panX = 0;
  private panY = 0;
  private alpha = 1;

  private frame: number | null = null;
  private disposed = false;
  private signature = '';
  private readonly positionCache = new Map<string, { x: number; y: number }>();
  private dragging: LayoutNode | null = null;
  private panning = false;
  private moved = false;
  private pointerStart = { x: 0, y: 0 };
  private lastPointer = { x: 0, y: 0 };
  private resizeObserver: ResizeObserver | null = null;
  private themeObserver: MutationObserver | null = null;
  private viewportTimer: number | null = null;

  constructor(
    private readonly container: HTMLElement,
    private readonly options: GraphCanvasOptions,
  ) {
    this.canvas = container.createEl('canvas', { cls: 'interestseed-canvas' });
    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('当前环境不支持 Canvas 2D');
    this.ctx = context;

    this.bindEvents();
    window.addEventListener('blur', this.handleWindowBlur);
    if (typeof MutationObserver !== 'undefined') {
      // 主题切换只改 body class，不会自动重绘画布；这里补一次重绘。
      this.themeObserver = new MutationObserver(() => this.draw());
      this.themeObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ['class'],
      });
    }
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(container);
    } else {
      window.addEventListener('resize', this.handleResize);
    }
    this.resize();
  }

  setGraph(graph: InterestSeedGraph, selectedId: string | null = null): void {
    const signature = `${graph.nodes.map((node) => node.id).sort().join('|')}#${graph.edges
      .map((edge) => edge.id)
      .sort()
      .join('|')}`;
    const structureChanged = signature !== this.signature;
    this.signature = signature;

    const previous = new Map<string, LayoutNode>();
    for (const item of this.nodes) {
      previous.set(item.node.id, item);
      // 缓存所有当前坐标，过滤隐藏后再显示时不会重新随机布局。
      this.positionCache.set(item.node.id, { x: item.x, y: item.y });
    }

    const degree = new Map<string, number>();
    for (const edge of graph.edges) {
      degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
      degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
    }

    const nodes: LayoutNode[] = [];
    let index = 0;
    // 已有手动保存的布局时保持不动；否则只有未见过的节点需要模拟。
    const hasSavedPositions = graph.nodes.some(
      (node) => readNodePosition(node) !== null,
    );
    const needsSimulation =
      !hasSavedPositions &&
      graph.nodes.some(
        (node) =>
          !this.positionCache.has(node.id) && readNodePosition(node) === null,
      );

    for (const node of graph.nodes) {
      const existing = previous.get(node.id);
      const nodeDegree = degree.get(node.id) ?? 0;
      const radius =
        7 + Math.min(9, nodeDegree * 0.9) + (node.type === 'project' ? 3 : 0);

      if (existing) {
        existing.node = node;
        existing.radius = radius;
        existing.degree = nodeDegree;
        nodes.push(existing);
      } else {
        const angle = index * 2.399963229728653;
        const distance = 34 * Math.sqrt(index + 1);
        const saved = readNodePosition(node);
        const cached = this.positionCache.get(node.id);
        nodes.push({
          node,
          x: cached?.x ?? saved?.x ?? Math.cos(angle) * distance,
          y: cached?.y ?? saved?.y ?? Math.sin(angle) * distance,
          vx: 0,
          vy: 0,
          radius,
          degree: nodeDegree,
        });
      }
      index += 1;
    }

    for (const item of nodes) {
      this.positionCache.set(item.node.id, { x: item.x, y: item.y });
    }

    const byId = new Map<string, LayoutNode>();
    for (const item of nodes) byId.set(item.node.id, item);

    const edges: LayoutEdge[] = [];
    for (const edge of graph.edges) {
      const source = byId.get(edge.source);
      const target = byId.get(edge.target);
      if (source && target) edges.push({ edge, source, target });
    }

    this.nodes = nodes;
    this.edges = edges;
    this.selectedId = selectedId;

    if (structureChanged) {
      this.alpha = 1;
      if (needsSimulation) {
        const iterations = nodes.length > 1200 ? 90 : nodes.length > 400 ? 180 : 320;
        this.stepSimulation(iterations);
      }
      this.zoomToFit();
    }

    this.draw();
  }

  setSelected(nodeId: string | null): void {
    this.selectedId = nodeId;
    this.draw();
  }

  focusNode(nodeId: string): void {
    const target = this.nodes.find((item) => item.node.id === nodeId);
    if (!target) return;
    this.zoom = Math.max(this.zoom, 0.9);
    this.panX = this.width / 2 - target.x * this.zoom;
    this.panY = this.height / 2 - target.y * this.zoom;
    this.draw();
    this.notifyViewport();
  }

  getViewport(): GraphViewport {
    return { zoom: this.zoom, panX: this.panX, panY: this.panY };
  }

  setViewport(viewport: GraphViewport | undefined): void {
    if (!viewport) return;
    this.zoom = clamp(viewport.zoom, 0.2, 3.5);
    this.panX = viewport.panX;
    this.panY = viewport.panY;
    this.draw();
  }

  zoomToFit(): void {
    if (this.nodes.length === 0 || this.width <= 0 || this.height <= 0) return;

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const item of this.nodes) {
      minX = Math.min(minX, item.x - item.radius);
      minY = Math.min(minY, item.y - item.radius);
      maxX = Math.max(maxX, item.x + item.radius);
      maxY = Math.max(maxY, item.y + item.radius);
    }

    const padding = 48;
    const graphWidth = Math.max(1, maxX - minX);
    const graphHeight = Math.max(1, maxY - minY);

    this.zoom = clamp(
      Math.min((this.width - padding * 2) / graphWidth, (this.height - padding * 2) / graphHeight),
      0.3,
      1.6,
    );
    this.panX = this.width / 2 - ((minX + maxX) / 2) * this.zoom;
    this.panY = this.height / 2 - ((minY + maxY) / 2) * this.zoom;
    this.draw();
  }

  resetLayout(): void {
    this.nodes.forEach((item, index) => {
      const angle = index * 2.399963229728653;
      const distance = 34 * Math.sqrt(index + 1);
      item.x = Math.cos(angle) * distance;
      item.y = Math.sin(angle) * distance;
      item.vx = 0;
      item.vy = 0;
    });
    this.alpha = 1;
    this.stepSimulation(360);
    this.zoomToFit();
    this.draw();
    this.notifyViewport();
  }

  destroy(): void {
    this.disposed = true;
    if (this.frame !== null) window.cancelAnimationFrame(this.frame);
    this.frame = null;
    if (this.viewportTimer !== null) window.clearTimeout(this.viewportTimer);
    this.viewportTimer = null;

    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.themeObserver?.disconnect();
    this.themeObserver = null;
    window.removeEventListener('blur', this.handleWindowBlur);
    window.removeEventListener('resize', this.handleResize);

    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    this.canvas.removeEventListener('pointercancel', this.handlePointerUp);
    this.canvas.removeEventListener('pointerleave', this.handlePointerLeave);
    this.canvas.removeEventListener('wheel', this.handleWheel);
    this.canvas.removeEventListener('dblclick', this.handleDoubleClick);

    this.canvas.remove();
  }

  // ------------------------------------------------------------ 布局模拟

  private stepSimulation(iterations: number): void {
    for (let step = 0; step < iterations; step += 1) this.tick();
  }

  private tick(): void {
    const nodes = this.nodes;
    if (nodes.length === 0) return;

    const alpha = this.alpha;

    if (nodes.length <= 320) {
      for (let left = 0; left < nodes.length; left += 1) {
        const first = nodes[left];
        if (!first) continue;
        for (let right = left + 1; right < nodes.length; right += 1) {
          const second = nodes[right];
          if (!second) continue;

          let dx = second.x - first.x;
          let dy = second.y - first.y;
          let distanceSq = dx * dx + dy * dy;
          if (distanceSq < 0.01) {
            dx = 0.4 + (left % 5) * 0.1;
            dy = 0.4 + (right % 5) * 0.1;
            distanceSq = dx * dx + dy * dy;
          }

          const distance = Math.sqrt(distanceSq);
          const force = (1400 * alpha) / distanceSq;
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;

          first.vx -= fx;
          first.vy -= fy;
          second.vx += fx;
          second.vy += fy;
        }
      }
    } else {
      this.tickWithGrid(alpha);
    }

    for (const link of this.edges) {
      const dx = link.target.x - link.source.x;
      const dy = link.target.y - link.source.y;
      const distance = Math.max(0.01, Math.sqrt(dx * dx + dy * dy));
      const desired = 120;
      const strength = 0.012 + clamp01(link.edge.confidence ?? 0.5) * 0.02;
      const force = (distance - desired) * strength * alpha;
      const fx = (dx / distance) * force;
      const fy = (dy / distance) * force;

      link.source.vx += fx;
      link.source.vy += fy;
      link.target.vx -= fx;
      link.target.vy -= fy;
    }

    for (const node of nodes) {
      node.vx -= node.x * 0.0022 * alpha;
      node.vy -= node.y * 0.0022 * alpha;
      node.vx *= 0.85;
      node.vy *= 0.85;
      node.x += node.vx;
      node.y += node.vy;
    }

    this.alpha = Math.max(0.01, this.alpha * 0.991);
  }

  private tickWithGrid(alpha: number): void {
    const cellSize = 140;
    const grid = new Map<string, LayoutNode[]>();

    for (const node of this.nodes) {
      const key = `${Math.floor(node.x / cellSize)},${Math.floor(node.y / cellSize)}`;
      const bucket = grid.get(key);
      if (bucket) bucket.push(node);
      else grid.set(key, [node]);
    }

    for (const node of this.nodes) {
      const cellX = Math.floor(node.x / cellSize);
      const cellY = Math.floor(node.y / cellSize);

      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
          const bucket = grid.get(`${cellX + offsetX},${cellY + offsetY}`);
          if (!bucket) continue;

          for (const other of bucket) {
            if (other === node) continue;
            const dx = other.x - node.x;
            const dy = other.y - node.y;
            const distanceSq = Math.max(0.01, dx * dx + dy * dy);
            const distance = Math.sqrt(distanceSq);
            const force = (1400 * alpha) / distanceSq;

            node.vx -= (dx / distance) * force * 0.5;
            node.vy -= (dy / distance) * force * 0.5;
          }
        }
      }
    }
  }

  private ensureAnimation(): void {
    if (this.frame !== null || this.disposed) return;

    const loop = (): void => {
      this.frame = null;
      if (this.disposed) return;

      this.tick();
      this.draw();

      if (this.alpha > 0.02) this.frame = window.requestAnimationFrame(loop);
    };

    this.frame = window.requestAnimationFrame(loop);
  }

  // ------------------------------------------------------------ 绘制

  private traceNodePath(ctx: CanvasRenderingContext2D, item: LayoutNode): void {
    const { x, y, radius } = item;

    switch (item.node.type) {
      case 'project':
        ctx.rect(x - radius * 0.82, y - radius * 0.82, radius * 1.64, radius * 1.64);
        break;
      case 'topic':
        ctx.moveTo(x, y - radius);
        ctx.lineTo(x + radius, y);
        ctx.lineTo(x, y + radius);
        ctx.lineTo(x - radius, y);
        break;
      case 'image':
      case 'audio':
      case 'video':
        ctx.moveTo(x, y - radius);
        ctx.lineTo(x + radius, y + radius * 0.8);
        ctx.lineTo(x - radius, y + radius * 0.8);
        break;
      case 'activity': {
        const sides = 6;
        for (let index = 0; index < sides; index += 1) {
          const angle = (Math.PI / 3) * index - Math.PI / 2;
          const px = x + Math.cos(angle) * radius;
          const py = y + Math.sin(angle) * radius;
          if (index === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        break;
      }
      default:
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        break;
    }
  }

  private draw(): void {
    if (this.disposed || this.width <= 0 || this.height <= 0) return;

    const { ctx } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);

    ctx.save();
    ctx.translate(this.panX, this.panY);
    ctx.scale(this.zoom, this.zoom);

    const textColor = this.readCssVariable('--text-normal', '#dcddde');
    const typeColors = {} as Record<NodeType, string>;
    for (const type of Object.keys(TYPE_STYLES) as NodeType[]) {
      typeColors[type] = this.readCssVariable(
        TYPE_STYLES[type].variable,
        TYPE_STYLES[type].fallback,
      );
    }

    const edgeColors: Record<RelationStatus, string> = {
      confirmed: this.readCssVariable('--text-muted', '#94a3b8'),
      suggested: this.readCssVariable('--color-yellow', '#fbbf24'),
      rejected: this.readCssVariable('--text-faint', '#64748b'),
    };

    const neighbors = this.neighborIds();

    for (const link of this.edges) {
      const incident =
        !this.selectedId ||
        link.edge.source === this.selectedId ||
        link.edge.target === this.selectedId;

      const status = link.edge.status;
      const color = edgeColors[status];

      ctx.globalAlpha = incident ? 0.2 + (link.edge.confidence ?? 0.5) * 0.6 : 0.12;
      ctx.strokeStyle = color;
      ctx.lineWidth = (0.8 + (link.edge.confidence ?? 0.5) * 1.8) / this.zoom;
      ctx.setLineDash(
        status === 'suggested'
          ? [6 / this.zoom, 5 / this.zoom]
          : status === 'rejected'
            ? [2 / this.zoom, 4 / this.zoom]
            : [],
      );

      ctx.beginPath();
      ctx.moveTo(link.source.x, link.source.y);
      ctx.lineTo(link.target.x, link.target.y);
      ctx.stroke();
    }

    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.lineCap = 'round';

    for (const item of this.nodes) {
      const isSelected = item.node.id === this.selectedId;
      const isHovered = item.node.id === this.hoveredId;
      const isNeighbor = neighbors.has(item.node.id);

      ctx.beginPath();
      this.traceNodePath(ctx, item);
      ctx.closePath();
      const nodeColor = typeColors[item.node.type] ?? '#a78bfa';
      ctx.fillStyle = nodeColor;
      ctx.globalAlpha = isSelected || isHovered || !this.selectedId ? 0.92 : isNeighbor ? 0.75 : 0.5;
      if (isSelected || isHovered) {
        ctx.shadowColor = nodeColor;
        ctx.shadowBlur = 14 / this.zoom;
      }
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';

      if (isSelected || isHovered) {
        ctx.globalAlpha = 1;
        ctx.lineWidth = 2.4 / this.zoom;
        ctx.strokeStyle = textColor;
        ctx.stroke();
      } else {
        // 浅色主题下淡色节点需要细边框，否则与白色背景对比不足。
        ctx.globalAlpha = isNeighbor ? 0.65 : 0.45;
        ctx.lineWidth = 1 / this.zoom;
        ctx.strokeStyle = this.readCssVariable('--text-faint', '#64748b');
        ctx.stroke();
      }
    }

    ctx.globalAlpha = 1;

    // 字形标记：即使无法分辨颜色，也能看出节点类型。
    const glyphColor = this.readCssVariable('--text-on-accent', '#101014');
    for (const item of this.nodes) {
      if (item.radius < 8) continue;
      ctx.fillStyle = glyphColor;
      ctx.font = `bold ${Math.max(9, item.radius * 0.9)}px -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(TYPE_STYLES[item.node.type].glyph, item.x, item.y + 0.5);
    }

    const showAllLabels = this.nodes.length <= 150 && this.zoom >= 0.55;
    const fontSize = 12 / this.zoom;

    ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (const item of this.nodes) {
      const isSelected = item.node.id === this.selectedId;
      const isHovered = item.node.id === this.hoveredId;
      const isNeighbor = neighbors.has(item.node.id);
      const showLabel =
        isSelected || isHovered || isNeighbor || showAllLabels || this.nodes.length <= 8;

      if (!showLabel) continue;

      const label =
        item.node.title.length > 20 ? `${item.node.title.slice(0, 19)}…` : item.node.title;

      ctx.globalAlpha = isSelected || isHovered ? 1 : 0.85;
      ctx.fillStyle = textColor;
      ctx.fillText(label, item.x, item.y + item.radius + 5 / this.zoom);
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  private neighborIds(): Set<string> {
    const ids = new Set<string>();
    if (!this.selectedId) return ids;

    for (const link of this.edges) {
      if (link.edge.source === this.selectedId) ids.add(link.edge.target);
      else if (link.edge.target === this.selectedId) ids.add(link.edge.source);
    }
    return ids;
  }

  private readCssVariable(name: string, fallback: string): string {
    const value = getComputedStyle(this.canvas).getPropertyValue(name).trim();
    return value || fallback;
  }

  // ------------------------------------------------------------ 交互

  private bindEvents(): void {
    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.canvas.addEventListener('pointermove', this.handlePointerMove);
    this.canvas.addEventListener('pointerup', this.handlePointerUp);
    this.canvas.addEventListener('pointercancel', this.handlePointerUp);
    this.canvas.addEventListener('pointerleave', this.handlePointerLeave);
    this.canvas.addEventListener('wheel', this.handleWheel, { passive: false });
    this.canvas.addEventListener('dblclick', this.handleDoubleClick);
  }

  private readonly handleResize = (): void => {
    this.resize();
  };

  /** 窗口失焦时结束未完成的拖动/平移，避免鼠标松开事件丢失后继续跟随。 */
  private readonly handleWindowBlur = (): void => {
    const wasDragging = this.dragging;
    const wasPanning = this.panning;
    if (!wasDragging && !wasPanning) return;
    const moved = this.moved;

    this.dragging = null;
    this.panning = false;
    this.moved = false;
    this.canvas.removeClass('is-panning');

    if (wasDragging && moved) {
      this.options.onNodeMoved?.(wasDragging.node.id, {
        x: wasDragging.x,
        y: wasDragging.y,
      });
    }
    if ((wasDragging && moved) || wasPanning) this.notifyViewport();
    this.draw();
  };

  private readonly handlePointerDown = (event: PointerEvent): void => {
    this.moved = false;
    this.pointerStart = { x: event.clientX, y: event.clientY };
    this.lastPointer = { x: event.clientX, y: event.clientY };

    const hit = this.hitTest(event);
    if (hit) {
      this.dragging = hit;
      this.canvas.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    } else {
      this.panning = true;
      this.canvas.addClass('is-panning');
      this.canvas.setPointerCapture?.(event.pointerId);
    }
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    const deltaX = event.clientX - this.lastPointer.x;
    const deltaY = event.clientY - this.lastPointer.y;
    this.lastPointer = { x: event.clientX, y: event.clientY };

    if (
      Math.abs(event.clientX - this.pointerStart.x) +
        Math.abs(event.clientY - this.pointerStart.y) >
      3
    ) {
      this.moved = true;
    }

    if (this.dragging && event.buttons === 0) {
      this.handleWindowBlur();
      return;
    }

    if (this.dragging) {
      const point = this.toWorld(event.clientX, event.clientY);
      this.dragging.x = point.x;
      this.dragging.y = point.y;
      this.dragging.vx = 0;
      this.dragging.vy = 0;
      this.alpha = Math.max(this.alpha, 0.35);
      this.ensureAnimation();
      this.draw();
      return;
    }

    if (this.panning) {
      this.panX += deltaX;
      this.panY += deltaY;
      this.draw();
      return;
    }

    const hovered = this.hitTest(event);
    const hoveredId = hovered?.node.id ?? null;
    if (hoveredId !== this.hoveredId) {
      this.hoveredId = hoveredId;
      this.canvas.style.cursor = hovered ? 'pointer' : 'grab';
      this.options.onHover?.(hoveredId);
      this.draw();
    }
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    const wasDragging = this.dragging;
    const wasPanning = this.panning;

    this.dragging = null;
    this.panning = false;
    this.canvas.removeClass('is-panning');

    if (this.canvas.hasPointerCapture?.(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId);
    }

    if (this.moved) {
      if (wasDragging) {
        this.options.onNodeMoved?.(wasDragging.node.id, {
          x: wasDragging.x,
          y: wasDragging.y,
        });
      }
      if (wasDragging || wasPanning) this.notifyViewport();
      return;
    }

    if (wasDragging) {
      const id = wasDragging.node.id;
      this.options.onSelect(id === this.selectedId ? null : id);
    } else if (wasPanning) {
      this.options.onSelect(null);
    }
  };

  private readonly handlePointerLeave = (): void => {
    if (this.hoveredId === null) return;
    this.hoveredId = null;
    this.options.onHover?.(null);
    this.canvas.style.cursor = 'default';
    this.draw();
  };

  private readonly handleWheel = (event: WheelEvent): void => {
    event.preventDefault();

    const rect = this.canvas.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const worldX = (pointerX - this.panX) / this.zoom;
    const worldY = (pointerY - this.panY) / this.zoom;

    const factor = Math.exp(-event.deltaY * 0.0015);
    const nextZoom = clamp(this.zoom * factor, 0.2, 3.5);

    this.panX = pointerX - worldX * nextZoom;
    this.panY = pointerY - worldY * nextZoom;
    this.zoom = nextZoom;
    this.draw();
    this.notifyViewport();
  };

  private readonly handleDoubleClick = (event: MouseEvent): void => {
    const hit = this.hitTest(event);
    if (hit) {
      this.options.onDoubleClick?.(hit.node.id);
      return;
    }
    this.zoomToFit();
    this.notifyViewport();
  };

  private hitTest(event: MouseEvent): LayoutNode | null {
    const point = this.toWorld(event.clientX, event.clientY);
    let best: LayoutNode | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const item of this.nodes) {
      const dx = item.x - point.x;
      const dy = item.y - point.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const hitRadius = Math.max(item.radius, 14 / this.zoom);

      if (distance <= hitRadius && distance < bestDistance) {
        best = item;
        bestDistance = distance;
      }
    }

    return best;
  }

  private toWorld(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - this.panX) / this.zoom,
      y: (clientY - rect.top - this.panY) / this.zoom,
    };
  }

  private notifyViewport(): void {
    if (!this.options.onViewportChange) return;
    if (this.viewportTimer !== null) window.clearTimeout(this.viewportTimer);
    this.viewportTimer = window.setTimeout(() => {
      this.viewportTimer = null;
      this.options.onViewportChange?.(this.getViewport());
    }, 350);
  }

  private resize(): void {
    const rect = this.container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    this.width = Math.floor(rect.width);
    this.height = Math.floor(rect.height);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    this.draw();
  }
}
