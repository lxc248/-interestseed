(() => {
  'use strict';

  const canvas = document.getElementById('cosmos');
  const ctx = canvas.getContext('2d');
  const statsEl = document.getElementById('stats');
  const detailEl = document.getElementById('detail');
  const searchEl = document.getElementById('search');
  const filtersEl = document.getElementById('filters');
  const toastEl = document.getElementById('toast');
  const pauseEl = document.getElementById('pause');
  const fitEl = document.getElementById('fit');
  const exportEl = document.getElementById('export');

  const graph = window.__INTERESTSEED_GRAPH__ || { nodes: [], edges: [] };
  const W = 1600;
  const H = 980;

  const STYLES = {
    project: { color: '#e18061', glow: 'rgba(225,128,97,', label: '项目' },
    document: { color: '#5ed1df', glow: 'rgba(94,209,223,', label: '文档' },
    topic: { color: '#9c8cff', glow: 'rgba(156,140,255,', label: '主题' },
    image: { color: '#e6b66a', glow: 'rgba(230,182,106,', label: '图片' },
    audio: { color: '#ee82a4', glow: 'rgba(238,130,164,', label: '音频' },
    video: { color: '#ee82a4', glow: 'rgba(238,130,164,', label: '视频' },
    activity: { color: '#7dd9ad', glow: 'rgba(125,217,173,', label: '行动' }
  };

  const CLUSTER_STYLES = {
    genesis: { color: '#e18061', label: '兴趣起跑' },
    projects: { color: '#9c8cff', label: '项目轨道' },
    expression: { color: '#e6b66a', label: '表达轨道' },
    city: { color: '#5ed1df', label: '城市轨道' },
    experiment: { color: '#7dd9ad', label: '实验轨道' },
    other: { color: '#969ca8', label: '其他轨道' }
  };

  let width = 0;
  let height = 0;
  let dpr = 1;
  let zoom = 1;
  let panX = 0;
  let panY = 0;
  let selected = null;
  let hovered = null;
  let dragging = false;
  let panning = false;
  let pointer = { x: 0, y: 0 };
  let lastPointer = { x: 0, y: 0 };
  let paused = false;
  let filter = 'all';
  let search = '';
  let t = 0;
  let last = performance.now();
  let toastTimer = 0;

  const nodes = [];
  const nodeById = new Map();
  const edges = [];
  const stars = [];
  const clusters = new Map();

  function hash(input) {
    let h = 2166136261;
    for (let i = 0; i < input.length; i += 1) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 4294967295;
  }

  function radiusFor(node, degree) {
    const base = {
      project: 24,
      document: 13,
      topic: 20,
      image: 14,
      audio: 14,
      video: 15,
      activity: 19
    }[node.type] || 16;
    return base + Math.min(8, degree * 0.7);
  }

  function clusterFor(node) {
    const tags = (node.tags || []).map((tag) => tag.toLowerCase());
    if (tags.includes('兴趣起跑')) return 'genesis';
    if (tags.includes('城市') || tags.includes('空间')) return 'city';
    if (tags.includes('设计') || tags.includes('表达') || tags.includes('影像')) return 'expression';
    if (tags.includes('实验') || tags.includes('下一步')) return 'experiment';
    if (node.type === 'project' || tags.includes('项目')) return 'projects';
    return 'other';
  }

  function build() {
    const degree = new Map();
    for (const node of graph.nodes) degree.set(node.id, 0);
    for (const edge of graph.edges) {
      degree.set(edge.source, (degree.get(edge.source) || 0) + 1);
      degree.set(edge.target, (degree.get(edge.target) || 0) + 1);
    }

    for (const node of graph.nodes) {
      const item = {
        ...node,
        degree: degree.get(node.id) || 0,
        radius: radiusFor(node, degree.get(node.id) || 0),
        cluster: clusterFor(node),
        phase: hash(node.id) * Math.PI * 2,
        x: 0,
        y: 0,
        glow: 0,
        match: true
      };
      nodes.push(item);
      nodeById.set(item.id, item);
    }

    for (const edge of graph.edges) {
      const source = nodeById.get(edge.source);
      const target = nodeById.get(edge.target);
      if (source && target) edges.push({ ...edge, source, target });
    }

    const counts = new Map();
    for (const node of nodes) counts.set(node.cluster, (counts.get(node.cluster) || 0) + 1);
    const present = [...counts.keys()];
    const centers = [
      [410, 480],
      [1120, 410],
      [1260, 775],
      [560, 815],
      [880, 575],
      [225, 760],
      [1430, 240]
    ];
    present.forEach((key, index) => {
      const def = CLUSTER_STYLES[key] || CLUSTER_STYLES.other;
      clusters.set(key, {
        key,
        label: def.label,
        color: def.color,
        count: counts.get(key),
        x: centers[index % centers.length][0],
        y: centers[index % centers.length][1],
        radius: 100 + Math.min(120, counts.get(key) * 18)
      });
    });

    for (const cluster of clusters.values()) {
      const members = nodes.filter((node) => node.cluster === cluster.key);
      members.forEach((node, index) => {
        const angle = (index / Math.max(1, members.length)) * Math.PI * 2 + (hash(cluster.key) * 1.4);
        const ring = cluster.radius + (index % 2) * 45 + (node.degree > 2 ? 18 : 0);
        node.x = cluster.x + Math.cos(angle) * ring + (hash(node.id) - 0.5) * 22;
        node.y = cluster.y + Math.sin(angle) * ring * 0.62 + (hash(node.id + 'y') - 0.5) * 20;
      });
    }
  }

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    if (!zoom) fit();
    else {
      const old = dpr;
      dpr = old;
    }
  }

  function fit() {
    const xs = nodes.map((node) => node.x);
    const ys = nodes.map((node) => node.y);
    const minX = Math.min(...xs) - 150;
    const maxX = Math.max(...xs) + 150;
    const minY = Math.min(...ys) - 130;
    const maxY = Math.max(...ys) + 130;
    const z = Math.min((width - 80) / (maxX - minX), (height - 120) / (maxY - minY));
    zoom = Math.max(0.32, Math.min(1.38, z));
    panX = width / 2 - ((minX + maxX) / 2) * zoom;
    panY = height / 2 - ((minY + maxY) / 2) * zoom;
  }

  function screen(node) {
    const wobble = Math.sin(t * 0.45 + node.phase) * 2.4;
    return {
      x: node.x * zoom + panX + wobble,
      y: node.y * zoom + panY + Math.cos(t * 0.38 + node.phase) * 1.7
    };
  }

  function nodeAt(x, y) {
    for (let i = nodes.length - 1; i >= 0; i -= 1) {
      const node = nodes[i];
      if (!node.match) continue;
      const p = screen(node);
      const r = Math.max(12, node.radius * zoom);
      if ((x - p.x) ** 2 + (y - p.y) ** 2 <= (r + 8) ** 2) return node;
    }
    return null;
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function starfield() {
    const grad = ctx.createRadialGradient(width * 0.52, height * 0.45, 0, width * 0.52, height * 0.45, Math.max(width, height) * 0.78);
    grad.addColorStop(0, '#090d1a');
    grad.addColorStop(0.5, '#060913');
    grad.addColorStop(1, '#03050a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    const nebulaA = ctx.createRadialGradient(width * 0.2, height * 0.32, 0, width * 0.2, height * 0.32, width * 0.45);
    nebulaA.addColorStop(0, 'rgba(105,70,150,.12)');
    nebulaA.addColorStop(0.4, 'rgba(58,49,118,.05)');
    nebulaA.addColorStop(1, 'rgba(4,6,12,0)');
    ctx.fillStyle = nebulaA;
    ctx.fillRect(0, 0, width, height);

    const nebulaB = ctx.createRadialGradient(width * 0.82, height * 0.7, 0, width * 0.82, height * 0.7, width * 0.42);
    nebulaB.addColorStop(0, 'rgba(42,126,150,.095)');
    nebulaB.addColorStop(0.5, 'rgba(20,55,80,.035)');
    nebulaB.addColorStop(1, 'rgba(4,6,12,0)');
    ctx.fillStyle = nebulaB;
    ctx.fillRect(0, 0, width, height);

    for (const star of stars) {
      const alpha = star.a * (0.6 + 0.4 * Math.sin(t * star.speed + star.phase));
      ctx.fillStyle = `rgba(${star.c},${alpha})`;
      ctx.beginPath();
      ctx.arc(star.x * width, star.y * height + Math.sin(t * 0.02 + star.phase) * 2, star.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Fine crosshair dust for a cinematic scientific instrument feel.
    ctx.globalAlpha = 0.10;
    for (let i = 0; i < 5; i += 1) {
      const y = (i * height) / 5 + Math.sin(t * 0.07 + i) * 8;
      ctx.strokeStyle = i % 2 ? 'rgba(94,209,223,.5)' : 'rgba(225,128,97,.38)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y + 60);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function orbit(color, cluster, index) {
    const cx = cluster.x * zoom + panX;
    const cy = cluster.y * zoom + panY;
    for (let ring = 0; ring < 3; ring += 1) {
      const rx = (cluster.radius + ring * 52 + 18) * zoom;
      const ry = rx * (0.58 + ring * 0.025);
      ctx.strokeStyle = color + (ring === 0 ? '40' : ring === 1 ? '1e' : '12');
      ctx.lineWidth = ring === 0 ? 1 : 0.7;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, -0.18 + index * 0.03, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function clusterStar(cluster) {
    const x = cluster.x * zoom + panX;
    const y = cluster.y * zoom + panY;
    const r = Math.max(4, 7 * zoom);
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 12);
    glow.addColorStop(0, cluster.color + 'd0');
    glow.addColorStop(0.16, cluster.color + '55');
    glow.addColorStop(0.5, cluster.color + '16');
    glow.addColorStop(1, cluster.color + '00');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r * 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = cluster.color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.8)';
    ctx.beginPath();
    ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '600 8px "Inter","Noto Sans SC",sans-serif';
    ctx.fillStyle = 'rgba(242,239,233,.42)';
    ctx.textAlign = 'center';
    ctx.fillText(cluster.label.toUpperCase(), x, y + r + 16);
  }

  function edgeCurve(source, target) {
    const a = screen(source);
    const b = screen(target);
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy) || 1;
    const bend = Math.min(70, length * 0.16) * (source.id < target.id ? 1 : -1);
    return {
      ax: a.x,
      ay: a.y,
      cx: mx - (dy / length) * bend,
      cy: my + (dx / length) * bend,
      bx: b.x,
      by: b.y
    };
  }

  function drawEdges() {
    const activeId = selected?.id || hovered?.id;
    for (const edge of edges) {
      if (!edge.source.match || !edge.target.match) continue;
      const curve = edgeCurve(edge.source, edge.target);
      const active = activeId && (edge.source.id === activeId || edge.target.id === activeId);
      const style = STYLES[edge.source.type] || STYLES.topic;
      ctx.save();
      ctx.globalAlpha = active ? 0.9 : edge.status === 'suggested' ? 0.22 : 0.34;
      ctx.strokeStyle = active ? style.color : `${style.color}88`;
      ctx.lineWidth = active ? 1.7 : edge.status === 'suggested' ? 0.8 : 1.05;
      if (edge.status === 'suggested') ctx.setLineDash([4, 8]);
      ctx.beginPath();
      ctx.moveTo(curve.ax, curve.ay);
      ctx.quadraticCurveTo(curve.cx, curve.cy, curve.bx, curve.by);
      ctx.stroke();
      ctx.setLineDash([]);

      if (active || edge.status === 'confirmed') {
        const speed = 0.10 + (hash(edge.id) * 0.08);
        for (let i = 0; i < 2; i += 1) {
          const p = (t * speed + i * 0.5 + hash(edge.id)) % 1;
          const x = (1 - p) ** 2 * curve.ax + 2 * (1 - p) * p * curve.cx + p * p * curve.bx;
          const y = (1 - p) ** 2 * curve.ay + 2 * (1 - p) * p * curve.cy + p * p * curve.by;
          const glow = ctx.createRadialGradient(x, y, 0, x, y, 7);
          glow.addColorStop(0, active ? style.color : `${style.color}aa`);
          glow.addColorStop(1, `${style.color}00`);
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(x, y, 7, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (active) {
        ctx.globalAlpha = 0.9;
        ctx.font = '500 9px "Inter","Noto Sans SC",sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = style.color;
        const text = edge.relation || '连接';
        const tw = ctx.measureText(text).width;
        ctx.fillStyle = 'rgba(5,7,13,.78)';
        roundRect(curve.cx - tw / 2 - 6, curve.cy - 12, tw + 12, 17, 7);
        ctx.fill();
        ctx.fillStyle = style.color;
        ctx.fillText(text, curve.cx, curve.cy);
      }
      ctx.restore();
    }
  }

  function drawPlanet(node) {
    const p = screen(node);
    const style = STYLES[node.type] || STYLES.topic;
    const r = Math.max(5, node.radius * zoom);
    const active = selected?.id === node.id;
    const hot = hovered?.id === node.id;
    const alpha = node.match ? 1 : 0.16;
    ctx.save();
    ctx.globalAlpha = alpha;

    const halo = ctx.createRadialGradient(p.x, p.y, r * 0.6, p.x, p.y, r * 4.8);
    halo.addColorStop(0, style.glow + (active ? '.36)' : hot ? '.25)' : '.15)'));
    halo.addColorStop(1, style.glow + '0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 4.8, 0, Math.PI * 2);
    ctx.fill();

    // atmosphere
    ctx.strokeStyle = style.glow + (active ? '.8)' : '.35)');
    ctx.lineWidth = active ? 1.4 : 0.8;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r + (active ? 6 : 3), 0, Math.PI * 2);
    ctx.stroke();

    // planet body
    const body = ctx.createRadialGradient(p.x - r * 0.36, p.y - r * 0.42, r * 0.08, p.x, p.y, r);
    body.addColorStop(0, lighten(style.color, 0.55));
    body.addColorStop(0.28, style.color);
    body.addColorStop(0.76, darken(style.color, 0.38));
    body.addColorStop(1, darken(style.color, 0.72));
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();

    // shadow crescent
    ctx.fillStyle = 'rgba(2,4,9,.35)';
    ctx.beginPath();
    ctx.arc(p.x + r * 0.25, p.y + r * 0.12, r * 0.92, -1.6, 2.4);
    ctx.fill();

    // tiny moons for high-degree planets
    if (node.degree >= 3 || node.type === 'project') {
      const angle = t * 0.5 + node.phase;
      const mr = r + 9;
      const mx = p.x + Math.cos(angle) * mr;
      const my = p.y + Math.sin(angle) * mr * 0.45;
      ctx.fillStyle = style.color;
      ctx.beginPath();
      ctx.arc(mx, my, Math.max(1.2, r * 0.10), 0, Math.PI * 2);
      ctx.fill();
    }
    // ring for selected or important projects
    if (active || node.type === 'project') {
      ctx.strokeStyle = style.color + (active ? 'b0' : '55');
      ctx.lineWidth = active ? 1.6 : 0.9;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, r * 1.7, r * 0.45, -0.34, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (active) {
      ctx.strokeStyle = 'rgba(242,239,233,.9)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 11 + Math.sin(t * 2) * 1.4, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    node.screen = p;
  }

  function lighten(hex, amount) {
    return adjust(hex, amount);
  }
  function darken(hex, amount) {
    return adjust(hex, -amount);
  }
  function adjust(hex, amount) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) + Math.round(255 * amount);
    let g = ((n >> 8) & 255) + Math.round(255 * amount);
    let b = (n & 255) + Math.round(255 * amount);
    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));
    return `rgb(${r},${g},${b})`;
  }

  function drawLabels() {
    const active = selected?.id;
    const candidates = nodes
      .filter((node) => node.match && node.screen)
      .sort((a, b) => (b.id === active ? 1 : 0) - (a.id === active ? 1 : 0) || b.degree - a.degree);
    const boxes = [];
    for (const node of candidates) {
      const p = node.screen;
      const important = node.id === active || node.id === hovered?.id || node.degree >= 2;
      if (!important && zoom < 0.52) continue;
      ctx.font = '600 9px "Inter","Noto Sans SC",sans-serif';
      let label = node.title;
      const max = node.id === active ? 140 : 104;
      while (ctx.measureText(label).width > max && label.length > 6) label = label.slice(0, -1);
      if (label !== node.title) label += '…';
      const w = ctx.measureText(label).width + 14;
      const h = 18;
      const x = p.x + node.radius * zoom + 7;
      const y = p.y - h / 2;
      const box = { x: x - 3, y: y - 2, w: w + 6, h: h + 4 };
      const collision = boxes.some((b) => !(box.x + box.w < b.x || box.x > b.x + b.w || box.y + box.h < b.y || box.y > b.y + b.h));
      if (collision && node.id !== active) continue;
      boxes.push(box);
      ctx.fillStyle = node.id === active ? 'rgba(225,128,97,.16)' : 'rgba(5,7,13,.55)';
      roundRect(x, y, w, h, 7);
      ctx.fill();
      if (node.id === active) {
        ctx.strokeStyle = 'rgba(225,128,97,.55)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.fillStyle = node.id === active ? '#f2efe9' : 'rgba(242,239,233,.72)';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x + 7, y + h / 2 + 0.5);
    }
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    starfield();
    let index = 0;
    for (const cluster of clusters.values()) {
      if (cluster.count > 0) orbit(cluster.color, cluster, index++);
    }
    drawEdges();
    for (const cluster of clusters.values()) clusterStar(cluster);
    for (const node of nodes) drawPlanet(node);
    drawLabels();
    statsEl.innerHTML = `<span><b>${nodes.filter((n) => n.match).length}</b> planets</span><span><b>${edges.filter((e) => e.source.match && e.target.match).length}</b> orbits</span>`;
  }

  function loop(now) {
    const delta = Math.min(50, now - last);
    last = now;
    if (!paused) t += delta / 1000;
    draw();
    requestAnimationFrame(loop);
  }

  function applyFilter() {
    const term = search.trim().toLowerCase();
    const neighbors = new Set();
    if (selected) {
      neighbors.add(selected.id);
      for (const edge of edges) {
        if (edge.source.id === selected.id) neighbors.add(edge.target.id);
        if (edge.target.id === selected.id) neighbors.add(edge.source.id);
      }
    }
    for (const node of nodes) {
      const typeMatch = filter === 'all' || node.type === filter;
      const textMatch = !term || `${node.title} ${(node.tags || []).join(' ')}`.toLowerCase().includes(term) || neighbors.has(node.id);
      node.match = typeMatch && textMatch;
    }
    draw();
  }

  function showToast(text) {
    toastEl.textContent = text;
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), 1700);
  }

  function select(node) {
    selected = node;
    if (!node) {
      detailEl.className = 'cosmic-detail is-empty';
      detailEl.innerHTML = '<div class="cosmic-detail-empty"><div class="cosmic-empty-star">✦</div><div class="cosmic-detail-title">选择一个行星</div><p>点击星球，查看它和哪些兴趣相连。拖动空白处可以漫游星图。</p></div>';
      return;
    }
    const style = STYLES[node.type] || STYLES.topic;
    const neighbors = edges
      .filter((edge) => edge.source.id === node.id || edge.target.id === node.id)
      .map((edge) => ({
        edge,
        node: edge.source.id === node.id ? edge.target : edge.source
      }));
    detailEl.className = 'cosmic-detail';
    detailEl.innerHTML = '';
    const kicker = document.createElement('div');
    kicker.className = 'cosmic-detail-kicker';
    kicker.textContent = style.label.toUpperCase() + ' / ' + (node.cluster || 'ORBIT').toUpperCase();
    const title = document.createElement('h2');
    title.textContent = node.title;
    const type = document.createElement('div');
    type.className = 'cosmic-detail-type';
    type.textContent = style.label + ' · ' + neighbors.length + ' 条连接';
    const tags = document.createElement('div');
    tags.className = 'cosmic-detail-tags';
    (node.tags || []).slice(0, 5).forEach((tag) => {
      const span = document.createElement('span');
      span.textContent = '#' + tag;
      tags.appendChild(span);
    });
    detailEl.append(kicker, title, type, tags);
    const evidence = node.metadata && node.metadata.evidence;
    if (evidence) {
      const section = document.createElement('div');
      section.className = 'cosmic-detail-section';
      section.innerHTML = '<div class="cosmic-detail-section-label">WHY THIS EXISTS</div>';
      const p = document.createElement('p');
      p.className = 'cosmic-detail-evi';
      p.textContent = String(evidence);
      section.appendChild(p);
      detailEl.appendChild(section);
    }
    if (neighbors.length) {
      const section = document.createElement('div');
      section.className = 'cosmic-detail-section';
      section.innerHTML = '<div class="cosmic-detail-section-label">ORBITS</div>';
      neighbors.slice(0, 8).forEach(({ edge, node: other }) => {
        const row = document.createElement('div');
        row.className = 'cosmic-neighbor';
        const dot = document.createElement('span');
        dot.className = 'cosmic-neighbor-dot';
        dot.style.background = (STYLES[other.type] || STYLES.topic).color;
        const name = document.createElement('span');
        name.textContent = other.title;
        const rel = document.createElement('span');
        rel.className = 'cosmic-neighbor-rel';
        rel.textContent = edge.relation || (edge.status === 'suggested' ? '待确认' : '连接');
        row.append(dot, name, rel);
        row.addEventListener('click', () => select(other));
        section.appendChild(row);
      });
      detailEl.appendChild(section);
    }
    applyFilter();
  }

  function exportPng() {
    const a = document.createElement('a');
    a.download = 'interestseed-cosmic-map.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
    showToast('星图已保存为 PNG');
  }

  function bind() {
    canvas.addEventListener('pointerdown', (event) => {
      const rect = canvas.getBoundingClientRect();
      pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      lastPointer = { ...pointer };
      const node = nodeAt(pointer.x, pointer.y);
      if (node) {
        dragging = true;
        select(node);
        canvas.setPointerCapture(event.pointerId);
      } else {
        panning = true;
        canvas.setPointerCapture(event.pointerId);
      }
    });
    canvas.addEventListener('pointermove', (event) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      if (panning) {
        panX += x - lastPointer.x;
        panY += y - lastPointer.y;
        lastPointer = { x, y };
      } else if (dragging) {
        lastPointer = { x, y };
      } else {
        const node = nodeAt(x, y);
        if (node !== hovered) {
          hovered = node;
          canvas.style.cursor = node ? 'pointer' : 'grab';
        }
      }
      pointer = { x, y };
    });
    canvas.addEventListener('pointerup', () => {
      dragging = false;
      panning = false;
    });
    canvas.addEventListener('pointercancel', () => {
      dragging = false;
      panning = false;
    });
    canvas.addEventListener('wheel', (event) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const beforeX = (x - panX) / zoom;
      const beforeY = (y - panY) / zoom;
      const factor = event.deltaY > 0 ? 0.92 : 1.08;
      zoom = Math.max(0.28, Math.min(3.2, zoom * factor));
      panX = x - beforeX * zoom;
      panY = y - beforeY * zoom;
    }, { passive: false });
    window.addEventListener('resize', resize);
    searchEl.addEventListener('input', () => {
      search = searchEl.value;
      applyFilter();
    });
    filtersEl.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-filter]');
      if (!button) return;
      filter = button.dataset.filter;
      for (const item of filtersEl.querySelectorAll('button')) item.classList.toggle('is-active', item === button);
      applyFilter();
    });
    fitEl.addEventListener('click', () => {
      fit();
      applyFilter();
      showToast('星图已适应窗口');
    });
    pauseEl.addEventListener('click', () => {
      paused = !paused;
      pauseEl.textContent = paused ? '▶' : 'Ⅱ';
      showToast(paused ? '动态已暂停' : '动态继续');
    });
    exportEl.addEventListener('click', exportPng);
    window.addEventListener('keydown', (event) => {
      if (event.key === '0') {
        fit();
        applyFilter();
      }
      if (event.key === 'Escape') select(null);
    });
  }

  for (let i = 0; i < 260; i += 1) {
    stars.push({
      x: hash('x' + i),
      y: hash('y' + i),
      r: 0.35 + hash('r' + i) * 1.35,
      a: 0.12 + hash('a' + i) * 0.55,
      speed: 0.25 + hash('s' + i) * 1.6,
      phase: hash('p' + i) * Math.PI * 2,
      c: i % 7 === 0 ? '140,205,255' : i % 11 === 0 ? '255,185,150' : '225,232,255'
    });
  }

  build();
  resize();
  fit();
  bind();
  applyFilter();
  requestAnimationFrame(loop);
})();
