import type {
  GraphViewport,
  InterestSeedEdge,
  InterestSeedGraph,
  InterestSeedNode,
  NodeType,
} from '../types/graph';

export interface CosmicGraphCanvasOptions {
  onSelect(nodeId: string | null): void;
  onHover?(nodeId: string | null): void;
  onDoubleClick?(nodeId: string): void;
  onViewportChange?(viewport: GraphViewport): void;
  onNodeMoved?(nodeId: string, position: { x: number; y: number }): void;
}

interface CosmicNode extends InterestSeedNode {
  x: number;
  y: number;
  radius: number;
  degree: number;
  cluster: string;
  phase: number;
  screenX: number;
  screenY: number;
}

interface CosmicEdge {
  edge: InterestSeedEdge;
  source: CosmicNode;
  target: CosmicNode;
}

interface Cluster {
  key: string;
  label: string;
  color: string;
  count: number;
  x: number;
  y: number;
  radius: number;
}

const WORLD_WIDTH = 1600;
const WORLD_HEIGHT = 1000;

const TYPE_STYLE: Record<NodeType, { color: string; glyph: string }> = {
  project: { color: '#e18061', glyph: '项' },
  document: { color: '#5ed1df', glyph: '文' },
  topic: { color: '#9c8cff', glyph: '主' },
  image: { color: '#e6b66a', glyph: '图' },
  audio: { color: '#ee82a4', glyph: '音' },
  video: { color: '#ee82a4', glyph: '视' },
  activity: { color: '#7dd9ad', glyph: '活' },
};

const CLUSTER_STYLE: Record<string, { label: string; color: string }> = {
  genesis: { label: '兴趣起跑', color: '#e18061' },
  projects: { label: '项目轨道', color: '#9c8cff' },
  expression: { label: '表达轨道', color: '#e6b66a' },
  city: { label: '城市轨道', color: '#5ed1df' },
  experiment: { label: '实验轨道', color: '#7dd9ad' },
  other: { label: '其他轨道', color: '#969ca8' },
};

const CLUSTER_CENTERS: Array<[number, number]> = [
  [430, 500],
  [1100, 400],
  [1240, 760],
  [550, 820],
  [880, 580],
  [230, 740],
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function hash(value: string): number {
  let h = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    h ^= value.charCodeAt(index);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function nodeRadius(type: NodeType, degree: number): number {
  const base: Record<NodeType, number> = {
    project: 23,
    document: 13,
    topic: 19,
    image: 14,
    audio: 14,
    video: 15,
    activity: 18,
  };
  return base[type] + Math.min(8, degree * 0.7);
}

function clusterKey(node: InterestSeedNode): string {
  const tags = node.tags.map((tag) => tag.toLowerCase());
  if (tags.includes('兴趣起跑')) return 'genesis';
  if (tags.includes('城市') || tags.includes('空间')) return 'city';
  if (tags.includes('设计') || tags.includes('表达') || tags.includes('影像')) {
    return 'expression';
  }
  if (tags.includes('实验') || tags.includes('下一步')) return 'experiment';
  if (node.type === 'project' || tags.includes('项目')) return 'projects';
  return 'other';
}

/**
 * CosmicGraphCanvas is the plugin-native version of the standalone viewer.
 *
 * It keeps the existing GraphCanvas contract (setGraph / viewport / fit /
 * select / drag) while changing the rendering language to planets, orbits,
 * nebulae and travelling light.
 */
export class CosmicGraphCanvas {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private nodes: CosmicNode[] = [];
  private edges: CosmicEdge[] = [];
  private clusters = new Map<string, Cluster>();
  private selectedId: string | null = null;
  private hoveredId: string | null = null;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private zoom = 1;
  private panX = 0;
  private panY = 0;
  private frame: number | null = null;
  private disposed = false;
  private dragging: CosmicNode | null = null;
  private panning = false;
  private moved = false;
  private lastPointer = { x: 0, y: 0 };
  private hasGraph = false;
  private resizeObserver: ResizeObserver | null = null;
  private viewportTimer: number | null = null;
  private time = 0;
  private lastTime = performance.now();
  private readonly positions = new Map<string, { x: number; y: number }>();
  private readonly stars: Array<{
    x: number;
    y: number;
    r: number;
    a: number;
    phase: number;
    speed: number;
    color: string;
  }> = [];

  constructor(
    private readonly container: HTMLElement,
    private readonly options: CosmicGraphCanvasOptions,
  ) {
    this.canvas = container.createEl('canvas', { cls: 'interestseed-cosmic-canvas' });
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('tabindex', '0');
    this.canvas.setAttribute('aria-label', '宇宙兴趣星图：行星是兴趣，轨道是主题，点击查看详情');
    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('当前环境不支持 Canvas 2D');
    this.ctx = context;
    for (let index = 0; index < 220; index += 1) {
      this.stars.push({
        x: hash(`x-${index}`),
        y: hash(`y-${index}`),
        r: 0.35 + hash(`r-${index}`) * 1.45,
        a: 0.10 + hash(`a-${index}`) * 0.54,
        phase: hash(`p-${index}`) * Math.PI * 2,
        speed: 0.25 + hash(`s-${index}`) * 1.5,
        color:
          index % 9 === 0
            ? '140,205,255'
            : index % 13 === 0
              ? '255,185,150'
              : '225,232,255',
      });
    }
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.bindEvents();
    this.resize();
    this.loop();
  }

  setGraph(graph: InterestSeedGraph, selectedId: string | null = null): void {
    const degrees = new Map<string, number>();
    for (const node of graph.nodes) degrees.set(node.id, 0);
    for (const edge of graph.edges) {
      degrees.set(edge.source, (degrees.get(edge.source) ?? 0) + 1);
      degrees.set(edge.target, (degrees.get(edge.target) ?? 0) + 1);
    }

    const nextNodes: CosmicNode[] = graph.nodes.map((node) => {
      const existing = this.positions.get(node.id);
      return {
        ...node,
        degree: degrees.get(node.id) ?? 0,
        radius: nodeRadius(node.type, degrees.get(node.id) ?? 0),
        cluster: clusterKey(node),
        phase: hash(node.id) * Math.PI * 2,
        x: existing?.x ?? 0,
        y: existing?.y ?? 0,
        screenX: 0,
        screenY: 0,
      };
    });

    const counts = new Map<string, number>();
    for (const node of nextNodes) {
      counts.set(node.cluster, (counts.get(node.cluster) ?? 0) + 1);
    }
    const present = [...counts.keys()];
    this.clusters.clear();
    present.forEach((key, index) => {
      const style = CLUSTER_STYLE[key] ?? CLUSTER_STYLE.other ?? { label: '其他', color: '#969ca8' };
      const center: [number, number] = CLUSTER_CENTERS[index % CLUSTER_CENTERS.length] ?? [
        WORLD_WIDTH / 2,
        WORLD_HEIGHT / 2,
      ];
      this.clusters.set(key, {
        key,
        label: style.label,
        color: style.color,
        count: counts.get(key) ?? 0,
        x: present.length === 1 ? WORLD_WIDTH / 2 : center[0],
        y: present.length === 1 ? WORLD_HEIGHT / 2 : center[1],
        radius: 92 + Math.min(105, (counts.get(key) ?? 0) * 18),
      });
    });

    for (const cluster of this.clusters.values()) {
      const members = nextNodes.filter((node) => node.cluster === cluster.key);
      members.forEach((node, index) => {
        if (this.positions.has(node.id)) {
          node.x = this.positions.get(node.id)?.x ?? node.x;
          node.y = this.positions.get(node.id)?.y ?? node.y;
          return;
        }
        const angle =
          (index / Math.max(1, members.length)) * Math.PI * 2 +
          hash(cluster.key) * 1.4;
        const ring = cluster.radius + (index % 2) * 38 + (node.degree > 2 ? 16 : 0);
        node.x = cluster.x + Math.cos(angle) * ring + (hash(`${node.id}-x`) - 0.5) * 18;
        node.y =
          cluster.y +
          Math.sin(angle) * ring * 0.62 +
          (hash(`${node.id}-y`) - 0.5) * 16;
        this.positions.set(node.id, { x: node.x, y: node.y });
      });
    }

    this.nodes = nextNodes;
    this.edges = [];
    const byId = new Map(nextNodes.map((node) => [node.id, node]));
    for (const edge of graph.edges) {
      const source = byId.get(edge.source);
      const target = byId.get(edge.target);
      if (source && target) this.edges.push({ edge, source, target });
    }
    this.selectedId = selectedId;
    const firstGraph = !this.hasGraph;
    this.hasGraph = true;
    if (firstGraph) this.zoomToFit();
    else this.draw();
  }

  setSelected(nodeId: string | null): void {
    this.selectedId = nodeId;
    this.draw();
  }

  focusNode(nodeId: string): void {
    const target = this.nodes.find((node) => node.id === nodeId);
    if (!target) return;
    this.zoom = Math.max(this.zoom, 0.9);
    this.panX = this.width / 2 - target.x * this.zoom;
    this.panY = this.height / 2 - target.y * this.zoom;
    this.notifyViewport();
    this.draw();
  }

  getViewport(): GraphViewport {
    return { zoom: this.zoom, panX: this.panX, panY: this.panY };
  }

  setViewport(viewport: GraphViewport | undefined): void {
    if (!viewport) return;
    if (this.nodes.length > 0 && this.nodes.length <= 45 && viewport.zoom < 0.55) {
      this.zoomToFit();
      return;
    }
    const hasVisibleNode = this.nodes.some((node) => {
      const x = node.x * viewport.zoom + viewport.panX;
      const y = node.y * viewport.zoom + viewport.panY;
      return x > -160 && x < this.width + 160 && y > -160 && y < this.height + 160;
    });
    if (this.nodes.length > 0 && !hasVisibleNode) {
      this.zoomToFit();
      return;
    }
    this.zoom = clamp(viewport.zoom, 0.22, 3.5);
    this.panX = viewport.panX;
    this.panY = viewport.panY;
    this.draw();
  }

  zoomToFit(): void {
    if (this.nodes.length === 0 || this.width <= 0 || this.height <= 0) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const node of this.nodes) {
      minX = Math.min(minX, node.x - 135);
      minY = Math.min(minY, node.y - 105);
      maxX = Math.max(maxX, node.x + 135);
      maxY = Math.max(maxY, node.y + 105);
    }
    const graphWidth = Math.max(1, maxX - minX);
    const graphHeight = Math.max(1, maxY - minY);
    this.zoom = clamp(
      Math.min((this.width - 72) / graphWidth, (this.height - 110) / graphHeight),
      0.30,
      1.32,
    );
    this.panX = this.width / 2 - ((minX + maxX) / 2) * this.zoom;
    this.panY = this.height / 2 - ((minY + maxY) / 2) * this.zoom;
    this.notifyViewport();
    this.draw();
  }

  resetLayout(): void {
    this.positions.clear();
    this.zoomToFit();
  }

  destroy(): void {
    this.disposed = true;
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    if (this.viewportTimer !== null) clearTimeout(this.viewportTimer);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.canvas.remove();
  }

  private resize(): void {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = this.container.getBoundingClientRect();
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    if (this.nodes.length > 0 && this.zoom < 0.55) this.zoomToFit();
    this.draw();
  }

  private loop(): void {
    if (this.disposed) return;
    const now = performance.now();
    this.time += Math.min(40, now - this.lastTime) / 1000;
    this.lastTime = now;
    this.draw();
    this.frame = requestAnimationFrame(() => this.loop());
  }

  private screen(node: CosmicNode): { x: number; y: number } {
    return {
      x: node.x * this.zoom + this.panX + Math.sin(this.time * 0.45 + node.phase) * 2,
      y: node.y * this.zoom + this.panY + Math.cos(this.time * 0.38 + node.phase) * 1.5,
    };
  }

  private draw(): void {
    if (this.disposed) return;
    const { ctx, width, height } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    this.drawBackdrop();
    this.drawOrbits();
    this.drawEdges();
    this.drawClusterStars();
    for (const node of this.nodes) this.drawPlanet(node);
    this.drawLabels();
  }

  private drawBackdrop(): void {
    const { ctx, width, height } = this;
    const base = ctx.createRadialGradient(
      width * 0.5,
      height * 0.45,
      0,
      width * 0.5,
      height * 0.45,
      Math.max(width, height) * 0.8,
    );
    base.addColorStop(0, '#090d1a');
    base.addColorStop(0.52, '#060913');
    base.addColorStop(1, '#03050a');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, width, height);

    const nebulaA = ctx.createRadialGradient(
      width * 0.2,
      height * 0.3,
      0,
      width * 0.2,
      height * 0.3,
      width * 0.5,
    );
    nebulaA.addColorStop(0, 'rgba(105,70,150,.11)');
    nebulaA.addColorStop(0.5, 'rgba(58,49,118,.035)');
    nebulaA.addColorStop(1, 'rgba(4,6,12,0)');
    ctx.fillStyle = nebulaA;
    ctx.fillRect(0, 0, width, height);

    const nebulaB = ctx.createRadialGradient(
      width * 0.82,
      height * 0.7,
      0,
      width * 0.82,
      height * 0.7,
      width * 0.48,
    );
    nebulaB.addColorStop(0, 'rgba(42,126,150,.085)');
    nebulaB.addColorStop(0.5, 'rgba(20,55,80,.025)');
    nebulaB.addColorStop(1, 'rgba(4,6,12,0)');
    ctx.fillStyle = nebulaB;
    ctx.fillRect(0, 0, width, height);

    for (const star of this.stars) {
      const alpha = star.a * (0.58 + 0.42 * Math.sin(this.time * star.speed + star.phase));
      ctx.fillStyle = `rgba(${star.color},${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(star.x * width, star.y * height, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 0.1;
    for (let index = 0; index < 4; index += 1) {
      const y = (index * height) / 4 + Math.sin(this.time * 0.07 + index) * 6;
      ctx.strokeStyle = index % 2 ? 'rgba(94,209,223,.45)' : 'rgba(225,128,97,.3)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y + 50);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  private drawOrbits(): void {
    let index = 0;
    for (const cluster of this.clusters.values()) {
      const cx = cluster.x * this.zoom + this.panX;
      const cy = cluster.y * this.zoom + this.panY;
      for (let ring = 0; ring < 3; ring += 1) {
        const rx = (cluster.radius + ring * 48 + 16) * this.zoom;
        const ry = rx * (0.58 + ring * 0.025);
        this.ctx.strokeStyle =
          ring === 0 ? `${cluster.color}38` : ring === 1 ? `${cluster.color}1c` : `${cluster.color}12`;
        this.ctx.lineWidth = ring === 0 ? 1 : 0.7;
        this.ctx.beginPath();
        this.ctx.ellipse(cx, cy, rx, ry, -0.18 + index * 0.03, 0, Math.PI * 2);
        this.ctx.stroke();
      }
      index += 1;
    }
  }

  private drawClusterStars(): void {
    for (const cluster of this.clusters.values()) {
      const x = cluster.x * this.zoom + this.panX;
      const y = cluster.y * this.zoom + this.panY;
      const r = Math.max(3, 6 * this.zoom);
      const glow = this.ctx.createRadialGradient(x, y, 0, x, y, r * 11);
      glow.addColorStop(0, `${cluster.color}d0`);
      glow.addColorStop(0.15, `${cluster.color}55`);
      glow.addColorStop(1, `${cluster.color}00`);
      this.ctx.fillStyle = glow;
      this.ctx.beginPath();
      this.ctx.arc(x, y, r * 11, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillStyle = cluster.color;
      this.ctx.beginPath();
      this.ctx.arc(x, y, r, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillStyle = 'rgba(242,239,233,.42)';
      this.ctx.font = '600 8px "Inter","Noto Sans SC",sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(cluster.label, x, y + r + 16);
    }
  }

  private edgeCurve(edge: CosmicEdge): {
    ax: number;
    ay: number;
    cx: number;
    cy: number;
    bx: number;
    by: number;
  } {
    const a = this.screen(edge.source);
    const b = this.screen(edge.target);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy) || 1;
    const bend = Math.min(64, length * 0.15) * (edge.source.id < edge.target.id ? 1 : -1);
    return {
      ax: a.x,
      ay: a.y,
      cx: (a.x + b.x) / 2 - (dy / length) * bend,
      cy: (a.y + b.y) / 2 + (dx / length) * bend,
      bx: b.x,
      by: b.y,
    };
  }

  private drawEdges(): void {
    const activeId = this.selectedId ?? this.hoveredId;
    for (const edge of this.edges) {
      const curve = this.edgeCurve(edge);
      const style = TYPE_STYLE[edge.source.type] ?? TYPE_STYLE.topic;
      const active =
        activeId !== null &&
        (edge.source.id === activeId || edge.target.id === activeId);
      this.ctx.save();
      this.ctx.globalAlpha = active ? 0.95 : edge.edge.status === 'suggested' ? 0.20 : 0.33;
      this.ctx.strokeStyle = active ? style.color : `${style.color}88`;
      this.ctx.lineWidth = active ? 1.7 : edge.edge.status === 'suggested' ? 0.8 : 1.0;
      if (edge.edge.status === 'suggested') this.ctx.setLineDash([4, 8]);
      this.ctx.beginPath();
      this.ctx.moveTo(curve.ax, curve.ay);
      this.ctx.quadraticCurveTo(curve.cx, curve.cy, curve.bx, curve.by);
      this.ctx.stroke();
      this.ctx.setLineDash([]);

      const speed = 0.1 + hash(edge.edge.id) * 0.08;
      for (let index = 0; index < 2; index += 1) {
        const p = (this.time * speed + index * 0.5 + hash(edge.edge.id)) % 1;
        const x =
          (1 - p) ** 2 * curve.ax +
          2 * (1 - p) * p * curve.cx +
          p * p * curve.bx;
        const y =
          (1 - p) ** 2 * curve.ay +
          2 * (1 - p) * p * curve.cy +
          p * p * curve.by;
        const glow = this.ctx.createRadialGradient(x, y, 0, x, y, 7);
        glow.addColorStop(0, active ? style.color : `${style.color}aa`);
        glow.addColorStop(1, `${style.color}00`);
        this.ctx.fillStyle = glow;
        this.ctx.beginPath();
        this.ctx.arc(x, y, 7, 0, Math.PI * 2);
        this.ctx.fill();
      }
      if (active) {
        const text = edge.edge.relation || '连接';
        this.ctx.font = '500 9px "Inter","Noto Sans SC",sans-serif';
        const tw = this.ctx.measureText(text).width;
        this.ctx.fillStyle = 'rgba(5,7,13,.82)';
        this.roundRect(curve.cx - tw / 2 - 6, curve.cy - 12, tw + 12, 17, 7);
        this.ctx.fill();
        this.ctx.fillStyle = style.color;
        this.ctx.textAlign = 'center';
        this.ctx.fillText(text, curve.cx, curve.cy);
      }
      this.ctx.restore();
    }
  }

  private drawPlanet(node: CosmicNode): void {
    const p = this.screen(node);
    node.screenX = p.x;
    node.screenY = p.y;
    const style = TYPE_STYLE[node.type] ?? TYPE_STYLE.topic;
    const r = Math.max(4, node.radius * this.zoom);
    const active = node.id === this.selectedId;
    const hot = node.id === this.hoveredId;
    const halo = this.ctx.createRadialGradient(p.x, p.y, r * 0.5, p.x, p.y, r * 4.7);
    halo.addColorStop(0, `${style.color}${active ? '5a' : hot ? '3a' : '22'}`);
    halo.addColorStop(1, `${style.color}00`);
    this.ctx.fillStyle = halo;
    this.ctx.beginPath();
    this.ctx.arc(p.x, p.y, r * 4.7, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.strokeStyle = `${style.color}${active ? 'aa' : '45'}`;
    this.ctx.lineWidth = active ? 1.3 : 0.8;
    this.ctx.beginPath();
    this.ctx.arc(p.x, p.y, r + (active ? 6 : 3), 0, Math.PI * 2);
    this.ctx.stroke();

    const body = this.ctx.createRadialGradient(
      p.x - r * 0.34,
      p.y - r * 0.4,
      r * 0.06,
      p.x,
      p.y,
      r,
    );
    body.addColorStop(0, this.lighten(style.color, 0.46));
    body.addColorStop(0.28, style.color);
    body.addColorStop(0.78, this.darken(style.color, 0.32));
    body.addColorStop(1, this.darken(style.color, 0.68));
    this.ctx.fillStyle = body;
    this.ctx.beginPath();
    this.ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = 'rgba(2,4,9,.28)';
    this.ctx.beginPath();
    this.ctx.arc(p.x + r * 0.22, p.y + r * 0.12, r * 0.9, -1.6, 2.4);
    this.ctx.fill();

    if (node.degree >= 3 || node.type === 'project') {
      const angle = this.time * 0.5 + node.phase;
      this.ctx.fillStyle = style.color;
      this.ctx.beginPath();
      this.ctx.arc(
        p.x + Math.cos(angle) * (r + 8),
        p.y + Math.sin(angle) * (r + 8) * 0.45,
        Math.max(1.1, r * 0.1),
        0,
        Math.PI * 2,
      );
      this.ctx.fill();
    }
    if (active || node.type === 'project') {
      this.ctx.strokeStyle = `${style.color}${active ? 'c0' : '55'}`;
      this.ctx.lineWidth = active ? 1.5 : 0.8;
      this.ctx.beginPath();
      this.ctx.ellipse(p.x, p.y, r * 1.65, r * 0.44, -0.34, 0, Math.PI * 2);
      this.ctx.stroke();
    }
    if (active) {
      this.ctx.strokeStyle = 'rgba(242,239,233,.85)';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, r + 10 + Math.sin(this.time * 2) * 1.3, 0, Math.PI * 2);
      this.ctx.stroke();
    }
  }

  private drawLabels(): void {
    const boxes: Array<{ x: number; y: number; w: number; h: number }> = [];
    const ordered = [...this.nodes].sort(
      (a, b) =>
        (b.id === this.selectedId ? 1 : 0) - (a.id === this.selectedId ? 1 : 0) ||
        b.degree - a.degree,
    );
    for (const node of ordered) {
      const p = this.screen(node);
      const important = node.id === this.selectedId || node.id === this.hoveredId || node.degree >= 2;
      if (!important && this.zoom < 0.52) continue;
      this.ctx.font = '600 9px "Inter","Noto Sans SC",sans-serif';
      let label = node.title;
      const maxWidth = node.id === this.selectedId ? 140 : 106;
      while (this.ctx.measureText(label).width > maxWidth && label.length > 6) {
        label = label.slice(0, -1);
      }
      if (label !== node.title) label += '…';
      const w = this.ctx.measureText(label).width + 14;
      const h = 18;
      const x = p.x + node.radius * this.zoom + 7;
      const y = p.y - h / 2;
      const box = { x: x - 3, y: y - 2, w: w + 6, h: h + 4 };
      const collision = boxes.some(
        (b) =>
          !(
            box.x + box.w < b.x ||
            box.x > b.x + b.w ||
            box.y + box.h < b.y ||
            box.y > b.y + b.h
          ),
      );
      if (collision && node.id !== this.selectedId) continue;
      boxes.push(box);
      this.ctx.fillStyle =
        node.id === this.selectedId ? 'rgba(225,128,97,.16)' : 'rgba(5,7,13,.56)';
      this.roundRect(x, y, w, h, 7);
      this.ctx.fill();
      if (node.id === this.selectedId) {
        this.ctx.strokeStyle = 'rgba(225,128,97,.55)';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
      }
      this.ctx.fillStyle = node.id === this.selectedId ? '#f2efe9' : 'rgba(242,239,233,.72)';
      this.ctx.textAlign = 'left';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(label, x + 7, y + h / 2 + 0.5);
    }
  }

  private roundRect(x: number, y: number, w: number, h: number, r: number): void {
    this.ctx.beginPath();
    this.ctx.moveTo(x + r, y);
    this.ctx.arcTo(x + w, y, x + w, y + h, r);
    this.ctx.arcTo(x + w, y + h, x, y + h, r);
    this.ctx.arcTo(x, y + h, x, y, r);
    this.ctx.arcTo(x, y, x + w, y, r);
    this.ctx.closePath();
  }

  private lighten(hex: string, amount: number): string {
    return this.adjust(hex, amount);
  }

  private darken(hex: string, amount: number): string {
    return this.adjust(hex, -amount);
  }

  private adjust(hex: string, amount: number): string {
    const value = parseInt(hex.slice(1), 16);
    const clampChannel = (channel: number) => Math.max(0, Math.min(255, channel + Math.round(255 * amount)));
    return `rgb(${clampChannel((value >> 16) & 255)},${clampChannel((value >> 8) & 255)},${clampChannel(value & 255)})`;
  }

  private nodeAt(x: number, y: number): CosmicNode | null {
    for (let index = this.nodes.length - 1; index >= 0; index -= 1) {
      const node = this.nodes[index];
      if (!node) continue;
      const p = this.screen(node);
      const r = Math.max(11, node.radius * this.zoom);
      if ((x - p.x) ** 2 + (y - p.y) ** 2 <= (r + 8) ** 2) return node;
    }
    return null;
  }

  private toLocal(event: PointerEvent | MouseEvent | WheelEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  private bindEvents(): void {
    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.canvas.addEventListener('pointermove', this.handlePointerMove);
    this.canvas.addEventListener('pointerup', this.handlePointerUp);
    this.canvas.addEventListener('pointercancel', this.handlePointerUp);
    this.canvas.addEventListener('pointerleave', this.handlePointerLeave);
    this.canvas.addEventListener('wheel', this.handleWheel, { passive: false });
    this.canvas.addEventListener('dblclick', this.handleDoubleClick);
    this.canvas.addEventListener('click', this.handleClick);
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    const point = this.toLocal(event);
    this.lastPointer = point;
    this.moved = false;
    const node = this.nodeAt(point.x, point.y);
    if (node) {
      this.dragging = node;
      this.selectedId = node.id;
      this.options.onSelect(node.id);
    } else {
      this.panning = true;
    }
    this.canvas.setPointerCapture(event.pointerId);
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    const point = this.toLocal(event);
    if (this.dragging) {
      const dx = (point.x - this.lastPointer.x) / this.zoom;
      const dy = (point.y - this.lastPointer.y) / this.zoom;
      this.dragging.x += dx;
      this.dragging.y += dy;
      this.positions.set(this.dragging.id, { x: this.dragging.x, y: this.dragging.y });
      this.moved = true;
      this.lastPointer = point;
      this.draw();
      return;
    }
    if (this.panning) {
      this.panX += point.x - this.lastPointer.x;
      this.panY += point.y - this.lastPointer.y;
      this.moved = true;
      this.lastPointer = point;
      this.notifyViewport();
      this.draw();
      return;
    }
    const node = this.nodeAt(point.x, point.y);
    if ((node?.id ?? null) !== this.hoveredId) {
      this.hoveredId = node?.id ?? null;
      this.options.onHover?.(this.hoveredId);
      this.canvas.style.cursor = node ? 'pointer' : 'grab';
    }
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (this.dragging) {
      this.options.onNodeMoved?.(this.dragging.id, {
        x: this.dragging.x,
        y: this.dragging.y,
      });
    } else if (this.panning && !this.moved) {
      this.selectedId = null;
      this.options.onSelect(null);
    }
    this.dragging = null;
    this.panning = false;
    this.notifyViewport();
    this.canvas.releasePointerCapture?.(event.pointerId);
  };

  private readonly handlePointerLeave = (): void => {
    if (!this.dragging && !this.panning) {
      this.hoveredId = null;
      this.options.onHover?.(null);
    }
  };

  private readonly handleWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const point = this.toLocal(event);
    const beforeX = (point.x - this.panX) / this.zoom;
    const beforeY = (point.y - this.panY) / this.zoom;
    this.zoom = clamp(this.zoom * (event.deltaY > 0 ? 0.92 : 1.08), 0.22, 3.5);
    this.panX = point.x - beforeX * this.zoom;
    this.panY = point.y - beforeY * this.zoom;
    this.notifyViewport();
    this.draw();
  };

  private readonly handleDoubleClick = (event: MouseEvent): void => {
    const point = this.toLocal(event);
    const node = this.nodeAt(point.x, point.y);
    if (node) this.options.onDoubleClick?.(node.id);
  };

  private readonly handleClick = (event: MouseEvent): void => {
    const point = this.toLocal(event);
    const node = this.nodeAt(point.x, point.y);
    if (node) {
      this.selectedId = node.id;
      this.options.onSelect(node.id);
    } else if (!this.moved) {
      this.selectedId = null;
      this.options.onSelect(null);
    }
  };

  private notifyViewport(): void {
    if (this.viewportTimer !== null) clearTimeout(this.viewportTimer);
    this.viewportTimer = window.setTimeout(() => {
      this.options.onViewportChange?.(this.getViewport());
    }, 180);
  }
}
