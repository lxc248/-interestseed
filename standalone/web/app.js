const state = {
  data: null,
  selectedId: null,
  suggestions: [],
  index: 0,
  lastConnected: null,
  busy: false,
};

const $ = (selector) => document.querySelector(selector);
const svgNS = 'http://www.w3.org/2000/svg';

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
  return body;
}

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
  const keyStatus = $('#key-status');
  keyStatus.textContent = state.data.keyReady ? 'Key 已保存' : '未配置 Key';
  keyStatus.className = `pill ${state.data.keyReady ? 'ready' : 'missing'}`;
  renderStats();
  renderGraph();
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
    ['待整理', stats.suggested, '规则建议'],
  ];
  $('#stats').innerHTML = cards
    .map(([label, value, hint]) => `<div class="stat"><strong>${value}</strong><span>${label} · ${hint}</span></div>`)
    .join('');
}

function renderExperiment() {
  const strip = $('#experiment-strip');
  strip.innerHTML = '';
  const experiment = state.data.activeExperiment;
  const main = document.createElement('div');
  main.className = 'experiment-main';
  if (!experiment) {
    main.innerHTML = `<p class="eyebrow">3-DAY EXPERIMENT</p><h3>还没有进行中的实验</h3><p>从当前焦点开始，3 天后用证据决定继续还是放下。</p>`;
    strip.appendChild(main);
    const actions = document.createElement('div');
    actions.className = 'experiment-actions';
    const start = document.createElement('button');
    start.className = 'button primary';
    start.textContent = '开始 3 天实验';
    start.addEventListener('click', () => startExperiment());
    actions.appendChild(start);
    strip.appendChild(actions);
    return;
  }

  const day = Math.min(experiment.day, experiment.targetDays);
  main.innerHTML = `<p class="eyebrow">3-DAY EXPERIMENT · DAY ${day} / ${experiment.targetDays}</p><h3>${escapeHtml(experiment.title)}</h3><p>${escapeHtml(experiment.hypothesis)}</p>`;
  strip.appendChild(main);

  const progress = document.createElement('div');
  progress.className = 'experiment-progress';
  for (let index = 0; index < experiment.targetDays; index += 1) {
    const dot = document.createElement('span');
    dot.className = `experiment-dot ${index < experiment.logs.length ? 'done' : index === experiment.logs.length ? 'today' : ''}`;
    progress.appendChild(dot);
  }
  strip.appendChild(progress);

  const actions = document.createElement('div');
  actions.className = 'experiment-actions';
  if (experiment.status === 'complete') {
    const summary = document.createElement('span');
    summary.className = 'pill ready';
    summary.textContent = `已完成 · 兴趣 ${experiment.summary.averageInterest} / 精力 ${experiment.summary.averageEnergy}`;
    actions.appendChild(summary);
    strip.appendChild(actions);
    return;
  }

  const evidence = document.createElement('input');
  evidence.placeholder = '今天实际做了什么？';
  evidence.maxLength = 160;
  const record = document.createElement('button');
  record.className = 'button primary';
  record.textContent = '记录';
  record.addEventListener('click', () => {
    const value = evidence.value.trim();
    if (value.length < 4) return toast('至少写 4 个字的真实观察。', true);
    logExperiment({ evidence: value, interest: 4, energy: 4 });
  });
  const did = document.createElement('button');
  did.className = 'button ghost';
  did.textContent = '今天做了';
  did.addEventListener('click', () => logExperiment({ evidence: '今天实际做了一件和这个兴趣有关的事。', interest: 4, energy: 4 }));
  const thought = document.createElement('button');
  thought.className = 'button ghost';
  thought.textContent = '只想过';
  thought.addEventListener('click', () => logExperiment({ evidence: '今天没有行动，但想起过这个兴趣。', interest: 3, energy: 2 }));
  const missed = document.createElement('button');
  missed.className = 'button ghost';
  missed.textContent = '没做';
  missed.addEventListener('click', () => logExperiment({ evidence: '今天没有做，也没有特别想起这个兴趣。', interest: 2, energy: 1 }));
  actions.append(evidence, record, did, thought, missed);
  strip.appendChild(actions);
}

async function startExperiment(title) {
  const selected = state.data.graph.nodes.find((node) => node.id === state.selectedId);
  const targetTitle = title || selected?.title;
  if (!targetTitle) return toast('先选择一个节点。', true);
  try {
    setBusy(true);
    await api('/api/experiments', {
      method: 'POST',
      body: JSON.stringify({ title: targetTitle, nodeId: selected?.id }),
    });
    await load();
    toast('3 天实验已开始');
  } catch (error) {
    toast(error.message, true);
  } finally {
    setBusy(false);
  }
}

async function logExperiment(input) {
  const experiment = state.data.activeExperiment;
  if (!experiment) return;
  try {
    setBusy(true);
    await api('/api/experiments/log', {
      method: 'POST',
      body: JSON.stringify({ id: experiment.id, ...input }),
    });
    await load();
    toast('今天已经记下');
  } catch (error) {
    toast(error.message, true);
  } finally {
    setBusy(false);
  }
}

function renderDiscoveries() {
  const list = $('#discoveries-list');
  list.innerHTML = '';
  const discoveries = state.data.discoveries ?? [];
  if (!discoveries.length) {
    list.innerHTML = `<p class="empty-copy">还没有跨目录发现。先确认几条关系，再点刷新。发现只使用共享标签和已确认关系，不读正文。</p>`;
    return;
  }
  for (const item of discoveries) {
    const card = document.createElement('div');
    card.className = 'discovery-card';
    card.innerHTML = `<h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p>`;
    const tags = document.createElement('div');
    tags.className = 'tag-row';
    for (const tag of item.subjectKeys ?? []) {
      const node = document.createElement('span');
      node.className = 'tag';
      node.textContent = `#${tag}`;
      tags.appendChild(node);
    }
    card.appendChild(tags);
    const evidence = document.createElement('p');
    evidence.style.marginTop = '7px';
    evidence.textContent = (item.evidence ?? [])
      .slice(0, 2)
      .map((entry) => entry.text)
      .join(' · ');
    card.appendChild(evidence);
    const actions = document.createElement('div');
    actions.className = 'card-actions';
    const apply = document.createElement('button');
    apply.className = 'button primary';
    apply.textContent = '连上这两个节点';
    apply.addEventListener('click', () => applyDiscovery(item.id));
    const dismiss = document.createElement('button');
    dismiss.className = 'button ghost';
    dismiss.textContent = '先不看';
    dismiss.addEventListener('click', () => dismissDiscovery(item.id));
    actions.append(apply, dismiss);
    card.appendChild(actions);
    list.appendChild(card);
  }
}

function renderInbox() {
  const list = $('#inbox-list');
  list.innerHTML = '';
  const inbox = state.data.inbox ?? { pending: 0, items: [] };
  $('#inbox-count').textContent = `${inbox.pending ?? 0} 条待处理`;
  const pending = (inbox.items ?? []).filter((item) => item.status === 'pending');
  if (!pending.length) {
    list.innerHTML = `<p class="empty-copy">收件箱是空的。把一条收藏粘进来，先决定要不要留下。</p>`;
    return;
  }
  for (const item of pending) {
    const card = document.createElement('div');
    card.className = 'inbox-card';
    card.innerHTML = `<h3>${escapeHtml(item.text.slice(0, 80))}</h3><p>${new Date(item.addedAt).toLocaleString()} · ${item.source}</p>`;
    const actions = document.createElement('div');
    actions.className = 'card-actions';
    const keep = document.createElement('button');
    keep.className = 'button primary';
    keep.textContent = '留下';
    keep.addEventListener('click', () => resolveInboxItem(item.id, 'kept'));
    const pass = document.createElement('button');
    pass.className = 'button ghost';
    pass.textContent = '先不放';
    pass.addEventListener('click', () => resolveInboxItem(item.id, 'passed'));
    actions.append(keep, pass);
    card.appendChild(actions);
    list.appendChild(card);
  }
}

function renderHistory() {
  const list = $('#history-list');
  list.innerHTML = '';
  const experiments = state.data.experiments ?? [];
  if (!experiments.length) {
    list.innerHTML = `<p class="empty-copy">还没有实验。连上一条关系后，开始 3 天实验。</p>`;
    return;
  }
  for (const experiment of experiments) {
    const card = document.createElement('div');
    card.className = 'history-card';
    const summary = experiment.summary ?? { averageInterest: 0, averageEnergy: 0, days: 0 };
    card.innerHTML = `<h3>${escapeHtml(experiment.title)}</h3><p>${experiment.status === 'complete' ? '已完成' : `第 ${experiment.day} / ${experiment.targetDays} 天`} · 兴趣 ${summary.averageInterest} / 精力 ${summary.averageEnergy} · ${summary.days} 条证据</p>`;
    for (const log of (experiment.logs ?? []).slice(-3)) {
      const entry = document.createElement('div');
      entry.className = 'log';
      entry.innerHTML = `<span>DAY ${log.day} · ${log.date} · 兴趣 ${log.interest} / 精力 ${log.energy}</span><p>${escapeHtml(log.evidence)}</p>`;
      card.appendChild(entry);
    }
    list.appendChild(card);
  }
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

function renderGraph() {
  const graph = state.data.graph;
  const svg = $('#graph');
  svg.innerHTML = '';
  const width = 820;
  const height = 560;
  const cx = width / 2;
  const cy = height / 2;
  const nodes = graph.nodes;
  const radius = Math.min(220, 90 + nodes.length * 5.5);
  const positions = new Map();
  nodes.forEach((node, index) => {
    const angle = (index / Math.max(1, nodes.length)) * Math.PI * 2 - Math.PI / 2;
    const ring = radius * (index % 3 === 0 ? 0.62 : index % 3 === 1 ? 0.9 : 1);
    positions.set(node.id, {
      x: cx + Math.cos(angle) * ring,
      y: cy + Math.sin(angle) * ring * 0.82,
    });
  });

  for (const edge of graph.edges) {
    const from = positions.get(edge.source);
    const to = positions.get(edge.target);
    if (!from || !to) continue;
    const line = document.createElementNS(svgNS, 'line');
    line.setAttribute('x1', from.x);
    line.setAttribute('y1', from.y);
    line.setAttribute('x2', to.x);
    line.setAttribute('y2', to.y);
    line.setAttribute('class', `edge ${edge.status === 'confirmed' ? 'confirmed' : ''}`);
    svg.appendChild(line);
  }

  const colors = { project: '#a78bfa', topic: '#34d399', document: '#38bdf8' };
  for (const node of nodes) {
    const pos = positions.get(node.id);
    const group = document.createElementNS(svgNS, 'g');
    group.setAttribute('class', `node ${state.selectedId === node.id ? 'selected' : ''}`);
    group.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);
    group.addEventListener('click', () => {
      state.selectedId = node.id;
      state.suggestions = [];
      state.index = 0;
      state.lastConnected = null;
      render();
    });
    const circle = document.createElementNS(svgNS, 'circle');
    circle.setAttribute('r', node.type === 'project' ? 11 : 8);
    circle.setAttribute('fill', colors[node.type] ?? '#94a3b8');
    group.appendChild(circle);
    const title = document.createElementNS(svgNS, 'title');
    title.textContent = node.title;
    group.appendChild(title);
    const label = document.createElementNS(svgNS, 'text');
    label.setAttribute('x', 12);
    label.setAttribute('y', 3);
    label.textContent = node.title.length > 27 ? `${node.title.slice(0, 27)}…` : node.title;
    group.appendChild(label);
    svg.appendChild(group);
  }
  $('#graph-subtitle').textContent = state.selectedId
    ? `当前焦点：${nodeTitle(state.selectedId)}`
    : '选择一个节点，让 AI 找一条最值得验证的连接。';
}

function renderAI() {
  const body = $('#ai-body');
  body.innerHTML = '';
  if (state.lastConnected) {
    const success = document.createElement('div');
    success.className = 'success';
    success.innerHTML = `<strong>已连上这条关系</strong><span>图谱已更新，可以撤销。</span>`;
    const actions = document.createElement('div');
    actions.className = 'actions';
    const undo = document.createElement('button');
    undo.className = 'button danger';
    undo.textContent = '撤销';
    undo.addEventListener('click', undoConnect);
    const done = document.createElement('button');
    done.className = 'button ghost';
    done.textContent = '继续看';
    done.addEventListener('click', () => {
      state.lastConnected = null;
      renderAI();
    });
    actions.append(undo);
    if (!state.data.activeExperiment) {
      const start = document.createElement('button');
      start.className = 'button green';
      start.textContent = '开始 3 天实验';
      start.addEventListener('click', () => startExperiment(nodeTitle(state.lastConnected.target)));
      actions.append(start);
    }
    actions.append(done);
    success.appendChild(actions);
    body.appendChild(success);
  }

  const selected = state.data.graph.nodes.find((node) => node.id === state.selectedId);
  if (!selected) {
    body.innerHTML += `<div class="ai-empty"><h3>先扫描你的 vault</h3><p>InterestSeed 读取 Markdown 文件，建立图谱，然后让本地 AI 找一条可验证的连接。</p><div class="stack"><button class="button primary" id="empty-scan">扫描 vault</button></div></div>`;
    $('#empty-scan')?.addEventListener('click', scanVault);
    return;
  }

  if (!state.suggestions.length) {
    if (state.busy) {
      const waiting = document.createElement('div');
      waiting.className = 'ai-empty';
      waiting.innerHTML = `<h3>AI 正在看你的图谱…</h3><p>它只会挑一条最值得验证的连接。第一次调用本地模型可能需要一点时间。</p>`;
      body.appendChild(waiting);
      return;
    }
    const card = document.createElement('div');
    card.className = 'ai-empty';
    card.innerHTML = `<h3>从「${escapeHtml(selected.title)}」开始</h3><p>AI 会先看这个节点，再从图谱里挑一条最值得验证的连接。一次只给一条。</p>`;
    const stack = document.createElement('div');
    stack.className = 'stack';
    const suggest = document.createElement('button');
    suggest.className = 'button primary';
    suggest.textContent = '用 AI 找一条连接';
    suggest.addEventListener('click', () => suggestFor(selected.id));
    const scan = document.createElement('button');
    scan.className = 'button ghost';
    scan.textContent = '重新扫描 vault';
    scan.addEventListener('click', scanVault);
    stack.append(suggest, scan);
    card.appendChild(stack);
    body.appendChild(card);
    return;
  }

  const current = state.suggestions[state.index];
  if (!current) {
    state.suggestions = [];
    return renderAI();
  }
  const meta = document.createElement('div');
  meta.className = 'suggestion-meta';
  meta.innerHTML = `<span>AI 建议 · ${state.index + 1} / ${state.suggestions.length}</span><span>本地模型</span>`;
  body.appendChild(meta);

  const card = document.createElement('div');
  card.className = 'suggestion-card';
  const title = document.createElement('h3');
  title.textContent = `${nodeTitle(current.source)} → ${nodeTitle(current.target)}`;
  const label = document.createElement('label');
  label.textContent = '关系名';
  const input = document.createElement('input');
  input.value = current.relation ?? '相关';
  input.maxLength = 120;
  input.addEventListener('change', () => {
    current.relation = input.value.trim() || current.relation;
  });
  const reason = document.createElement('p');
  reason.className = 'reason';
  reason.textContent = current.reason ? `理由：${current.reason}` : '模型没有给理由。';
  const actions = document.createElement('div');
  actions.className = 'suggestion-actions';
  const connect = document.createElement('button');
  connect.className = 'button primary';
  connect.textContent = state.busy ? '连上中…' : '连上';
  connect.disabled = state.busy;
  connect.addEventListener('click', () => connectSuggestion(current));
  const next = document.createElement('button');
  next.className = 'button ghost';
  next.textContent = '换一个';
  next.disabled = state.busy || state.suggestions.length <= 1;
  next.addEventListener('click', () => {
    state.index = (state.index + 1) % state.suggestions.length;
    renderAI();
  });
  const skip = document.createElement('button');
  skip.className = 'button ghost';
  skip.textContent = '先不用';
  skip.disabled = state.busy;
  skip.addEventListener('click', () => {
    state.suggestions.splice(state.index, 1);
    if (state.index >= state.suggestions.length) state.index = 0;
    renderAI();
  });
  actions.append(connect, next, skip);
  card.append(title, label, input, reason, actions);
  body.appendChild(card);
}

async function scanVault() {
  try {
    setBusy(true);
    await api('/api/scan', { method: 'POST' });
    await load();
    toast('扫描完成');
  } catch (error) {
    toast(error.message, true);
  } finally {
    setBusy(false);
  }
}

async function suggestFor(nodeId) {
  try {
    setBusy(true);
    const result = await api(`/api/suggest?nodeId=${encodeURIComponent(nodeId)}`);
    state.suggestions = result.suggestions ?? [];
    state.index = 0;
    renderAI();
    if (!state.suggestions.length) toast('模型没有返回候选关系。');
  } catch (error) {
    toast(error.message, true);
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
  element.textContent = message;
  element.style.color = error ? '#fecdd3' : '';
  element.hidden = false;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { element.hidden = true; }, 3500);
}

$('#scan-button').addEventListener('click', scanVault);
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
