export function createSummaryView({ state, $, escapeHtml }) {
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


  return { renderStats, renderInsights };
}