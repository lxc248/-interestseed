export function createCollectionsView({ state, $, escapeHtml, shareCard, friendlyFeedback, openCorrection, applyDiscovery, feedbackDiscovery, dismissDiscovery, resolveInboxItem }) {
function renderDiscoveries() {
  const list = $('#discoveries-list');
  list.innerHTML = '';
  const discoveries = state.data.discoveries ?? [];
  if (!discoveries.length) {
    list.innerHTML = `<p class="empty-copy">还没有跨目录发现。先确认几条关系，再点刷新。发现只使用共享标签和已确认关系，不读正文。</p>`;
    return;
  }
  const counts = { accepted: 0, 'needs-verification': 0, 'low-value': 0, rejected: 0 };
  for (const item of discoveries) {
    const key = item.feedbackStatus ?? 'none';
    if (counts[key] !== undefined) counts[key] += 1;
  }
  const audit = document.createElement('div');
  audit.className = 'audit-chips';
  audit.innerHTML = `<span>体检：</span><span>已留下 ${counts.accepted}</span><span>想再看看 ${counts['needs-verification']}</span><span>先放着 ${counts['low-value']}</span><span>先不看 ${counts.rejected}</span>`;
  list.appendChild(audit);

  for (const item of discoveries) {
    const card = document.createElement('div');
    card.className = 'discovery-card';
    const badge = friendlyFeedback(item.feedbackStatus ?? 'none');
    card.innerHTML = `<h3>${escapeHtml(item.title)} <span class="feedback-badge">${badge}</span></h3><p>${escapeHtml(item.description)}</p>`;
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
    if (item.correction?.description) {
      const correction = document.createElement('p');
      correction.className = 'next';
      correction.textContent = `你改过：${item.correction.description}`;
      card.appendChild(correction);
    }
    const actions = document.createElement('div');
    actions.className = 'card-actions';
    const apply = document.createElement('button');
    apply.className = 'button primary';
    apply.textContent = '连上这两个节点';
    apply.addEventListener('click', () => applyDiscovery(item.id));
    const review = document.createElement('button');
    review.className = 'button ghost';
    review.textContent = '想再看看';
    review.addEventListener('click', () => feedbackDiscovery(item.id, 'needs-verification'));
    const park = document.createElement('button');
    park.className = 'button ghost';
    park.textContent = '先放着';
    park.addEventListener('click', () => feedbackDiscovery(item.id, 'low-value'));
    const edit = document.createElement('button');
    edit.className = 'button ghost';
    edit.textContent = '改一下';
    edit.addEventListener('click', () => openCorrection(item.id));
    const dismiss = document.createElement('button');
    dismiss.className = 'button ghost';
    dismiss.textContent = '先不看';
    dismiss.addEventListener('click', () => dismissDiscovery(item.id));
    actions.append(apply, review, park, edit, dismiss);
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
    const share = document.createElement('button');
    share.className = 'button ghost';
    share.textContent = '做成图';
    share.addEventListener('click', () => shareCard.open(item));
    actions.append(keep, pass, share);
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
      entry.innerHTML = `<span>DAY ${log.day} · ${log.date} · 兴趣 ${log.interest} / 精力 ${log.energy}</span><p>${escapeHtml(log.evidence)}</p>${log.next ? `<p class="next">下一步：${escapeHtml(log.next)}</p>` : ''}`;
      card.appendChild(entry);
    }
    list.appendChild(card);
  }
}


  return {
    renderDiscoveries,
    renderInbox,
    renderHistory,
  };
}