export function createSuggestedView({ state, $, escapeHtml, toast, api, load }) {
  async function confirm(edge) {
    state.busy = true;
    try {
      await api('/api/connect', {
        method: 'POST',
        body: JSON.stringify({
          suggestion: {
            source: edge.source,
            target: edge.target,
            relation: edge.relation ?? 'related',
            reason: edge.evidence?.[0]?.text ?? '规则建议',
            confidence: 0.5,
          },
        }),
      });
      await load();
      toast('已确认这条连接。');
    } catch (error) {
      toast(error instanceof Error ? error.message : '确认失败。', true);
    } finally {
      state.busy = false;
    }
  }

  async function reject(edge) {
    try {
      await api('/api/edges/reject', {
        method: 'POST',
        body: JSON.stringify({ edgeId: edge.id }),
      });
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : '忽略失败。', true);
    }
  }

  function render() {
    const strip = $('#suggested-strip');
    if (!strip) return;
    const edges = (state.data.graph.edges ?? []).filter((edge) => edge.status === 'suggested');
    if (!edges.length) {
      strip.innerHTML = '';
      return;
    }
    const nodes = new Map((state.data.graph.nodes ?? []).map((node) => [node.id, node]));
    strip.innerHTML = '';
    for (const edge of edges.slice(0, 12)) {
      const card = document.createElement('div');
      card.className = 'suggested-card';
      const source = nodes.get(edge.source)?.title ?? edge.source;
      const target = nodes.get(edge.target)?.title ?? edge.target;
      card.innerHTML = `<h3>${escapeHtml(source)} ↔ ${escapeHtml(target)}</h3><p>${escapeHtml(edge.relation ?? '规则建议')} · 待你确认</p>`;
      const actions = document.createElement('div');
      actions.className = 'card-actions';
      const accept = document.createElement('button');
      accept.className = 'button primary';
      accept.textContent = '确认连接';
      accept.addEventListener('click', () => confirm(edge));
      const ignore = document.createElement('button');
      ignore.className = 'button ghost';
      ignore.textContent = '忽略';
      ignore.addEventListener('click', () => reject(edge));
      actions.append(accept, ignore);
      card.appendChild(actions);
      strip.appendChild(card);
    }
  }

  return { render };
}
