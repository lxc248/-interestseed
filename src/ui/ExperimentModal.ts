import { Modal, Notice, setIcon } from 'obsidian';
import type { App } from 'obsidian';
import type InterestSeedPlugin from '../main';

/**
 * Strict 7-day experiment workspace.
 * One check-in per calendar day; a concrete observation is mandatory.
 */
export class ExperimentModal extends Modal {
  private interest = 3;
  private energy = 3;
  private evidence = '';
  private next = '';

  constructor(
    app: App,
    private readonly plugin: InterestSeedPlugin,
  ) {
    super(app);
    this.modalEl.addClass('interestseed-experiment-modal');
  }

  override onOpen(): void {
    this.render();
  }

  override onClose(): void {
    this.contentEl.empty();
  }

  private render(): void {
    const active = this.plugin.getActiveExperiment();
    const root = this.contentEl;
    root.empty();
    root.addClass('interestseed-experiment');
    if (!active) {
      this.renderEmpty(root);
      return;
    }
    const { state, gate, summary } = active;
    const header = root.createDiv({ cls: 'interestseed-experiment-header' });
    const mark = header.createDiv({ cls: 'interestseed-experiment-mark' });
    setIcon(mark, 'flask-conical');
    const copy = header.createDiv();
    copy.createDiv({ cls: 'interestseed-experiment-kicker', text: `INTEREST EXPERIMENT · ${state.targetDays} DAYS` });
    copy.createEl('h2', { cls: 'interestseed-experiment-title', text: state.title });
    copy.createEl('p', {
      cls: 'interestseed-experiment-hypothesis',
      text:
        state.targetDays === 3
          ? state.hypothesis.replace('7 天', '3 天')
          : state.hypothesis,
    });
    copy.createDiv({ cls: 'interestseed-experiment-metric', text: state.metric });
    if (state.targetDays === 7 && state.logs.length === 0 && state.status === 'active') {
      const starter = copy.createEl('button', {
        cls: 'interestseed-experiment-starter',
        text: '先做 3 天试跑',
        attr: { type: 'button' },
      });
      starter.style.setProperty('background', 'rgba(232, 200, 132, 0.10)', 'important');
      starter.style.setProperty('color', '#e8c884', 'important');
      starter.style.setProperty('border', '1px solid rgba(232, 200, 132, 0.30)', 'important');
      starter.style.setProperty('border-radius', '6px', 'important');
      starter.style.setProperty('padding', '2px 8px', 'important');
      starter.addEventListener('click', () => {
        if (this.plugin.startStarterExperiment()) this.render();
      });
    }

    const progress = root.createDiv({ cls: 'interestseed-experiment-progress' });
    for (let day = 1; day <= state.targetDays; day += 1) {
      const item = progress.createDiv({
        cls: `interestseed-experiment-day${day <= state.logs.length ? ' is-done' : ''}${day === state.logs.length + 1 && state.status !== 'complete' ? ' is-today' : ''}`,
      });
      item.createSpan({ cls: 'interestseed-experiment-day-number', text: String(day) });
      item.createSpan({
        cls: 'interestseed-experiment-day-label',
        text: day <= state.logs.length ? '已记录' : day === state.logs.length + 1 ? '今天' : '待开始',
      });
    }

    const logs = root.createDiv({ cls: 'interestseed-experiment-logs' });
    for (const log of state.logs) {
      const row = logs.createDiv({ cls: 'interestseed-experiment-log' });
      row.createDiv({ cls: 'interestseed-experiment-log-day', text: `Day ${log.day}` });
      const body = row.createDiv({ cls: 'interestseed-experiment-log-body' });
      body.createDiv({ cls: 'interestseed-experiment-log-evidence', text: log.evidence });
      body.createDiv({
        cls: 'interestseed-experiment-log-meta',
        text: `${log.date} · 兴趣 ${log.interest}/5 · 精力 ${log.energy}/5${log.next ? ` · 下一步：${log.next}` : ''}`,
      });
    }

    if (state.status === 'complete') {
      const review = root.createDiv({ cls: 'interestseed-experiment-review' });
      review.createDiv({ cls: 'interestseed-experiment-review-title', text: '实验完成，做一次复盘' });
      review.createDiv({
        cls: 'interestseed-experiment-review-text',
        text: `${state.targetDays} 天平均兴趣 ${summary.averageInterest}/5，平均精力 ${summary.averageEnergy}/5。现在回看：这个兴趣值得继续、转向，还是先放下？`,
      });
      const actions = root.createDiv({ cls: 'interestseed-experiment-actions' });
      if (state.targetDays === 3) {
        const extend = actions.createEl('button', {
          cls: 'interestseed-sprint-secondary',
          text: '继续到 7 天',
          attr: { type: 'button' },
        });
        extend.addEventListener('click', () => {
          if (this.plugin.extendExperimentToSeven()) this.render();
        });
      }
      const close = actions.createEl('button', {
        cls: 'mod-cta interestseed-sprint-primary',
        text: '回到图谱',
        attr: { type: 'button' },
      });
      close.addEventListener('click', () => {
        void this.plugin.activateView();
        this.close();
      });
      return;
    }

    const form = root.createDiv({ cls: 'interestseed-experiment-form' });
    if (!gate.ok) {
      form.createDiv({ cls: 'interestseed-experiment-locked', text: gate.reason ?? '今天不能记录。' });
      const actions = root.createDiv({ cls: 'interestseed-experiment-actions' });
      const close = actions.createEl('button', {
        cls: 'interestseed-sprint-secondary',
        text: '关闭',
        attr: { type: 'button' },
      });
      close.addEventListener('click', () => this.close());
      return;
    }

    form.createDiv({
      cls: 'interestseed-experiment-form-title',
      text: `Day ${gate.day} · 今天怎么样？`,
    });
    form.createDiv({
      cls: 'interestseed-experiment-form-hint',
      text: '点一下就能记录，不需要写长文。想补充观察时再展开。',
    });

    const quick = form.createDiv({ cls: 'interestseed-experiment-quick' });
    const quickOptions = [
      { key: 'did', label: '做了', detail: '今天真的做了一件', icon: 'check' },
      { key: 'thought', label: '只想过', detail: '没有行动，但想起过', icon: 'cloud' },
      { key: 'missed', label: '没做', detail: '今天没有发生', icon: 'minus' },
    ] as const;
    for (const option of quickOptions) {
      const button = quick.createEl('button', {
        cls: `interestseed-experiment-quick-button is-${option.key}`,
        attr: {
          type: 'button',
          'aria-label': `记录：${option.label}。${option.detail}`,
        },
      });
      const icon = button.createDiv({ cls: 'interestseed-experiment-quick-icon' });
      setIcon(icon, option.icon);
      button.createDiv({ cls: 'interestseed-experiment-quick-label', text: option.label });
      button.createDiv({ cls: 'interestseed-experiment-quick-detail', text: option.detail });
      button.addEventListener('click', () => this.recordQuick(option.key));
    }

    const details = form.createEl('details', { cls: 'interestseed-experiment-more' });
    details.createEl('summary', { text: '补充详细观察（可选）' });
    this.renderScale(details, '兴趣强度', 'interest', this.interest, (value) => {
      this.interest = value;
    });
    this.renderScale(details, '精力值', 'energy', this.energy, (value) => {
      this.energy = value;
    });
    const evidenceLabel = details.createEl('label', { cls: 'interestseed-experiment-field' });
    evidenceLabel.createSpan({ text: '具体证据 / 观察' });
    const evidence = evidenceLabel.createEl('textarea', {
      cls: 'interestseed-experiment-input',
      attr: {
        rows: '3',
        placeholder: '例如：今天用一个小时做了一个小原型，发现自己真正感兴趣的是“让陌生人愿意开口”，而不是工具本身。',
      },
    });
    evidence.addEventListener('input', () => {
      this.evidence = evidence.value;
    });
    const nextLabel = details.createEl('label', { cls: 'interestseed-experiment-field' });
    nextLabel.createSpan({ text: '下一步（可选）' });
    const next = nextLabel.createEl('input', {
      cls: 'interestseed-experiment-input',
      attr: { type: 'text', placeholder: '明天想验证什么？' },
    });
    next.addEventListener('input', () => {
      this.next = next.value;
    });

    const actions = details.createDiv({ cls: 'interestseed-experiment-actions' });
    const submit = actions.createEl('button', {
      cls: 'mod-cta interestseed-sprint-primary',
      text: `保存第 ${gate.day} 天观察`,
      attr: { type: 'button' },
    });
    submit.addEventListener('click', () => {
      const ok = this.plugin.recordExperimentCheckIn({
        interest: this.interest,
        energy: this.energy,
        evidence: this.evidence,
        next: this.next,
      });
      if (!ok) {
        new Notice('记录没有保存，请检查观察内容。');
        return;
      }
      this.interest = 3;
      this.energy = 3;
      this.evidence = '';
      this.next = '';
      this.render();
    });
  }

  private recordQuick(kind: 'did' | 'thought' | 'missed'): void {
    const presets = {
      did: {
        interest: 4,
        energy: 4,
        evidence: '今天实际做了一件和这个兴趣有关的事。',
        notice: '已记录：今天做了。',
      },
      thought: {
        interest: 3,
        energy: 2,
        evidence: '今天没有行动，但想起过这个兴趣。',
        notice: '已记录：只想过。',
      },
      missed: {
        interest: 2,
        energy: 1,
        evidence: '今天没有做，也没有特别想起这个兴趣。',
        notice: '已记录：今天没做。',
      },
    } as const;
    const preset = presets[kind];
    const ok = this.plugin.recordExperimentCheckIn({
      interest: preset.interest,
      energy: preset.energy,
      evidence: preset.evidence,
    });
    if (!ok) {
      new Notice('今天已经记录过了，或者实验已经结束。');
      return;
    }
    new Notice(preset.notice);
    this.render();
  }

  private renderScale(
    host: HTMLElement,
    label: string,
    key: 'interest' | 'energy',
    current: number,
    onChange: (value: number) => void,
  ): void {
    const field = host.createDiv({ cls: 'interestseed-experiment-scale' });
    field.createDiv({ cls: 'interestseed-experiment-scale-label', text: label });
    const row = field.createDiv({ cls: 'interestseed-experiment-scale-options' });
    for (let value = 1; value <= 5; value += 1) {
      const button = row.createEl('button', {
        cls: `interestseed-experiment-scale-button${value === current ? ' is-active' : ''}`,
        text: String(value),
        attr: { type: 'button', 'data-scale': key, 'aria-pressed': String(value === current) },
      });
      button.addEventListener('click', () => {
        for (const child of Array.from(row.children)) {
          child.removeClass('is-active');
          child.setAttribute('aria-pressed', 'false');
        }
        button.addClass('is-active');
        button.setAttribute('aria-pressed', 'true');
        onChange(value);
      });
    }
  }

  private renderEmpty(root: HTMLElement): void {
    const empty = root.createDiv({ cls: 'interestseed-experiment-empty' });
    const icon = empty.createDiv({ cls: 'interestseed-experiment-mark' });
    setIcon(icon, 'flask-conical');
    empty.createEl('h2', { cls: 'interestseed-experiment-title', text: '还没有进行中的实验' });
    empty.createEl('p', {
      cls: 'interestseed-experiment-hypothesis',
      text: '冷启动问卷会生成一个 3 天试跑；完成第一张星图后，这里会出现每天的记录入口。',
    });
    const close = empty.createEl('button', {
      cls: 'mod-cta interestseed-sprint-primary',
      text: '开始冷启动问卷',
      attr: { type: 'button' },
    });
    close.addEventListener('click', () => {
      this.close();
      this.plugin.openSeedSprint();
    });
  }
}
