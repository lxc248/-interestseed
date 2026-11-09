import { api } from './session.js';
import { createSuggestedView } from './suggested.js';
import { createShareCard } from './share-card.js';
import { createExperimentView } from './experiment.js';
import { createCollectionsView } from './collections.js';
import { createAiView } from './ai.js';

const state = {
  data: null,
  selectedId: null,
  suggestions: [],
  index: 0,
  lastConnected: null,
  busy: false,
  filterStage: 'all',
  query: '',
  aiError: null,
};

const $ = (selector) => document.querySelector(selector);
const svgNS = 'http://www.w3.org/2000/svg';
const suggestedView = createSuggestedView({ state, $, escapeHtml, toast, api, load });
const shareCard = createShareCard({ openModal });
const experimentView = createExperimentView({ state, $, escapeHtml, toast, api, load, openModal, closeModal, setBusy });
const collectionsView = createCollectionsView({ state, $, escapeHtml, shareCard, friendlyFeedback, openCorrection, applyDiscovery, feedbackDiscovery, dismissDiscovery, resolveInboxItem });
const aiView = createAiView({ state, $, escapeHtml, nodeTitle, chainStateOf, chainMeta, suggestFor, undoConnect, openSettings, openExperimentModal, openDiscoveryAudit, setBusy, api, load });
async function load() {
  state.data = await api('/api/state');
  if (!state.data.graph.nodes.some((node) => node.id === state.selectedId)) {
    state.selectedId = state.data.graph.nodes[0]?.id ?? null;
  }
  render();
}

function render() {
  if (!state.data) return;
  $('#model-badge').textContent = state.data.model;
  $('#model-badge').title = state.data.baseUrl;
  const discoveries = state.data.discoveries ?? [];
  const inboxPending = state.data.inbox?.pending ?? 0;
  const headerStatus = $('#header-status');
  headerStatus.textContent = state.data.keyReady
    ? `Key 已保存 · 发现 ${discoveries.length} · 待处理 ${inboxPending}`
    : '未配置 Key';
  headerStatus.className = `pill ${state.data.keyReady ? 'ready' : 'missing'}`;
  const keyStatus = $('#key-status');
  keyStatus.textContent = state.data.keyReady ? 'Key 已保存' : '未配置 Key';
  keyStatus.className = `pill ${state.data.keyReady ? 'ready' : 'missing'}`;
  const sprintButton = $('#sprint-button');
  sprintButton.hidden = (state.data.graph.nodes?.length ?? 0) > 0;
  renderStats();
  renderInsights();
  suggestedView.render();
  renderGraph();
  renderChainStrip();
  renderExperiment();
  renderDiscoveries();
  renderInbox();
  renderHistory();
  renderAI();
}

function renderStats() {
  const stats = state.data.stats;
  const cards = [
    ['节点', stats.nodes, '笔记、项目、主题'],
    ['关系', stats.edges, '图谱里的连接'],
    ['已确认', stats.confirmed, '你确认过的证据'],
    ['待确认', stats.suggested, '规则建议'],
  ];
  $('#stats').innerHTML = cards
    .map(([label, value, hint]) => `<div class="stat"><strong>${value}</strong><span>${label} · ${hint}</span></div>`)
    .join('');
}

function renderInsights() {
  const insights = state.data.insights ?? { top: [], themes: [], orphans: 0, advice: '' };
  const chips = [];
  if (insights.advice) chips.push(`<span class="insight-chip advice"><strong>建议</strong> ${escapeHtml(insights.advice)}</span>`);
  if (insights.orphans) chips.push(`<span class="insight-chip">孤岛 <strong>${insights.orphans}</strong></span>`);
  for (const node of insights.top ?? []) {
    chips.push(`<span class="insight-chip">星核 <strong>${escapeHtml(node.title)}</strong> · ${node.degree}</span>`);
  }
  for (const theme of insights.themes ?? []) {
    chips.push(`<span class="insight-chip"><span class="tag">#${escapeHtml(theme.tag)}</span> × ${theme.count}</span>`);
  }
  $('#insights-strip').innerHTML = chips.length
    ? chips.join('')
    : '<span class="insight-chip">扫描后这里会显示最连接节点、孤岛和主题。</span>';
}

function renderExperiment() {
  experimentView.render();
}

function openExperimentModal(title) {
  experimentView.open(title);
}

async function submitExperimentStart() {
  return experimentView.submit();
}

async function logExperiment(input) {
  return experimentView.log(input);
}

async function extendExperiment(id) {
  return experimentView.extend(id);
}
function friendlyFeedback(status) {
  return {
    none: '新发现',
    accepted: '已留下',
    rejected: '先不看',
    'low-value': '先放着',
    'needs-verification': '想再看看',
    corrected: '已改过',
  }[status] ?? '新发现';
}

function renderDiscoveries() {
  collectionsView.renderDiscoveries();
}

function renderInbox() {
  collectionsView.renderInbox();
}

function renderHistory() {
  collectionsView.renderHistory();
}
async function applyDiscovery(id) {
  try {
    setBusy(true);
    await api('/api/discoveries/apply', { method: 'POST', body: JSON.stringify({ id }) });
    await load();
    toast('已连上这两个节点');
  } catch (error) {
    toast(error.message, true);
  } finally {
    setBusy(false);
  }
}

async function feedbackDiscovery(id, action) {
  try {
    setBusy(true);
    await api('/api/discoveries/feedback', { method: 'POST', body: JSON.stringify({ id, action }) });
    await load();
    toast(friendlyFeedback(action));
  } catch (error) {
    toast(error.message, true);
  } finally {
    setBusy(false);
  }
}

function openCorrection(id) {
  document.getElementById('correction-id').value = id;
  document.getElementById('correction-text').value = '';
  openModal('correction-modal');
}

async function submitCorrection() {
  const id = document.getElementById('correction-id').value;
  const correction = document.getElementById('correction-text').value.trim();
  if (!id || !correction) return toast('先写下你的修改。', true);
  try {
    setBusy(true);
    await api('/api/discoveries/feedback', { method: 'POST', body: JSON.stringify({ id, action: 'corrected', correction }) });
    closeModal('correction-modal');
    await load();
    toast('已保存修改');
  } catch (error) {
    toast(error.message, true);
  } finally {
    setBusy(false);
  }
}

async function dismissDiscovery(id) {
  try {
    setBusy(true);
    await api('/api/discoveries/dismiss', { method: 'POST', body: JSON.stringify({ id }) });
    await load();
    toast('这条发现先不看了');
  } catch (error) {
    toast(error.message, true);
  } finally {
    setBusy(false);
  }
}

async function addInbox() {
  const input = $('#inbox-input');
  const text = input.value.trim();
  if (!text) return;
  try {
    setBusy(true);
    await api('/api/inbox', { method: 'POST', body: JSON.stringify({ text, source: 'clipboard' }) });
    input.value = '';
    await load();
    toast('已放进收件箱');
  } catch (error) {
    toast(error.message, true);
  } finally {
    setBusy(false);
  }
}

async function resolveInboxItem(id, status) {
  try {
    setBusy(true);
    await api('/api/inbox/resolve', { method: 'POST', body: JSON.stringify({ id, status }) });
    await load();
    toast(status === 'kept' ? '已留下并加入图谱' : '已放回');
  } catch (error) {
    toast(error.message, true);
  } finally {
    setBusy(false);
  }
}

function svgEl(name, attrs = {}) {
  const element = document.createElementNS(svgNS, name);
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== undefined && value !== null) element.setAttribute(key, String(value));
  }
  return element;
}

function chainStateOf(nodeId) {
  const graph = state.data?.graph;
  if (!graph) return 'captured';
  const experiments = state.data.experiments ?? [];
  if (experiments.some((item) => item.nodeId === nodeId && item.status === 'active')) return 'experimenting';
  if (experiments.some((item) => item.nodeId === nodeId && item.status === 'complete')) return 'reviewed';
  const connected = graph.edges.some((edge) => edge.status === 'confirmed'
    && (edge.source === nodeId || edge.target === nodeId));
  return connected ? 'connected' : 'captured';
}

function chainMeta(stage) {
  return {
    captured: { label: '收藏', next: '先用 AI 找一条连接', gradient: 'planet-captured' },
    connected: { label: '已连接', next: '开始 3 天实验', gradient: 'planet-connected' },
    experimenting: { label: '实验中', next: '今天记一条真实证据', gradient: 'planet-experimenting' },
    reviewed: { label: '已复盘', next: '决定继续，还是放下', gradient: 'planet-reviewed' },
  }[stage] ?? { label: '收藏', next: '先用 AI 找一条连接', gradient: 'planet-captured' };
}

function renderChainStrip() {
  const strip = document.getElementById('chain-strip');
  if (!strip) return;
  const nodeId = state.selectedId ?? state.data?.graph?.nodes?.[0]?.id;
  const stage = nodeId ? chainStateOf(nodeId) : 'captured';
  const meta = chainMeta(stage);
  const steps = [
    ['captured', '收藏'],
    ['connected', '连接'],
    ['experimenting', '实验'],
    ['reviewed', '复盘'],
  ];
  const stepHtml = steps
    .map(([key, label], index) => {
      const active = key === stage ? ' active' : '';
      const arrow = index < steps.length - 1 ? '<span class="chain-arrow">→</span>' : '';
      return `<span class="chain-step${active}"><strong>${label}</strong>${key === stage ? ` · ${escapeHtml(nodeTitle(nodeId))}` : ''}</span>${arrow}`;
    })
    .join('');
  strip.innerHTML = `<div class="chain-steps">${stepHtml}</div><div class="chain-action">下一步：${escapeHtml(meta.next)}</div>`;
}

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

function renderAI() {
  aiView.render();
}

async function scanVault() {
  return aiView.scanVault();
}
function friendlyAiError(message) {
  const text = String(message ?? '');
  if (/failed to fetch|networkerror|load failed/i.test(text)) {
    return '本地模型没有响应。确认本地服务在运行，或打开设置检查地址和 Key。';
  }
  if (/401|403|unauthorized|forbidden/i.test(text)) {
    return 'Key 或权限不对。打开设置检查本地模型配置。';
  }
  if (/timeout|timed out|超时/i.test(text)) {
    return '模型响应超时。第一次冷启动可能较慢，可以重试。';
  }
  return text || 'AI 暂时没有返回结果。';
}

async function suggestFor(nodeId) {
  try {
    state.aiError = null;
    setBusy(true);
    const result = await api(`/api/suggest?nodeId=${encodeURIComponent(nodeId)}`);
    state.suggestions = result.suggestions ?? [];
    state.index = 0;
    renderAI();
    if (!state.suggestions.length) toast('模型没有返回候选关系。');
  } catch (error) {
    const message = friendlyAiError(error.message);
    state.aiError = message;
    toast(message, true);
  } finally {
    setBusy(false);
  }
}

async function connectSuggestion(suggestion) {
  try {
    setBusy(true);
    const result = await api('/api/connect', {
      method: 'POST',
      body: JSON.stringify({ suggestion }),
    });
    if (!result.ok) throw new Error(result.message || '写入失败');
    state.lastConnected = result.edge;
    state.suggestions.splice(state.index, 1);
    if (state.index >= state.suggestions.length) state.index = 0;
    await load();
    toast('已连上这条关系');
  } catch (error) {
    toast(error.message, true);
  } finally {
    setBusy(false);
  }
}

async function undoConnect() {
  try {
    setBusy(true);
    await api('/api/undo', { method: 'POST' });
    state.lastConnected = null;
    await load();
    toast('已撤销这次写入');
  } catch (error) {
    toast(error.message, true);
  } finally {
    setBusy(false);
  }
}

function setBusy(value) {
  state.busy = value;
  document.querySelector('.app-shell')?.setAttribute('aria-busy', String(value));
  renderAI();
}

function nodeTitle(id) {
  return state.data?.graph.nodes.find((node) => node.id === id)?.title ?? '已删除节点';
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

let toastTimer = null;
function toast(message, error = false) {
  const element = $('#toast');
  element.setAttribute('role', error ? 'alert' : 'status');
  element.textContent = message;
  element.style.color = error ? '#fecdd3' : '';
  element.hidden = false;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { element.hidden = true; }, 3500);
}

$('#share-card-download').addEventListener('click', () => shareCard.download());
$('#scan-button').addEventListener('click', scanVault);
for (const chip of document.querySelectorAll('.filter-chip')) {
  chip.addEventListener('click', () => {
    state.filterStage = chip.getAttribute('data-stage') ?? 'all';
    for (const item of document.querySelectorAll('.filter-chip')) {
      item.classList.toggle('active', item === chip);
      item.setAttribute('aria-pressed', String(item === chip));
    }
    render();
  });
}
const graphSearch = $('#graph-search');
graphSearch.addEventListener('input', () => {
  state.query = graphSearch.value;
  render();
});
const modalFocusOrigins = new WeakMap();
function activeModal() {
  return [...document.querySelectorAll('.modal-backdrop')].find((modal) => !modal.hidden) ?? null;
}
function focusableIn(modal) {
  return [...modal.querySelectorAll('button, input, textarea, select, a[href], [tabindex]:not([tabindex="-1"])')]
    .filter((element) => !element.disabled && element.getClientRects().length > 0);
}
document.addEventListener('keydown', (event) => {
  const target = event.target;
  const typing = target instanceof HTMLElement
    && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
  if (event.key === '/' && !typing) {
    event.preventDefault();
    graphSearch.focus();
    graphSearch.select();
  }
  if (event.key === 'Tab') {
    const modal = activeModal();
    if (!modal) return;
    const items = focusableIn(modal);
    if (items.length === 0) {
      event.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !modal.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !modal.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  }
  if (event.key === 'Escape') {
    const modal = activeModal();
    if (modal) {
      closeModal(modal.id);
      return;
    }
    if (state.query) {
      state.query = '';
      graphSearch.value = '';
      render();
    }
  }
});
$('#capture-button').addEventListener('click', () => openModal('capture-modal'));
$('#sprint-button').addEventListener('click', () => openModal('sprint-modal'));
$('#sprint-submit').addEventListener('click', submitSprint);
$('#settings-button').addEventListener('click', openSettings);
$('#model-badge').addEventListener('click', openSettings);
$('#capture-submit').addEventListener('click', submitCapture);
$('#settings-submit').addEventListener('click', saveSettings);
$('#settings-test').addEventListener('click', testSettings);
$('#experiment-submit').addEventListener('click', submitExperimentStart);
$('#correction-submit').addEventListener('click', submitCorrection);
$('#settings-clear-key').addEventListener('click', clearKey);
for (const button of document.querySelectorAll('.modal-close')) {
  button.addEventListener('click', () => {
    const id = button.getAttribute('data-close');
    if (id) closeModal(id);
  });
}
for (const backdrop of document.querySelectorAll('.modal-backdrop')) {
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) closeModal(backdrop.id);
  });
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  if (document.activeElement instanceof HTMLElement) {
    modalFocusOrigins.set(modal, document.activeElement);
  }
  modal.hidden = false;
  focusableIn(modal)[0]?.focus();
}
function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.hidden = true;
  const origin = modalFocusOrigins.get(modal);
  modalFocusOrigins.delete(modal);
  if (origin instanceof HTMLElement) origin.focus();
}

async function openSettings() {
  try {
    const result = await api('/api/config');
    $('#settings-model').value = result.config.model ?? '';
    $('#settings-base-url').value = result.config.baseUrl ?? '';
    $('#settings-enable-ai').checked = result.config.enableAI !== false;
    $('#settings-ai-consent').checked = result.config.aiConsentGranted !== false;
    $('#settings-key').value = '';
    $('#settings-key').placeholder = result.keyReady
      ? '已保存 Key，留空保持不变；输入新 Key 可替换'
      : '未配置 Key，粘贴本地 API Key';
    $('#settings-include').value = (result.config.includeFolders ?? []).join('\n');
    $('#settings-exclude').value = (result.config.excludeFolders ?? []).join('\n');
    $('#settings-include-tags').value = (result.config.includeTags ?? []).join('\n');
    const testResult = $('#settings-test-result');
    testResult.textContent = '';
    testResult.className = 'hint';
    openModal('settings-modal');
  } catch (error) {
    toast(error.message, true);
  }
}

async function testSettings() {
  const result = $('#settings-test-result');
  result.textContent = '正在连接…';
  result.className = 'hint';
  try {
    const payload = await api('/api/config/test', {
      method: 'POST',
      body: JSON.stringify({
        model: $('#settings-model').value.trim(),
        baseUrl: $('#settings-base-url').value.trim(),
        apiKey: $('#settings-key').value.trim() || undefined,
      }),
    });
    result.textContent = payload.mode === 'models'
      ? `连接成功 · ${payload.latencyMs}ms · ${payload.modelCount ?? '若干'} 个模型`
      : `连接成功 · ${payload.latencyMs}ms · ${payload.model ?? '模型可用'}`;
    result.className = 'hint settings-test-result ok';
  } catch (error) {
    result.textContent = error.message;
    result.className = 'hint settings-test-result fail';
  }
}

async function saveSettings() {
  try {
    setBusy(true);
    const body = {
      model: $('#settings-model').value.trim(),
      baseUrl: $('#settings-base-url').value.trim(),
      enableAI: $('#settings-enable-ai').checked,
      aiConsentGranted: $('#settings-ai-consent').checked,
      includeFolders: $('#settings-include').value.split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
      excludeFolders: $('#settings-exclude').value.split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
      includeTags: $('#settings-include-tags').value.split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
    };
    const key = $('#settings-key').value.trim();
    if (key) body.key = key;
    await api('/api/config', { method: 'PUT', body: JSON.stringify(body) });
    closeModal('settings-modal');
    await load();
    toast('设置已保存');
  } catch (error) {
    toast(error.message, true);
  } finally {
    setBusy(false);
  }
}

async function clearKey() {
  try {
    setBusy(true);
    await api('/api/config', { method: 'PUT', body: JSON.stringify({ key: '' }) });
    closeModal('settings-modal');
    await load();
    toast('Key 已清除');
  } catch (error) {
    toast(error.message, true);
  } finally {
    setBusy(false);
  }
}

async function submitSprint() {
  const title = $('#sprint-title').value.trim();
  const why = $('#sprint-why').value.trim();
  const action = $('#sprint-action').value.trim();
  if (!title || !why || !action) return toast('三格都填上，才算种下种子。', true);
  try {
    setBusy(true);
    const text = `${why}\n\n第一步：${action}`;
    await api('/api/capture', { method: 'POST', body: JSON.stringify({ title, text }) });
    closeModal('sprint-modal');
    $('#sprint-title').value = '';
    $('#sprint-why').value = '';
    $('#sprint-action').value = '';
    await load();
    toast('第一颗种子已经种下');
  } catch (error) {
    toast(error.message, true);
  } finally {
    setBusy(false);
  }
}

async function submitCapture() {
  const text = $('#capture-text').value.trim();
  if (!text) return toast('先写点内容。', true);
  try {
    setBusy(true);
    const body = {
      text,
      title: $('#capture-title').value.trim(),
      url: $('#capture-url').value.trim(),
    };
    await api('/api/capture', { method: 'POST', body: JSON.stringify(body) });
    $('#capture-text').value = '';
    $('#capture-title').value = '';
    $('#capture-url').value = '';
    closeModal('capture-modal');
    await load();
    toast('已保存并重新扫描');
  } catch (error) {
    toast(error.message, true);
  } finally {
    setBusy(false);
  }
}
function openDiscoveryAudit() {
  const discoveries = state.data.discoveries ?? [];
  const counts = { accepted: 0, 'needs-verification': 0, 'low-value': 0, rejected: 0, none: 0 };
  const byStatus = {};
  for (const item of discoveries) {
    const key = item.feedbackStatus ?? 'none';
    counts[key] = (counts[key] ?? 0) + 1;
    (byStatus[key] ??= []).push(item.title);
  }
  const applied = discoveries.filter((item) => item.application?.state === 'applied' || item.application?.state === 'existing').length;
  const rows = [
    ['已留下', counts.accepted, 'accepted'],
    ['想再看看', counts['needs-verification'], 'needs-verification'],
    ['先放着', counts['low-value'], 'low-value'],
    ['先不看', counts.rejected, 'rejected'],
    ['还没处理', counts.none, 'none'],
  ];
  const body = document.getElementById('discovery-audit-body');
  body.innerHTML = `<p class="empty-copy">${discoveries.length} 条发现 · 已连上 ${applied} 条</p>`;
  for (const [label, count, key] of rows) {
    const block = document.createElement('div');
    block.className = 'audit-row';
    block.innerHTML = `<strong>${label} · ${count ?? 0}</strong>`;
    if (byStatus[key]?.length) {
      block.innerHTML += `<p>${byStatus[key].map(escapeHtml).join('、')}</p>`;
    }
    body.appendChild(block);
  }
  openModal('discovery-audit-modal');
}

$('#discoveries-audit').addEventListener('click', openDiscoveryAudit);
$('#discoveries-refresh').addEventListener('click', async () => {
  try {
    setBusy(true);
    await api('/api/discoveries/refresh', { method: 'POST' });
    await load();
    toast('发现已刷新');
  } catch (error) {
    toast(error.message, true);
  } finally {
    setBusy(false);
  }
});
$('#inbox-add').addEventListener('click', addInbox);
$('#inbox-input').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') addInbox();
});
load().catch((error) => toast(error.message, true));
