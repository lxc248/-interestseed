export function createGraphView({ state, $, svgNS, svgEl, nodeTitle, chainStateOf, chainMeta, render }) {
function renderGraph() {
  const graph = state.data.graph;
  const svg = document.getElementById('graph');
  svg.innerHTML = '';
  const width = 820;
  const height = 560;
  const cx = width / 2;
  const cy = height / 2;
  const allNodes = graph.nodes;
  if (!allNodes.length) {
    svg.appendChild(svgEl('text', {
      x: cx, y: cy, fill: '#8b96ad', 'text-anchor': 'middle', 'font-size': 13,
      text: '扫描一个 Markdown vault，星系会出现在这里。',
    }));
    return;
  }

  const query = state.query.trim().toLowerCase();
  const nodes = allNodes.filter((node) => {
    if (state.filterStage !== 'all' && chainStateOf(node.id) !== state.filterStage) return false;
    if (!query) return true;
    return `${node.title} ${(node.tags ?? []).join(' ')}`.toLowerCase().includes(query);
  });
  if (!nodes.length) {
    svg.appendChild(svgEl('text', {
      x: cx, y: cy, fill: '#8b96ad', 'text-anchor': 'middle', 'font-size': 13,
      text: query ? `没有匹配「${state.query.trim()}」的节点。` : '这个阶段还没有节点。',
    }));
    return;
  }

  const degree = new Map(nodes.map((node) => [node.id, 0]));
  for (const edge of graph.edges) {
    if (edge.status === 'rejected') continue;
    if (!degree.has(edge.source) || !degree.has(edge.target)) continue;
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
  }
  const selected = nodes.find((node) => node.id === state.selectedId)
    ?? [...nodes].sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0))[0];
  if (state.selectedId !== selected.id) state.selectedId = selected.id;
  const others = nodes
    .filter((node) => node.id !== selected.id)
    .sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0));

  const positions = new Map();
  positions.set(selected.id, { x: cx, y: cy });
  const ringCounts = [Math.min(7, others.length), Math.max(0, others.length - 7)];
  let cursor = 0;
  for (let ring = 0; ring < ringCounts.length; ring += 1) {
    const count = ringCounts[ring];
    if (!count) continue;
    const rx = 185 + ring * 95;
    const ry = 125 + ring * 68;
    for (let index = 0; index < count; index += 1) {
      const node = others[cursor];
      cursor += 1;
      if (!node) break;
      const angle = -Math.PI / 2 + (index / count) * Math.PI * 2 + ring * 0.34;
      positions.set(node.id, {
        x: cx + Math.cos(angle) * rx,
        y: cy + Math.sin(angle) * ry,
      });
    }
  }

  const defs = svgEl('defs');
  defs.innerHTML = `
    <radialGradient id="space-bg" cx="50%" cy="46%" r="78%">
      <stop offset="0%" stop-color="#11172b"/>
      <stop offset="45%" stop-color="#090d18"/>
      <stop offset="100%" stop-color="#05070d"/>
    </radialGradient>
    <radialGradient id="nebula-violet" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#8b5cf6" stop-opacity=".18"/>
      <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="nebula-cyan" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#22d3ee" stop-opacity=".12"/>
      <stop offset="100%" stop-color="#22d3ee" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="star-halo" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#fef3c7" stop-opacity=".55"/>
      <stop offset="42%" stop-color="#fbbf24" stop-opacity=".18"/>
      <stop offset="100%" stop-color="#f59e0b" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="planet-document" cx="32%" cy="28%" r="72%">
      <stop offset="0%" stop-color="#e0f2fe"/>
      <stop offset="34%" stop-color="#38bdf8"/>
      <stop offset="82%" stop-color="#0369a1"/>
      <stop offset="100%" stop-color="#082f49"/>
    </radialGradient>
    <radialGradient id="planet-project" cx="32%" cy="28%" r="72%">
      <stop offset="0%" stop-color="#f5f3ff"/>
      <stop offset="34%" stop-color="#a78bfa"/>
      <stop offset="82%" stop-color="#6d28d9"/>
      <stop offset="100%" stop-color="#2e1065"/>
    </radialGradient>
    <radialGradient id="planet-topic" cx="32%" cy="28%" r="72%">
      <stop offset="0%" stop-color="#ecfdf5"/>
      <stop offset="34%" stop-color="#34d399"/>
      <stop offset="82%" stop-color="#047857"/>
      <stop offset="100%" stop-color="#022c22"/>
    </radialGradient>
    <radialGradient id="planet-captured" cx="32%" cy="28%" r="72%">
      <stop offset="0%" stop-color="#f1f5f9"/>
      <stop offset="34%" stop-color="#94a3b8"/>
      <stop offset="82%" stop-color="#475569"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </radialGradient>
    <radialGradient id="planet-connected" cx="32%" cy="28%" r="72%">
      <stop offset="0%" stop-color="#e0f2fe"/>
      <stop offset="34%" stop-color="#38bdf8"/>
      <stop offset="82%" stop-color="#0369a1"/>
      <stop offset="100%" stop-color="#082f49"/>
    </radialGradient>
    <radialGradient id="planet-experimenting" cx="32%" cy="28%" r="72%">
      <stop offset="0%" stop-color="#ecfdf5"/>
      <stop offset="34%" stop-color="#34d399"/>
      <stop offset="82%" stop-color="#047857"/>
      <stop offset="100%" stop-color="#022c22"/>
    </radialGradient>
    <radialGradient id="planet-reviewed" cx="32%" cy="28%" r="72%">
      <stop offset="0%" stop-color="#f5f3ff"/>
      <stop offset="34%" stop-color="#a78bfa"/>
      <stop offset="82%" stop-color="#6d28d9"/>
      <stop offset="100%" stop-color="#2e1065"/>
    </radialGradient>
    <filter id="soft-glow" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="node-glow" x="-120%" y="-120%" width="340%" height="340%">
      <feGaussianBlur stdDeviation="3.5" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  `;
  svg.appendChild(defs);
  svg.appendChild(svgEl('rect', { x: 0, y: 0, width, height, fill: 'url(#space-bg)' }));
  svg.appendChild(svgEl('ellipse', {
    cx: cx - 80, cy: cy - 60, rx: 340, ry: 230, fill: 'url(#nebula-violet)',
  }));
  svg.appendChild(svgEl('ellipse', {
    cx: cx + 230, cy: cy + 150, rx: 280, ry: 190, fill: 'url(#nebula-cyan)',
  }));

  for (let index = 0; index < 150; index += 1) {
    const x = (index * 149.3 + 41) % width;
    const y = (index * 211.7 + 17) % height;
    const radius = 0.35 + ((index * 17) % 10) / 10;
    svg.appendChild(svgEl('circle', {
      cx: x, cy: y, r: radius, fill: '#e2e8f0',
      opacity: 0.18 + ((index * 13) % 40) / 100,
      class: 'star',
      style: `animation-delay: ${(index * 173) % 5000}ms`,
    }));
  }

  for (let ring = 0; ring < 3; ring += 1) {
    svg.appendChild(svgEl('ellipse', {
      cx, cy,
      rx: 138 + ring * 82,
      ry: 94 + ring * 57,
      fill: 'none',
      class: 'orbit',
      opacity: 0.9 - ring * 0.18,
    }));
  }
  svg.appendChild(svgEl('circle', {
    cx, cy, r: 58, fill: 'url(#star-halo)', opacity: 0.9,
  }));

  const neighborIds = new Set();
  for (const edge of graph.edges) {
    if (edge.source === selected.id) neighborIds.add(edge.target);
    if (edge.target === selected.id) neighborIds.add(edge.source);
  }
  for (const edge of graph.edges) {
    if (!positions.has(edge.source) || !positions.has(edge.target)) continue;
    const from = positions.get(edge.source);
    const to = positions.get(edge.target);
    if (!from || !to) continue;
    const touchesFocus = edge.source === selected.id || edge.target === selected.id;
    const mx = (from.x + to.x) / 2;
    const my = (from.y + to.y) / 2;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const bend = Math.min(46, distance * 0.14);
    const controlX = mx - (dy / distance) * bend;
    const controlY = my + (dx / distance) * bend;
    svg.appendChild(svgEl('path', {
      d: `M ${from.x} ${from.y} Q ${controlX} ${controlY} ${to.x} ${to.y}`,
      class: `edge ${edge.status === 'confirmed' ? 'confirmed' : ''} ${String(edge.relation ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-')} ${touchesFocus ? 'focus-edge' : ''}`,
      'fill': 'none',
    }));
  }

  for (const node of nodes) {
    const pos = positions.get(node.id);
    if (!pos) continue;
    const isSelected = node.id === selected.id;
    const isNeighbor = neighborIds.has(node.id);
    const stage = chainStateOf(node.id);
    const stageMeta = chainMeta(stage);
    const r = isSelected ? 24 : Math.min(16, 8 + (degree.get(node.id) ?? 0) * 1.3);
    const group = svgEl('g', {
      class: `node ${isSelected ? 'selected' : ''} ${!isSelected && !isNeighbor ? 'dimmed' : ''} chain-${stage}`,
      transform: `translate(${pos.x}, ${pos.y})`,
      tabindex: 0,
    });
    group.addEventListener('click', () => {
      state.selectedId = node.id;
      state.suggestions = [];
      state.index = 0;
      state.lastConnected = null;
      state.aiError = null;
      render();
    });
    group.appendChild(svgEl('title', {})).textContent = `${node.title} · ${stageMeta.label}`;
    if (isSelected) {
      group.appendChild(svgEl('circle', { r: r + 17, fill: 'url(#star-halo)', class: 'sun-halo' }));
      group.appendChild(svgEl('circle', { r: r + 8, fill: 'none', class: 'selected-ring' }));
    }
    group.appendChild(svgEl('circle', {
      r, fill: `url(#${stageMeta.gradient})`,
      class: 'planet', filter: 'url(#node-glow)',
    }));
    group.appendChild(svgEl('ellipse', {
      cx: -r * 0.32, cy: -r * 0.34, rx: r * 0.38, ry: r * 0.22,
      fill: '#ffffff', opacity: 0.55, class: 'planet-shine',
    }));
    if (node.type === 'project') {
      group.appendChild(svgEl('ellipse', {
        rx: r * 1.9, ry: r * 0.55, fill: 'none',
        stroke: '#c4b5fd', 'stroke-width': 1.2, opacity: 0.55,
        transform: 'rotate(-20)', class: 'planet-ring',
      }));
    }
    const label = svgEl('text', {
      x: isSelected ? 0 : r + 9,
      y: isSelected ? r + 24 : 4,
      'text-anchor': isSelected ? 'middle' : 'start',
      class: 'planet-label',
    });
    label.textContent = node.title.length > 26 ? `${node.title.slice(0, 26)}…` : node.title;
    group.appendChild(label);
    svg.appendChild(group);
  }

  const focusStage = chainStateOf(state.selectedId);
  const focusMeta = chainMeta(focusStage);
  const searchNote = query ? `搜索「${state.query.trim()}」· ${nodes.length} 个结果 · ` : '';
  document.getElementById('graph-subtitle').textContent = state.selectedId
    ? `${searchNote}当前恒星：${nodeTitle(state.selectedId)} · ${focusMeta.label} · 下一步：${focusMeta.next}`
    : '选择一个节点，让 AI 找一条最值得验证的连接。';
}


  return { render: renderGraph };
}