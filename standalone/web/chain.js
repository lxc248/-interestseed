export function createChainView({ state, escapeHtml, nodeTitle, chainStateOf, chainMeta }) {
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


  return { render: renderChainStrip };
}