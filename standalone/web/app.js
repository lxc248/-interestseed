import { api } from './session.js';
import { createSuggestedView } from './suggested.js';
import { createShareCard } from './share-card.js';
import { createExperimentView } from './experiment.js';
import { createCollectionsView } from './collections.js';
import { createAiView } from './ai.js';
import { createGraphView } from './graph.js';
import { createChainView } from './chain.js';
import { createSummaryView } from './summary.js';

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
const graphView = createGraphView({ state, $, svgNS, svgEl, nodeTitle, chainStateOf, chainMeta, render });
const chainView = createChainView({ state, escapeHtml, nodeTitle, chainStateOf, chainMeta });
const summaryView = createSummaryView({ state, $, escapeHtml });
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
  summaryView.renderStats();
}

function renderInsights() {
  summaryView.renderInsights();
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
  chainView.render();
}
function renderGraph() {
  graphView.render();
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
