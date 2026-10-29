import type { InterestSeedGraph, NodeType } from '../types/graph';

export type SharePlatform = 'xiaohongshu' | 'instagram' | 'x' | 'wechat' | 'story';

export interface SharePreset {
  id: SharePlatform;
  label: string;
  shortLabel: string;
  width: number;
  height: number;
  description: string;
}

export const SHARE_PRESETS: readonly SharePreset[] = [
  {
    id: 'xiaohongshu',
    label: '小红书',
    shortLabel: '小红书 3:4',
    width: 1080,
    height: 1440,
    description: '1080 × 1440 · 小红书 / 竖版信息流',
  },
  {
    id: 'instagram',
    label: 'Instagram',
    shortLabel: 'Instagram 4:5',
    width: 1080,
    height: 1350,
    description: '1080 × 1350 · Instagram / 竖版',
  },
  {
    id: 'x',
    label: 'X / 微博',
    shortLabel: 'X 16:9',
    width: 1600,
    height: 900,
    description: '1600 × 900 · X / 微博 / 横版',
  },
  {
    id: 'wechat',
    label: '微信朋友圈',
    shortLabel: '朋友圈 1:1',
    width: 1080,
    height: 1080,
    description: '1080 × 1080 · 朋友圈 / 方图',
  },
  {
    id: 'story',
    label: 'Story',
    shortLabel: 'Story 9:16',
    width: 1080,
    height: 1920,
    description: '1080 × 1920 · Story / 竖屏',
  },
];

export function getSharePreset(id: SharePlatform): SharePreset {
  return SHARE_PRESETS.find((preset) => preset.id === id) ?? SHARE_PRESETS[0]!;
}

export function shareCardFilename(preset: SharePreset): string {
  return `interestseed-star-map-${preset.id}-${preset.width}x${preset.height}.png`;
}

export function buildShareCaption(graph: InterestSeedGraph, preset: SharePreset): string {
  const ignored = new Set(['火花', '视频', '文本', '主题', '兴趣起跑', '项目', '下一步']);
  const counts = new Map<string, number>();
  for (const node of graph.nodes) {
    for (const tag of node.tags) {
      if (ignored.has(tag)) continue;
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  const topics = [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'zh'))
    .slice(0, 4)
    .map(([tag]) => tag);
  const topicLine = topics.length > 0 ? `最近在关注：${topics.join('、')}。` : '';
  return [
    `我把 ${graph.nodes.length} 个兴趣，先验证 1 个。`,
    `星图：${graph.nodes.length} 个节点，${graph.edges.length} 条关系。`,
    topicLine,
    `#InterestSeed #兴趣验证 #${preset.id === 'x' ? '个人成长' : '自我探索'}`,
  ]
    .filter(Boolean)
    .join('\n');
}

interface Palette {
  color: string;
  glyph: string;
}

const TYPE_STYLE: Record<NodeType, Palette> = {
  project: { color: '#e18061', glyph: '项' },
  document: { color: '#5ed1df', glyph: '文' },
  topic: { color: '#9c8cff', glyph: '主' },
  image: { color: '#e6b66a', glyph: '图' },
  audio: { color: '#ee82a4', glyph: '音' },
  video: { color: '#ee82a4', glyph: '视' },
  activity: { color: '#7dd9ad', glyph: '活' },
};

function hash(value: string): number {
  let h = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    h ^= value.charCodeAt(index);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function shareTopics(graph: InterestSeedGraph, limit = 3): string[] {
  const ignored = new Set(['火花', '视频', '文本', '主题', '兴趣起跑', '项目', '下一步']);
  const counts = new Map<string, number>();
  for (const node of graph.nodes) {
    for (const tag of node.tags) {
      if (ignored.has(tag)) continue;
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'zh'))
    .slice(0, limit)
    .map(([tag]) => tag);
}

function shortLabel(title: string, limit = 16): string {
  const cut = title.search(/[：:，,。！？!?]/);
  let value = cut >= 3 && cut <= 20 ? title.slice(0, cut) : title;
  if (value.length > limit) value = `${value.slice(0, limit)}…`;
  return value;
}

function degreeMap(graph: InterestSeedGraph): Map<string, number> {
  const degrees = new Map<string, number>();
  for (const node of graph.nodes) degrees.set(node.id, 0);
  for (const edge of graph.edges) {
    if (edge.status === 'rejected') continue;
    degrees.set(edge.source, (degrees.get(edge.source) ?? 0) + 1);
    degrees.set(edge.target, (degrees.get(edge.target) ?? 0) + 1);
  }
  return degrees;
}

function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  size: number,
  color: string,
  weight = 500,
  align: CanvasTextAlign = 'left',
): void {
  ctx.font = `${weight} ${size}px "Inter", "Noto Sans SC", "PingFang SC", sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(value, x, y);
}

function line(
  ctx: CanvasRenderingContext2D,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  stroke: string,
  width: number,
  alpha: number,
): void {
  const mx = (ax + bx) / 2 + (ay - by) * 0.08;
  const my = (ay + by) / 2 + (bx - ax) * 0.08;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.quadraticCurveTo(mx, my, bx, by);
  ctx.stroke();
  ctx.restore();
}

/**
 * A platform-safe, deterministic share card.
 *
 * The card is composed for a phone thumbnail first: one focal number, one
 * readable promise, then the constellation as supporting evidence. No external
 * images or fonts are used, so the canvas is never tainted.
 */

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function roundedPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): void {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fillRounded(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  radius: number,
  fill: string | CanvasGradient,
  stroke?: string,
): void {
  roundedPath(ctx, rect.x, rect.y, rect.w, rect.h, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawPill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  fill: string,
  color: string,
  border: string,
  size = 12,
): number {
  ctx.font = `650 ${size}px "Inter", "Noto Sans SC", "PingFang SC", sans-serif`;
  const padding = Math.round(size * 0.72);
  const width = Math.ceil(ctx.measureText(label).width) + padding * 2;
  const height = Math.round(size * 2.15);
  fillRounded(ctx, { x, y, w: width, h: height }, height / 2, fill, border);
  text(ctx, label, x + padding, y + height * 0.68, size, color, 650);
  return width;
}

function drawStat(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  value: string,
  label: string,
  sub: string,
  accent: string,
  compact = false,
): void {
  fillRounded(ctx, rect, 14, 'rgba(255,255,255,.035)', 'rgba(216,226,244,.12)');
  if (compact) {
    text(ctx, value, rect.x + 16, rect.y + 27, 28, accent, 720);
    text(ctx, label, rect.x + 16, rect.y + 48, 12, '#e6e2d8', 650);
    return;
  }
  text(ctx, value, rect.x + 18, rect.y + 44, 38, accent, 720);
  text(ctx, label, rect.x + 18, rect.y + 70, 14, '#e6e2d8', 650);
  text(ctx, sub, rect.x + 18, rect.y + 90, 11, '#8995a9', 500);
}

function drawGraphPanel(
  ctx: CanvasRenderingContext2D,
  graph: InterestSeedGraph,
  rect: Rect,
  portrait: boolean,
): void {
  fillRounded(ctx, rect, 20, 'rgba(7,12,22,.72)', 'rgba(216,226,244,.12)');
  ctx.save();
  ctx.globalAlpha = 0.42;
  ctx.strokeStyle = 'rgba(232,200,132,.18)';
  ctx.lineWidth = 1;
  roundedPath(ctx, rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2, 19);
  ctx.stroke();
  ctx.restore();

  text(ctx, 'YOUR INTEREST MAP', rect.x + 20, rect.y + 28, 10, '#b98f3c', 750);
  text(
    ctx,
    `${graph.nodes.length} 个节点 · ${graph.edges.filter((edge) => edge.status !== 'rejected').length} 条关系`,
    rect.x + rect.w - 20,
    rect.y + 28,
    10,
    '#8793a8',
    500,
    'right',
  );

  const degrees = degreeMap(graph);
  const candidates = [...graph.nodes]
    .sort((left, right) => (degrees.get(right.id) ?? 0) - (degrees.get(left.id) ?? 0))
    .slice(0, portrait ? 11 : 9);
  const centerX = rect.x + rect.w * 0.5;
  const centerY = rect.y + rect.h * 0.53;
  const radiusX = rect.w * 0.33;
  const radiusY = rect.h * 0.31;
  const positions = new Map<string, { x: number; y: number }>();

  // Faint orbital grid: enough structure to feel designed, not like a chart.
  ctx.save();
  ctx.strokeStyle = 'rgba(174,188,214,.12)';
  ctx.lineWidth = 1;
  for (const scale of [0.55, 0.88]) {
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radiusX * scale, radiusY * scale, -0.08, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  candidates.forEach((node, index) => {
    const angle = (index / Math.max(1, candidates.length)) * Math.PI * 2 - Math.PI / 2;
    const ring = 0.72 + (index % 3) * 0.12;
    positions.set(node.id, {
      x: centerX + Math.cos(angle) * radiusX * ring,
      y: centerY + Math.sin(angle) * radiusY * ring,
    });
  });

  const ids = new Set(candidates.map((node) => node.id));
  for (const edge of graph.edges) {
    if (edge.status === 'rejected' || !ids.has(edge.source) || !ids.has(edge.target)) continue;
    const source = positions.get(edge.source);
    const target = positions.get(edge.target);
    if (!source || !target) continue;
    line(
      ctx,
      source.x,
      source.y,
      target.x,
      target.y,
      edge.status === 'suggested' ? '#b98f3c' : '#d7c18a',
      edge.status === 'suggested' ? 0.8 : 1.1,
      edge.status === 'suggested' ? 0.16 : 0.28,
    );
  }

  const coreRadius = Math.max(5, Math.min(rect.w, rect.h) * 0.018);
  const glow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, coreRadius * 6);
  glow.addColorStop(0, 'rgba(255,235,185,.55)');
  glow.addColorStop(0.35, 'rgba(232,200,132,.10)');
  glow.addColorStop(1, 'rgba(232,200,132,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(centerX, centerY, coreRadius * 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f3dda5';
  ctx.beginPath();
  ctx.arc(centerX, centerY, coreRadius, 0, Math.PI * 2);
  ctx.fill();

  const labelBoxes: Rect[] = [];
  candidates.forEach((node, index) => {
    const p = positions.get(node.id);
    if (!p) return;
    const style = TYPE_STYLE[node.type];
    const radius =
      (node.type === 'project' ? 14 : node.type === 'topic' ? 11 : 8) +
      Math.min(4, (degrees.get(node.id) ?? 0) * 0.35);
    const nodeGlow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius * 3.5);
    nodeGlow.addColorStop(0, `${style.color}88`);
    nodeGlow.addColorStop(1, `${style.color}00`);
    ctx.fillStyle = nodeGlow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius * 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = style.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(5,8,15,.48)';
    ctx.beginPath();
    ctx.arc(p.x + radius * 0.28, p.y + radius * 0.22, radius * 0.84, -1.5, 2.5);
    ctx.fill();

    // Place labels in a clear slot around the node. A label may never cover
    // another node: on a phone thumbnail that reads as visual noise.
    if (index < 5) {
      const label = shortLabel(node.title, portrait ? 11 : 10);
      const labelSize = portrait ? 16 : 14;
      ctx.font = `600 ${labelSize}px "Inter", "Noto Sans SC", "PingFang SC", sans-serif`;
      const labelWidth = Math.ceil(ctx.measureText(label).width) + 14;
      const labelHeight = 26;
      const candidates: Rect[] = [
        { x: p.x + radius + 8, y: p.y - 13, w: labelWidth, h: labelHeight },
        { x: p.x - radius - 8 - labelWidth, y: p.y - 13, w: labelWidth, h: labelHeight },
        { x: p.x - labelWidth / 2, y: p.y - radius - 8 - labelHeight, w: labelWidth, h: labelHeight },
        { x: p.x - labelWidth / 2, y: p.y + radius + 8, w: labelWidth, h: labelHeight },
      ];
      let chosen: Rect | null = null;
      for (const candidateRect of candidates) {
        if (
          candidateRect.x < rect.x + 10 ||
          candidateRect.x + candidateRect.w > rect.x + rect.w - 10 ||
          candidateRect.y < rect.y + 42 ||
          candidateRect.y + candidateRect.h > rect.y + rect.h - 34
        ) {
          continue;
        }
        const overlapsLabel = labelBoxes.some(
          (other) =>
            candidateRect.x < other.x + other.w &&
            candidateRect.x + candidateRect.w > other.x &&
            candidateRect.y < other.y + other.h &&
            candidateRect.y + candidateRect.h > other.y,
        );
        const overlapsNode = [...positions.entries()].some(([otherId, other]) => {
          if (otherId === node.id) return false;
          return (
            other.x > candidateRect.x - 9 &&
            other.x < candidateRect.x + candidateRect.w + 9 &&
            other.y > candidateRect.y - 9 &&
            other.y < candidateRect.y + candidateRect.h + 9
          );
        });
        if (!overlapsLabel && !overlapsNode) {
          chosen = candidateRect;
          break;
        }
      }
      if (!chosen) return;
      labelBoxes.push(chosen);
      fillRounded(ctx, chosen, 13, 'rgba(5,10,18,.90)', `${style.color}66`);
      text(ctx, label, chosen.x + 7, chosen.y + 18, labelSize, '#f0eee8', 600);
    }
  });

  text(
    ctx,
    '证据不是更多内容，是真实做过。',
    rect.x + 20,
    rect.y + rect.h - 22,
    11,
    '#9ba6b9',
    500,
  );
}

function drawSteps(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
): void {
  const gap = 10;
  const cardWidth = (width - gap * 2) / 3;
  const steps = [
    { number: '01', title: '收藏', detail: '先留下一条', color: '#e8c884' },
    { number: '02', title: '验证', detail: '做 3 天看看', color: '#7dd9ad' },
    { number: '03', title: '决定', detail: '继续或放下', color: '#b69cff' },
  ];
  steps.forEach((step, index) => {
    const rect: Rect = {
      x: x + index * (cardWidth + gap),
      y,
      w: cardWidth,
      h: 78,
    };
    fillRounded(ctx, rect, 12, 'rgba(255,255,255,.025)', 'rgba(216,226,244,.10)');
    text(ctx, step.number, rect.x + 14, rect.y + 22, 10, step.color, 750);
    text(ctx, step.title, rect.x + 14, rect.y + 47, 17, '#f0eee8', 650);
    text(ctx, step.detail, rect.x + 14, rect.y + 65, 11, '#8995a9', 500);
  });
}

function drawPortraitCard(
  ctx: CanvasRenderingContext2D,
  graph: InterestSeedGraph,
  preset: SharePreset,
): void {
  const width = preset.width;
  const height = preset.height;
  const margin = Math.round(Math.min(width, height) * 0.07);
  const titleSize = Math.round(Math.min(width * 0.084, height * 0.062));
  const titleTop = Math.round(height * 0.135);
  const subTop = titleTop + Math.round(titleSize * 2.04);
  const statTop = subTop + 34;
  const statHeight = 108;
  const graphTop = statTop + statHeight + 36;
  const graphBottom = height - Math.round(height * 0.265);
  const graphRect: Rect = {
    x: margin,
    y: graphTop,
    w: width - margin * 2,
    h: Math.max(180, graphBottom - graphTop),
  };

  text(ctx, 'INTERESTSEED  ·  3-DAY PROOF', margin, Math.round(height * 0.055), 12, '#b98f3c', 750);
  drawPill(
    ctx,
    width - margin - 126,
    Math.round(height * 0.038),
    'PROOF, NOT COLLECTION',
    'rgba(232,200,132,.10)',
    '#e8c884',
    'rgba(232,200,132,.28)',
    9,
  );

  text(ctx, `${graph.nodes.length} 个兴趣`, margin, titleTop, titleSize, '#f3f0e8', 720);
  text(ctx, '我先验证 1 个', margin, titleTop + Math.round(titleSize * 1.02), titleSize, '#f3f0e8', 720);
  text(ctx, '不是收藏更多，是知道哪个值得做。', margin, subTop, 25, '#aeb8c8', 500);

  const confirmed = graph.edges.filter((edge) => edge.status === 'confirmed').length;
  const statW = (graphRect.w - 20) / 3;
  const stats = [
    { value: `${graph.nodes.length}`, label: '个兴趣', sub: '在星图里' },
    { value: `${confirmed}`, label: '条确认关系', sub: '不是 AI 猜测' },
    { value: '3', label: '天真实行动', sub: '决定继续或放下' },
  ];
  stats.forEach((stat, index) => {
    drawStat(
      ctx,
      { x: margin + index * (statW + 10), y: statTop, w: statW, h: statHeight },
      stat.value,
      stat.label,
      stat.sub,
      index === 0 ? '#e8c884' : index === 1 ? '#7dd9ad' : '#9c8cff',
    );
  });

  drawGraphPanel(ctx, graph, graphRect, true);

  const quoteY = graphRect.y + graphRect.h + 52;
  text(ctx, '别收藏更多，验证一个。', width / 2, quoteY, 31, '#f3e5c0', 680, 'center');
  text(
    ctx,
    'InterestSeed  ·  把刷到的内容，变成 3 天真实行动',
    width / 2,
    quoteY + 30,
    15,
    '#8995a9',
    500,
    'center',
  );

  drawSteps(ctx, margin, quoteY + 62, graphRect.w);

  const topics = shareTopics(graph, 3);
  if (topics.length > 0) {
    text(
      ctx,
      `最近在关注 · ${topics.join(' · ')}`,
      margin,
      height - 74,
      13,
      '#b98f3c',
      600,
    );
  }

  ctx.save();
  ctx.globalAlpha = 0.78;
  text(ctx, '本地优先  ·  人做决定  ·  Agent 只读', margin, height - 36, 11, '#8995a9', 500);
  text(ctx, preset.shortLabel, width - margin, height - 36, 11, '#b98f3c', 650, 'right');
  ctx.restore();
}

function drawLandscapeCard(
  ctx: CanvasRenderingContext2D,
  graph: InterestSeedGraph,
  preset: SharePreset,
): void {
  const width = preset.width;
  const height = preset.height;
  const margin = Math.round(Math.min(width, height) * 0.075);
  const leftWidth = Math.round(width * 0.42);
  const panelX = margin + leftWidth + 40;
  const panelRect: Rect = {
    x: panelX,
    y: margin + 24,
    w: width - margin - panelX,
    h: height - margin * 2 - 24,
  };
  const titleSize = 62;

  text(ctx, 'INTERESTSEED  ·  3-DAY PROOF', margin, margin + 8, 12, '#b98f3c', 750);
  text(ctx, `${graph.nodes.length} 个兴趣`, margin, margin + 112, titleSize, '#f3f0e8', 720);
  text(ctx, '我先验证 1 个', margin, margin + 112 + 66, titleSize, '#f3f0e8', 720);
  text(ctx, '不是收藏更多，是知道哪个值得做。', margin, margin + 230, 22, '#aeb8c8', 500);

  const confirmed = graph.edges.filter((edge) => edge.status === 'confirmed').length;
  const stats = [
    { value: `${graph.nodes.length}`, label: '个兴趣', sub: '在星图里' },
    { value: `${confirmed}`, label: '条确认关系', sub: '不是 AI 猜测' },
    { value: '3', label: '天真实行动', sub: '继续或放下' },
  ];
  stats.forEach((stat, index) => {
    drawStat(
      ctx,
      { x: margin, y: margin + 270 + index * 70, w: leftWidth, h: 60 },
      stat.value,
      stat.label,
      stat.sub,
      index === 0 ? '#e8c884' : index === 1 ? '#7dd9ad' : '#9c8cff',
      true,
    );
  });

  drawGraphPanel(ctx, graph, panelRect, false);

  const topics = shareTopics(graph, 3);
  if (topics.length > 0) {
    text(ctx, `最近在关注 · ${topics.join(' · ')}`, margin, height - 112, 12, '#b98f3c', 600);
  }
  text(ctx, '别收藏更多，验证一个。', margin, height - 74, 24, '#f3e5c0', 680);
  text(ctx, 'InterestSeed  ·  把刷到的内容，变成 3 天真实行动', margin, height - 44, 13, '#8995a9', 500);
  text(ctx, preset.shortLabel, width - margin, height - 30, 11, '#b98f3c', 650, 'right');
}

export function renderShareCard(
  graph: InterestSeedGraph,
  preset: SharePreset,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = preset.width;
  canvas.height = preset.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('当前环境不支持 Canvas 2D。');

  const width = canvas.width;
  const height = canvas.height;
  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, '#060914');
  background.addColorStop(0.52, '#0b1120');
  background.addColorStop(1, '#03050a');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  const nebula = ctx.createRadialGradient(
    width * 0.18,
    height * 0.18,
    0,
    width * 0.18,
    height * 0.18,
    width * 0.82,
  );
  nebula.addColorStop(0, 'rgba(158, 95, 190, .22)');
  nebula.addColorStop(0.45, 'rgba(72, 53, 120, .07)');
  nebula.addColorStop(1, 'rgba(3, 5, 10, 0)');
  ctx.fillStyle = nebula;
  ctx.fillRect(0, 0, width, height);

  const teal = ctx.createRadialGradient(
    width * 0.88,
    height * 0.74,
    0,
    width * 0.88,
    height * 0.74,
    width * 0.66,
  );
  teal.addColorStop(0, 'rgba(38, 156, 170, .14)');
  teal.addColorStop(1, 'rgba(3, 5, 10, 0)');
  ctx.fillStyle = teal;
  ctx.fillRect(0, 0, width, height);

  for (let index = 0; index < 220; index += 1) {
    const x = hash(`star-x-${index}`) * width;
    const y = hash(`star-y-${index}`) * height;
    const size = hash(`star-size-${index}`) > 0.86 ? 1.6 : 0.7;
    ctx.save();
    ctx.globalAlpha = 0.08 + hash(`star-alpha-${index}`) * 0.34;
    ctx.fillStyle = index % 8 === 0 ? '#e8c884' : '#c8d6ed';
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Fine editorial frame.
  ctx.save();
  ctx.globalAlpha = 0.34;
  ctx.strokeStyle = 'rgba(232, 200, 132, .24)';
  ctx.lineWidth = 1;
  const frame = Math.round(Math.min(width, height) * 0.025);
  ctx.strokeRect(frame, frame, width - frame * 2, height - frame * 2);
  ctx.restore();

  if (height > width) {
    drawPortraitCard(ctx, graph, preset);
  } else {
    drawLandscapeCard(ctx, graph, preset);
  }

  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('导出图片失败。'));
    }, 'image/png');
  });
}
