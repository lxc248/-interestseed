import type { InterestSeedGraph, InterestSeedNode, NodeType } from '../types/graph';

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
    `我的兴趣星图：${graph.nodes.length} 个节点，${graph.edges.length} 条关系。`,
    topicLine,
    `#InterestSeed #兴趣星图 #${preset.id === 'x' ? '个人成长' : '自我探索'}`,
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

const CLUSTER_COLORS = ['#e6b66a', '#9c8cff', '#7dd9ad', '#5ed1df', '#e18061', '#ee82a4'];

function hash(value: string): number {
  let h = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    h ^= value.charCodeAt(index);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function shortLabel(title: string): string {
  const cut = title.search(/[：:，,。！？!?]/);
  let value = cut >= 3 && cut <= 20 ? title.slice(0, cut) : title;
  if (value.length > 16) value = `${value.slice(0, 16)}…`;
  return value;
}

function clusterKey(node: InterestSeedNode): string {
  const tags = node.tags.map((tag) => tag.toLowerCase());
  if (tags.includes('兴趣起跑')) return '兴趣起跑';
  if (tags.some((tag) => /美妆|穿搭|风格|护肤|妆容/.test(tag))) return '风格';
  if (tags.some((tag) => /游戏|玩家|虚拟世界|电竞/.test(tag))) return '游戏';
  if (tags.some((tag) => /运动|身体|健身|跑步/.test(tag))) return '身体';
  if (tags.includes('项目')) return '项目';
  return '探索';
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
 * No external images or fonts are used, so the resulting canvas is never
 * tainted and can be exported / copied without browser security errors.
 */
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
  const margin = Math.round(Math.min(width, height) * 0.07);
  const top = Math.round(height * 0.14);
  const bottom = height - Math.round(height * 0.10);
  const portrait = height > width;
  const graphTop = portrait ? top + 8 : top - 16;
  const graphBottom = bottom - 20;
  const graphHeight = Math.max(120, graphBottom - graphTop);

  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, '#070a14');
  background.addColorStop(0.58, '#0c1020');
  background.addColorStop(1, '#03050a');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  const nebula = ctx.createRadialGradient(
    width * 0.22,
    height * 0.34,
    0,
    width * 0.22,
    height * 0.34,
    width * 0.72,
  );
  nebula.addColorStop(0, 'rgba(139, 98, 198, .20)');
  nebula.addColorStop(0.45, 'rgba(72, 53, 120, .06)');
  nebula.addColorStop(1, 'rgba(3, 5, 10, 0)');
  ctx.fillStyle = nebula;
  ctx.fillRect(0, 0, width, height);

  const nebulaB = ctx.createRadialGradient(
    width * 0.82,
    height * 0.72,
    0,
    width * 0.82,
    height * 0.72,
    width * 0.62,
  );
  nebulaB.addColorStop(0, 'rgba(41, 137, 157, .13)');
  nebulaB.addColorStop(1, 'rgba(3, 5, 10, 0)');
  ctx.fillStyle = nebulaB;
  ctx.fillRect(0, 0, width, height);

  // Deterministic stars: same graph always yields the same card.
  for (let index = 0; index < 180; index += 1) {
    const x = hash(`star-x-${index}`) * width;
    const y = hash(`star-y-${index}`) * height;
    const size = hash(`star-size-${index}`) > 0.84 ? 1.6 : 0.75;
    ctx.save();
    ctx.globalAlpha = 0.10 + hash(`star-alpha-${index}`) * 0.38;
    ctx.fillStyle = index % 7 === 0 ? '#e8c884' : '#c8d6ed';
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  text(ctx, 'INTERESTSEED', margin, Math.round(height * 0.06), 12, '#b98f3c', 750);
  text(
    ctx,
    '我的兴趣星图',
    margin,
    Math.round(height * 0.095),
    portrait ? 46 : 40,
    '#f3f0e8',
    680,
  );

  const nodes = graph.nodes.slice(0, 22);
  const degrees = degreeMap(graph);
  const clusters = new Map<string, InterestSeedNode[]>();
  for (const node of nodes) {
    const key = clusterKey(node);
    const list = clusters.get(key) ?? [];
    list.push(node);
    clusters.set(key, list);
  }

  const centerX = width * 0.5;
  const centerY = graphTop + graphHeight * 0.49;
  const orbitX = width * (portrait ? 0.29 : 0.32);
  const orbitY = graphHeight * (portrait ? 0.33 : 0.3);
  const clusterList = [...clusters.entries()];
  const positions = new Map<string, { x: number; y: number }>();

  clusterList.forEach(([cluster, members], clusterIndex) => {
    const angle =
      (clusterIndex / Math.max(1, clusterList.length)) * Math.PI * 2 - Math.PI / 2;
    const cx = centerX + Math.cos(angle) * orbitX;
    const cy = centerY + Math.sin(angle) * orbitY;
    const color = CLUSTER_COLORS[clusterIndex % CLUSTER_COLORS.length] ?? '#e6b66a';
    ctx.save();
    ctx.globalAlpha = 0.13;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, cy, orbitX * 0.58, orbitY * 0.48, angle, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    members.forEach((node, memberIndex) => {
      const localAngle =
        (memberIndex / Math.max(1, members.length)) * Math.PI * 2 + hash(cluster) * 1.6;
      const radius = Math.min(orbitX * 0.34, 92 + members.length * 4);
      positions.set(node.id, {
        x: cx + Math.cos(localAngle) * radius,
        y: cy + Math.sin(localAngle) * radius * 0.74,
      });
    });
  });

  for (const edge of graph.edges) {
    if (edge.status === 'rejected') continue;
    const source = positions.get(edge.source);
    const target = positions.get(edge.target);
    if (!source || !target) continue;
    line(
      ctx,
      source.x,
      source.y,
      target.x,
      target.y,
      edge.status === 'suggested' ? '#b98f3c' : '#e8c884',
      edge.status === 'suggested' ? 0.9 : 1.2,
      edge.status === 'suggested' ? 0.18 : 0.30,
    );
  }

  // Central core.
  const coreRadius = Math.min(width, height) * 0.026;
  const coreGlow = ctx.createRadialGradient(
    centerX,
    centerY,
    0,
    centerX,
    centerY,
    coreRadius * 5,
  );
  coreGlow.addColorStop(0, 'rgba(255, 235, 185, .58)');
  coreGlow.addColorStop(0.25, 'rgba(232, 200, 132, .14)');
  coreGlow.addColorStop(1, 'rgba(232, 200, 132, 0)');
  ctx.fillStyle = coreGlow;
  ctx.beginPath();
  ctx.arc(centerX, centerY, coreRadius * 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f3dda5';
  ctx.beginPath();
  ctx.arc(centerX, centerY, coreRadius, 0, Math.PI * 2);
  ctx.fill();
  text(ctx, 'YOUR CORE', centerX, centerY + coreRadius * 2.8, 9, '#b98f3c', 700, 'center');

  for (const [clusterIndex, [, members]] of clusterList.entries()) {
    const color = CLUSTER_COLORS[clusterIndex % CLUSTER_COLORS.length] ?? '#e6b66a';
    for (const node of members) {
      const p = positions.get(node.id);
      if (!p) continue;
      const style = TYPE_STYLE[node.type];
      const radius =
        (node.type === 'project' ? 17 : node.type === 'topic' ? 13 : 10) +
        Math.min(5, (degrees.get(node.id) ?? 0) * 0.5);
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius * 3.2);
      glow.addColorStop(0, `${style.color}66`);
      glow.addColorStop(1, `${style.color}00`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius * 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = style.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(5, 8, 15, .55)';
      ctx.beginPath();
      ctx.arc(p.x + radius * 0.26, p.y + radius * 0.22, radius * 0.86, -1.5, 2.5);
      ctx.fill();
    }
    const clusterPosition = members[0] ? positions.get(members[0].id) : undefined;
    if (clusterPosition) {
      text(
        ctx,
        `${members.length} 个`,
        clusterPosition.x,
        clusterPosition.y + 34,
        11,
        color,
        650,
        'center',
      );
    }
  }

  // Cap labels by visual importance and skip collisions. The nodes remain
  // visible; the card stays legible even on a dense graph.
  const labelLimit = portrait ? 10 : 8;
  const labelCandidates = [...nodes]
    .sort((left, right) => (degrees.get(right.id) ?? 0) - (degrees.get(left.id) ?? 0))
    .slice(0, labelLimit);
  const labelBoxes: Array<{ x: number; y: number; w: number; h: number }> = [];
  for (const node of labelCandidates) {
    const p = positions.get(node.id);
    if (!p) continue;
    const style = TYPE_STYLE[node.type];
    const radius =
      (node.type === 'project' ? 17 : node.type === 'topic' ? 13 : 10) +
      Math.min(5, (degrees.get(node.id) ?? 0) * 0.5);
    const label = shortLabel(node.title);
    ctx.font = `${540} ${portrait ? 15 : 13}px "Inter", "Noto Sans SC", sans-serif`;
    const labelWidth = ctx.measureText(label).width;
    const box = {
      x: p.x + radius + 8,
      y: p.y - 12,
      w: labelWidth + 8,
      h: 20,
    };
    if (box.x + box.w > width - margin) {
      box.x = p.x - radius - 8 - box.w;
    }
    if (box.x < margin) continue;
    const collides = labelBoxes.some(
      (other) =>
        box.x < other.x + other.w &&
        box.x + box.w > other.x &&
        box.y < other.y + other.h &&
        box.y + box.h > other.y,
    );
    if (collides) continue;
    labelBoxes.push(box);
    text(
      ctx,
      label,
      box.x,
      p.y + 3,
      portrait ? 15 : 13,
      '#f0eee8',
      540,
    );
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = style.color;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(p.x + radius * 0.8, p.y);
    ctx.lineTo(box.x, p.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  const summary = `${graph.nodes.length} 个兴趣节点  ·  ${graph.edges.length} 条关系`;
  text(ctx, summary, width / 2, bottom + 4, portrait ? 17 : 15, '#9ba6b9', 480, 'center');

  if (portrait) {
    text(
      ctx,
      '不是收藏，是看见自己的路线。',
      width / 2,
      bottom + 32,
      15,
      '#b98f3c',
      500,
      'center',
    );
  }
  ctx.save();
  ctx.globalAlpha = 0.7;
  text(
    ctx,
    'InterestSeed  ·  把刷到的内容长成星图',
    margin,
    height - Math.round(height * 0.028),
    11,
    '#9ba6b9',
    450,
  );
  text(
    ctx,
    preset.shortLabel,
    width - margin,
    height - Math.round(height * 0.028),
    11,
    '#b98f3c',
    650,
    'right',
  );
  ctx.restore();

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
