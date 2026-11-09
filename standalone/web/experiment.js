export function createExperimentView({ state, $, escapeHtml, toast, api, load, openModal, closeModal, setBusy }) {
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
    start.addEventListener('click', () => openExperimentModal());
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
    const decide = async (decision) => {
      try {
        await api('/api/experiments/decision', {
          method: 'POST',
          body: JSON.stringify({ id: experiment.id, decision }),
        });
        toast(decision === 'keep' ? '已记下：继续。' : decision === 'change' ? '已记下：换一种做法。' : '已记下：放下。');
      } catch (error) {
        toast(error instanceof Error ? error.message : '决定保存失败。', true);
      }
    };
    for (const [label, decision] of [['继续', 'keep'], ['换一种做法', 'change'], ['放下', 'drop']]) {
      const button = document.createElement('button');
      button.className = decision === 'keep' ? 'button primary' : 'button ghost';
      button.textContent = label;
      button.addEventListener('click', () => decide(decision));
      actions.appendChild(button);
    }
    strip.appendChild(actions);
    return;
  }

  const evidence = document.createElement('input');
  evidence.placeholder = '今天实际做了什么？';
  evidence.maxLength = 160;
  const next = document.createElement('input');
  next.placeholder = '下一步想做什么？（可选）';
  next.maxLength = 120;
  const record = document.createElement('button');
  record.className = 'button primary';
  record.textContent = '记录';
  record.addEventListener('click', () => {
    const value = evidence.value.trim();
    if (value.length < 4) return toast('至少写 4 个字的真实观察。', true);
    logExperiment({ evidence: value, interest: 4, energy: 4, ...(next.value.trim() ? { next: next.value.trim() } : {}) });
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
  actions.append(evidence, next, record, did, thought, missed);
  if (experiment.targetDays === 3 && experiment.status === 'active') {
    const extend = document.createElement('button');
    extend.className = 'button ghost';
    extend.textContent = '延长到 7 天';
    extend.addEventListener('click', () => extendExperiment(experiment.id));
    actions.append(extend);
  }
  strip.appendChild(actions);
}

function openExperimentModal(title) {
  const selected = state.data.graph.nodes.find((node) => node.id === state.selectedId);
  const targetTitle = title || selected?.title || '';
  if (!targetTitle) return toast('先选择一个节点。', true);
  $('#experiment-title').value = targetTitle;
  $('#experiment-hypothesis').value = `我愿意连续 3 天为「${targetTitle}」做一次真实行动。`;
  $('#experiment-days').value = '3';
  openModal('experiment-modal');
}

async function submitExperimentStart() {
  const selected = state.data.graph.nodes.find((node) => node.id === state.selectedId);
  const title = $('#experiment-title').value.trim();
  if (!title) return toast('实验需要一个标题。', true);
  try {
    setBusy(true);
    await api('/api/experiments', {
      method: 'POST',
      body: JSON.stringify({
        title,
        hypothesis: $('#experiment-hypothesis').value.trim(),
        targetDays: Number($('#experiment-days').value),
        nodeId: selected?.id,
      }),
    });
    closeModal('experiment-modal');
    await load();
    toast('实验已开始');
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

async function extendExperiment(id) {
  try {
    setBusy(true);
    await api('/api/experiments/extend', { method: 'POST', body: JSON.stringify({ id, targetDays: 7 }) });
    await load();
    toast('实验已延长到 7 天');
  } catch (error) {
    toast(error.message, true);
  } finally {
    setBusy(false);
  }
}


  return {
    render: renderExperiment,
    open: openExperimentModal,
    submit: submitExperimentStart,
    log: logExperiment,
    extend: extendExperiment,
  };
}