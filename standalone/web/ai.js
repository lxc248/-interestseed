export function createAiView({ state, $, escapeHtml, nodeTitle, chainStateOf, chainMeta, suggestFor, undoConnect, openSettings, openExperimentModal, openDiscoveryAudit, setBusy, api, load }) {
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
      start.addEventListener('click', () => openExperimentModal(nodeTitle(state.lastConnected.target)));
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
    if (state.aiError) {
      const failed = document.createElement('div');
      failed.className = 'ai-empty';
      failed.innerHTML = `<h3>AI 没连上</h3><p>${escapeHtml(state.aiError)}</p>`;
      const stack = document.createElement('div');
      stack.className = 'stack';
      const retry = document.createElement('button');
      retry.className = 'button primary';
      retry.textContent = '重试';
      retry.addEventListener('click', () => suggestFor(selected.id));
      const settings = document.createElement('button');
      settings.className = 'button ghost';
      settings.textContent = '打开设置';
      settings.addEventListener('click', openSettings);
      stack.append(retry, settings);
      failed.appendChild(stack);
      body.appendChild(failed);
      return;
    }
    const stage = chainStateOf(selected.id);
    const stageMeta = chainMeta(stage);
    const card = document.createElement('div');
    card.className = 'ai-empty';
    card.innerHTML = `<h3>「${escapeHtml(selected.title)}」 · ${escapeHtml(stageMeta.label)}</h3><p>下一步：${escapeHtml(stageMeta.next)}</p>`;
    const stack = document.createElement('div');
    stack.className = 'stack';
    if (stage === 'captured') {
      const suggest = document.createElement('button');
      suggest.className = 'button primary';
      suggest.textContent = '用 AI 找一条连接';
      suggest.addEventListener('click', () => suggestFor(selected.id));
      stack.append(suggest);
    } else if (stage === 'connected') {
      const start = document.createElement('button');
      start.className = 'button primary';
      start.textContent = '开始 3 天实验';
      start.addEventListener('click', () => openExperimentModal(selected.title));
      stack.append(start);
    } else if (stage === 'experimenting') {
      const log = document.createElement('button');
      log.className = 'button primary';
      log.textContent = '记录今天的证据';
      log.addEventListener('click', () => document.getElementById('experiment-strip')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
      stack.append(log);
    } else {
      const audit = document.createElement('button');
      audit.className = 'button primary';
      audit.textContent = '打开发现体检';
      audit.addEventListener('click', openDiscoveryAudit);
      stack.append(audit);
    }
    const scan = document.createElement('button');
    scan.className = 'button ghost';
    scan.textContent = '重新扫描 vault';
    scan.addEventListener('click', scanVault);
    stack.append(scan);
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


  return { render: renderAI, scanVault };
}