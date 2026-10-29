import { Modal, Notice, setIcon } from 'obsidian';
import type { App } from 'obsidian';
import type InterestSeedPlugin from '../main';
import {
  buildSeedSprintDraft,
  SEED_SPRINT_ROUNDS,
  type SeedSprintDraft,
  type SeedSprintSelection,
} from '../onboarding/seedSprint';

/**
 * 冷启动问卷引导。
 *
 * 这是 InterestSeed 的 0 → 1 入口：用户做四个选择，看到一张会生长的
 * 兴趣星图，再逐项确认要写入图谱的种子和关系。所有写入都发生在最后一步。
 */
export class SeedSprintModal extends Modal {
  private step = -1;
  private selection: SeedSprintSelection = {};
  private draft: SeedSprintDraft | null = null;
  private acceptedNodes = new Set<string>();
  private acceptedEdges = new Set<string>();
  private appliedCount = 0;
  private roundIndex = 0;

  constructor(
    app: App,
    private readonly plugin: InterestSeedPlugin,
  ) {
    super(app);
    this.modalEl.addClass('interestseed-sprint-modal');
  }

  override onOpen(): void {
    this.modalEl.setAttribute('aria-label', '冷启动问卷');
    this.render();
  }

  override onClose(): void {
    this.contentEl.empty();
  }

  private render(): void {
    this.contentEl.empty();
    this.contentEl.addClass('interestseed-sprint');

    if (this.step === -1) this.renderIntro();
    else if (this.step < SEED_SPRINT_ROUNDS.length) this.renderRound();
    else if (this.step === SEED_SPRINT_ROUNDS.length) this.renderDraft();
    else this.renderDone();
  }

  private renderIntro(): void {
    const hero = this.contentEl.createDiv({ cls: 'interestseed-sprint-hero' });
    const constellation = hero.createDiv({ cls: 'interestseed-sprint-constellation' });
    for (let index = 0; index < 9; index += 1) {
      const star = constellation.createDiv({
        cls: `interestseed-sprint-star is-star-${index + 1}`,
      });
      star.setAttribute('aria-hidden', 'true');
    }
    const copy = hero.createDiv({ cls: 'interestseed-sprint-hero-copy' });
    copy.createDiv({ cls: 'interestseed-sprint-kicker', text: 'INTERESTSEED · 3 MINUTES' });
    copy.createEl('h2', {
      cls: 'interestseed-sprint-headline',
      text: '你不需要先知道自己喜欢什么。',
    });
    copy.createEl('p', {
      cls: 'interestseed-sprint-lede',
      text: '做四个选择。看你的兴趣在眼前连成一张会生长的星图，再决定哪些种子值得留下。',
    });
    const meta = copy.createDiv({ cls: 'interestseed-sprint-meta' });
    for (const item of ['不读取笔记', '不需要登录', '随时撤销']) {
      meta.createSpan({ cls: 'interestseed-sprint-meta-item', text: item });
    }
    const actions = copy.createDiv({ cls: 'interestseed-sprint-actions' });
    const start = actions.createEl('button', {
      cls: 'mod-cta interestseed-sprint-primary',
      text: '开始长出我的星图',
      attr: { type: 'button' },
    });
    start.addEventListener('click', () => {
      this.step = 0;
      this.roundIndex = 0;
      this.render();
    });
    const skip = actions.createEl('button', {
      cls: 'interestseed-sprint-secondary',
      text: '先看看空白图谱',
      attr: { type: 'button' },
    });
    skip.addEventListener('click', () => this.close());

    const promise = this.contentEl.createDiv({ cls: 'interestseed-sprint-promise' });
    promise.createSpan({ text: 'CURIOUS' });
    promise.createSpan({ cls: 'interestseed-sprint-promise-line' });
    promise.createSpan({ text: 'CONNECTED' });
    promise.createSpan({ cls: 'interestseed-sprint-promise-line' });
    promise.createSpan({ text: 'YOURS' });
  }

  private renderRound(): void {
    const round = SEED_SPRINT_ROUNDS[this.roundIndex]!;
    const shell = this.contentEl.createDiv({ cls: 'interestseed-sprint-round' });
    const top = shell.createDiv({ cls: 'interestseed-sprint-round-top' });
    top.createDiv({ cls: 'interestseed-sprint-step', text: `${this.roundIndex + 1} / ${SEED_SPRINT_ROUNDS.length}` });
    this.renderProgress(top, this.roundIndex, SEED_SPRINT_ROUNDS.length);
    const body = shell.createDiv({ cls: 'interestseed-sprint-round-body' });
    body.createDiv({ cls: 'interestseed-sprint-eyebrow', text: round.eyebrow });
    body.createEl('h2', { cls: 'interestseed-sprint-question', text: round.question });
    body.createEl('p', { cls: 'interestseed-sprint-hint', text: round.hint });

    const grid = body.createDiv({ cls: 'interestseed-sprint-options' });
    const selected = this.selection[round.id];
    for (const option of round.options) {
      const button = grid.createEl('button', {
        cls: `interestseed-sprint-option is-tone-${option.tone}${selected === option.id ? ' is-selected' : ''}`,
        attr: { type: 'button', 'aria-pressed': String(selected === option.id) },
      });
      const icon = button.createDiv({ cls: 'interestseed-sprint-option-icon' });
      setIcon(icon, option.icon);
      button.createDiv({ cls: 'interestseed-sprint-option-title', text: option.title });
      button.createDiv({ cls: 'interestseed-sprint-option-subtitle', text: option.subtitle });
      button.createDiv({ cls: 'interestseed-sprint-option-check' });
      button.addEventListener('click', () => {
        this.selection[round.id] = option.id;
        for (const child of Array.from(grid.children)) {
          child.removeClass('is-selected');
          child.setAttribute('aria-pressed', 'false');
        }
        button.addClass('is-selected');
        button.setAttribute('aria-pressed', 'true');
        this.updateRoundActions();
      });
    }

    const footer = shell.createDiv({ cls: 'interestseed-sprint-round-footer' });
    const back = footer.createEl('button', {
      cls: 'interestseed-sprint-secondary',
      text: this.roundIndex === 0 ? '退出' : '上一步',
      attr: { type: 'button' },
    });
    back.addEventListener('click', () => {
      if (this.roundIndex === 0) this.close();
      else {
        this.roundIndex -= 1;
        this.step = this.roundIndex;
        this.render();
      }
    });
    const next = footer.createEl('button', {
      cls: 'mod-cta interestseed-sprint-primary',
      text: this.roundIndex === SEED_SPRINT_ROUNDS.length - 1 ? '生成草稿' : '继续',
      attr: { type: 'button', 'data-sprint-next': '' },
    });
    next.disabled = !selected;
    next.addEventListener('click', () => {
      if (!this.selection[round.id]) return;
      if (this.roundIndex === SEED_SPRINT_ROUNDS.length - 1) {
        this.draft = buildSeedSprintDraft(this.selection);
        this.acceptedNodes = new Set(this.draft.nodes.map((node) => node.id));
        this.acceptedEdges = new Set(this.draft.edges.map((edge) => edge.id));
        this.step = SEED_SPRINT_ROUNDS.length;
        this.render();
      } else {
        this.roundIndex += 1;
        this.step = this.roundIndex;
        this.render();
      }
    });
  }

  private renderProgress(host: HTMLElement, active: number, total: number): void {
    const bars = host.createDiv({ cls: 'interestseed-sprint-progress' });
    for (let index = 0; index < total; index += 1) {
      const bar = bars.createDiv({ cls: 'interestseed-sprint-progress-bar' });
      if (index < active) bar.addClass('is-done');
      if (index === active) bar.addClass('is-active');
    }
  }

  private updateRoundActions(): void {
    const next = this.contentEl.querySelector<HTMLButtonElement>('[data-sprint-next]');
    const round = SEED_SPRINT_ROUNDS[this.roundIndex]!;
    if (next) next.disabled = !this.selection[round.id];
  }

  private renderDraft(): void {
    if (!this.draft) return;
    const draft = this.draft;
    const shell = this.contentEl.createDiv({ cls: 'interestseed-sprint-draft' });
    const header = shell.createDiv({ cls: 'interestseed-sprint-draft-header' });
    header.createDiv({ cls: 'interestseed-sprint-kicker', text: 'YOUR FIRST CONSTELLATION' });
    header.createEl('h2', { cls: 'interestseed-sprint-headline', text: '你的兴趣，开始有形状了。' });
    header.createEl('p', {
      cls: 'interestseed-sprint-lede',
      text: '这不是自动生成的答案，而是一张草稿。保留你认可的种子和连接，剩下的可以直接丢掉。',
    });
    const stats = header.createDiv({ cls: 'interestseed-sprint-stats' });
    this.stat(stats, String(draft.nodes.length), '种子');
    this.stat(stats, String(draft.edges.length), '候选连接');
    this.stat(stats, '1', '3 天试跑');

    const body = shell.createDiv({ cls: 'interestseed-sprint-draft-body' });
    const nodesSection = body.createDiv({ cls: 'interestseed-sprint-section' });
    nodesSection.createDiv({ cls: 'interestseed-sprint-section-label', text: '种子' });
    const nodeGrid = nodesSection.createDiv({ cls: 'interestseed-sprint-node-grid' });
    for (const node of draft.nodes) {
      const card = nodeGrid.createEl('label', {
        cls: `interestseed-sprint-node${this.acceptedNodes.has(node.id) ? ' is-accepted' : ''}`,
      });
      const checkbox = card.createEl('input', { attr: { type: 'checkbox' } });
      checkbox.checked = this.acceptedNodes.has(node.id);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) this.acceptedNodes.add(node.id);
        else this.acceptedNodes.delete(node.id);
        card.classList.toggle('is-accepted', checkbox.checked);
      });
      const copy = card.createDiv({ cls: 'interestseed-sprint-node-copy' });
      copy.createDiv({ cls: 'interestseed-sprint-node-title', text: node.title });
      copy.createDiv({ cls: 'interestseed-sprint-node-evidence', text: node.evidence });
      const score = card.createDiv({ cls: 'interestseed-sprint-score', text: `${Math.round(node.confidence * 100)}%` });
      score.setAttribute('title', '候选置信度');
    }

    const edgeSection = body.createDiv({ cls: 'interestseed-sprint-section' });
    edgeSection.createDiv({ cls: 'interestseed-sprint-section-label', text: '候选连接' });
    const edgeList = edgeSection.createDiv({ cls: 'interestseed-sprint-edge-list' });
    const byId = new Map(draft.nodes.map((node) => [node.id, node]));
    for (const edge of draft.edges) {
      const row = edgeList.createEl('label', {
        cls: `interestseed-sprint-edge${edge.surprise ? ' is-surprise' : ''}`,
      });
      const checkbox = row.createEl('input', { attr: { type: 'checkbox' } });
      checkbox.checked = this.acceptedEdges.has(edge.id);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) this.acceptedEdges.add(edge.id);
        else this.acceptedEdges.delete(edge.id);
        row.classList.toggle('is-accepted', checkbox.checked);
      });
      const copy = row.createDiv({ cls: 'interestseed-sprint-edge-copy' });
      copy.createDiv({
        cls: 'interestseed-sprint-edge-title',
        text: `${byId.get(edge.source)?.title ?? edge.source}  →  ${byId.get(edge.target)?.title ?? edge.target}`,
      });
      copy.createSpan({ cls: 'interestseed-sprint-edge-relation', text: edge.relation });
      if (edge.surprise) copy.createSpan({ cls: 'interestseed-sprint-surprise', text: '意外连接' });
      copy.createDiv({ cls: 'interestseed-sprint-edge-evidence', text: edge.evidence });
    }

    const mystery = body.createDiv({ cls: 'interestseed-sprint-mystery' });
    const mysteryIcon = mystery.createDiv({ cls: 'interestseed-sprint-mystery-icon' });
    setIcon(mysteryIcon, 'lock');
    const mysteryCopy = mystery.createDiv();
    mysteryCopy.createDiv({ cls: 'interestseed-sprint-mystery-title', text: draft.mystery.title });
    mysteryCopy.createDiv({ cls: 'interestseed-sprint-mystery-reason', text: draft.mystery.reason });

    const footer = shell.createDiv({ cls: 'interestseed-sprint-draft-footer' });
    const back = footer.createEl('button', {
      cls: 'interestseed-sprint-secondary',
      text: '重新选择',
      attr: { type: 'button' },
    });
    back.addEventListener('click', () => {
      this.roundIndex = 0;
      this.step = 0;
      this.render();
    });
    const apply = footer.createEl('button', {
      cls: 'mod-cta interestseed-sprint-primary',
      text: '把这些种子种进图谱',
      attr: { type: 'button' },
    });
    apply.disabled = this.acceptedNodes.size === 0;
    apply.addEventListener('click', () => this.applyDraft());
  }

  private applyDraft(): void {
    if (!this.draft) return;
    this.appliedCount = this.plugin.applySeedSprint(
      this.draft,
      this.acceptedNodes,
      this.acceptedEdges,
    );
    if (this.appliedCount === 0) {
      new Notice('至少保留一个种子，才能种进图谱。');
      return;
    }
    this.step = SEED_SPRINT_ROUNDS.length + 1;
    this.render();
  }

  private renderDone(): void {
    const shell = this.contentEl.createDiv({ cls: 'interestseed-sprint-done' });
    const mark = shell.createDiv({ cls: 'interestseed-sprint-done-mark' });
    setIcon(mark, 'sparkles');
    shell.createDiv({ cls: 'interestseed-sprint-kicker', text: 'PLANTED' });
    shell.createEl('h2', { cls: 'interestseed-sprint-headline', text: '你的星图开始生长了。' });
    shell.createEl('p', {
      cls: 'interestseed-sprint-lede',
      text: `已经种下 ${this.appliedCount} 个种子。接下来不是继续填表，而是让它在真实行动里长出一条新枝。`,
    });
    if (this.draft) {
      const experiment = shell.createDiv({ cls: 'interestseed-sprint-experiment' });
      const icon = experiment.createDiv({ cls: 'interestseed-sprint-experiment-icon' });
      setIcon(icon, 'flask-conical');
      const copy = experiment.createDiv();
      copy.createDiv({ cls: 'interestseed-sprint-experiment-title', text: this.draft.experiment.title });
      copy.createDiv({ cls: 'interestseed-sprint-experiment-prompt', text: this.draft.experiment.prompt });
      const steps = copy.createDiv({ cls: 'interestseed-sprint-experiment-steps' });
      for (const step of this.draft.experiment.steps.slice(0, 3)) {
        steps.createDiv({ text: `· ${step}` });
      }
    }
    const actions = shell.createDiv({ cls: 'interestseed-sprint-actions' });
    const graph = actions.createEl('button', {
      cls: 'mod-cta interestseed-sprint-primary',
      text: '查看我的图谱',
      attr: { type: 'button' },
    });
    graph.addEventListener('click', () => {
      void this.plugin.activateView();
      this.close();
    });
    const share = actions.createEl('button', {
      cls: 'interestseed-sprint-secondary',
      text: '保存分享卡',
      attr: { type: 'button' },
    });
    share.addEventListener('click', () => this.downloadShareCard());
    const agent = actions.createEl('button', {
      cls: 'interestseed-sprint-secondary',
      text: '让 Agent 继续深挖',
      attr: { type: 'button' },
    });
    agent.addEventListener('click', () => {
      void this.plugin.activateAgentView();
      this.close();
    });
  }

  private stat(host: HTMLElement, value: string, label: string): void {
    const item = host.createDiv({ cls: 'interestseed-sprint-stat' });
    item.createDiv({ cls: 'interestseed-sprint-stat-value', text: value });
    item.createDiv({ cls: 'interestseed-sprint-stat-label', text: label });
  }

  private downloadShareCard(): void {
    const nodes = this.draft?.nodes.filter((node) => this.acceptedNodes.has(node.id)) ?? [];
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const gradient = ctx.createLinearGradient(0, 0, 1080, 1350);
    gradient.addColorStop(0, '#101010');
    gradient.addColorStop(0.55, '#17151a');
    gradient.addColorStop(1, '#0d1116');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1080, 1350);
    ctx.fillStyle = 'rgba(217,119,87,0.18)';
    ctx.beginPath();
    ctx.arc(860, 230, 260, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d97757';
    ctx.font = '600 22px "Noto Sans SC", sans-serif';
    ctx.fillText('INTERESTSEED  /  MY CONSTELLATION', 80, 100);
    ctx.fillStyle = '#f4f1ea';
    ctx.font = '700 64px "Noto Sans SC", sans-serif';
    ctx.fillText('我的兴趣星图', 80, 210);
    ctx.fillStyle = '#a8a29e';
    ctx.font = '28px "Noto Sans SC", sans-serif';
    ctx.fillText('不是标签，是一张会生长的地图。', 80, 265);
    const cx = 540;
    const cy = 710;
    const radius = 280;
    ctx.strokeStyle = 'rgba(244,241,234,0.16)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    const points = nodes.slice(0, 8).map((node, index) => {
      const angle = (Math.PI * 2 * index) / Math.max(nodes.length, 1) - Math.PI / 2;
      return { node, x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
    });
    ctx.strokeStyle = 'rgba(217,119,87,0.55)';
    for (let index = 1; index < points.length; index += 1) {
      ctx.beginPath();
      const prev = points[index - 1]!;
      const current = points[index]!;
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(current.x, current.y);
      ctx.stroke();
    }
    points.forEach(({ node, x, y }, index) => {
      ctx.fillStyle = index % 3 === 0 ? '#d97757' : '#f4f1ea';
      ctx.beginPath();
      ctx.arc(x, y, index === 0 ? 18 : 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f4f1ea';
      ctx.font = '600 20px "Noto Sans SC", sans-serif';
      ctx.textAlign = x < cx ? 'right' : 'left';
      ctx.fillText(node.title, x + (x < cx ? -26 : 26), y + 7);
    });
    ctx.textAlign = 'left';
    ctx.fillStyle = '#a8a29e';
    ctx.font = '24px "Noto Sans SC", sans-serif';
    ctx.fillText('从 4 个选择开始，长出第一张属于自己的图谱。', 80, 1190);
    ctx.fillStyle = '#d97757';
    ctx.font = '600 22px "Noto Sans SC", sans-serif';
    ctx.fillText('interestseed · seeds, relations, next steps', 80, 1240);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'interestseed-map.png';
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
  }
}
