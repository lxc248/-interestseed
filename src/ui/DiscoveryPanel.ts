import { setIcon } from 'obsidian';
import type { Discovery } from '../discovery/types';
import {
  activeThemePeerCounts,
  discoveryDisplayMetrics,
  discoveryThemeKey,
} from './discoveryPresentation';
import { discoveryPriorityLabel, sortDiscoveries } from '../discovery/ranking';

export interface DiscoveryPanelDeps {
  nodeTitle(nodeId: string): string;
  sourceUri(nodeId: string): string | undefined;
  edgeSummary(edgeId: string): string | undefined;
  onAccept(id: string): void;
  onReject(id: string): void;
  onCorrect(id: string): void;
  onLowValue(id: string): void;
  onNeedsVerification(id: string): void;
  onUndo(id: string): void;
  onApply(id: string): void;
  onOpenEdge(edgeId: string): void;
  onRefresh(): void;
}

const FEEDBACK_LABELS: Record<string, string> = {
  none: '未反馈',
  accepted: '已接受',
  rejected: '已拒绝',
  corrected: '已修正',
  'low-value': '低价值',
  'needs-verification': '待验证',
};

const APPLICATION_LABELS: Record<string, string> = {
  none: '未应用',
  applying: '应用中',
  applied: '已应用',
  existing: '关系已存在',
  failed: '应用失败',
  stale: '关系已失效',
  'recovery-required': '待恢复核对',
};

/**
 * 发现列表：展示发现与反馈按钮；接受/拒绝/待验证只写反馈。
 * 应用到图谱必须通过独立确认界面，不能由反馈按钮直接写入。
 */
export class DiscoveryPanel {
  constructor(
    private readonly host: HTMLElement,
    private readonly deps: DiscoveryPanelDeps,
  ) {}

  render(
    discoveries: Discovery[],
    blocked: string | null,
    themeFilter: string | null = null,
    onClearTheme?: () => void,
  ): void {
    this.host.empty();

    if (blocked) {
      const box = this.host.createDiv({ cls: 'interestseed-empty-hint' });
      box.createSpan({ text: `⚠ ${blocked}` });
      return;
    }

    const active = sortDiscoveries(discoveries.filter((item) => item.status === 'active'));
    const dismissed = discoveries.filter(
      (item) =>
        item.status === 'dismissed' &&
        !item.supersededBy &&
        item.feedbackStatus !== 'low-value',
    ).length;
    const lowValue = discoveries.filter(
      (item) => item.status === 'dismissed' && item.feedbackStatus === 'low-value',
    ).length;
    const superseded = discoveries.filter((item) => item.supersededBy).length;
    const themePeerCounts = activeThemePeerCounts(discoveries);

    const header = this.host.createDiv({ cls: 'interestseed-discovery-header' });
    header.createSpan({ text: `发现 ${active.length}` });
    if (dismissed > 0) {
      header.createSpan({ cls: 'interestseed-faint', text: `· 已抑制 ${dismissed}` });
    }
    if (lowValue > 0) {
      header.createSpan({ cls: 'interestseed-faint', text: `· 低价值 ${lowValue}` });
    }
    if (superseded > 0) {
      header.createSpan({
        cls: 'interestseed-faint',
        text: `· 自动收敛 ${superseded}`,
      });
    }
    const refresh = header.createEl('button', {
      cls: 'interestseed-action',
      attr: { 'aria-label': '刷新发现', title: '刷新发现' },
    });
    setIcon(refresh, 'refresh-cw');
    refresh.addEventListener('click', () => this.deps.onRefresh());

    if (themeFilter) {
      const filter = header.createEl('button', {
        cls: 'interestseed-discovery-filter',
        text: `#${themeFilter} ×`,
        attr: { 'aria-label': `清除主题筛选 ${themeFilter}`, title: '清除主题筛选' },
      });
      filter.addEventListener('click', () => onClearTheme?.());
    }

    if (active.length === 0) {
      this.host.createDiv({
        cls: 'interestseed-empty-hint',
        text: '当前材料不足，或还没有符合条件的发现。发现只会读取本地图谱证据，不会上传数据。',
      });
      return;
    }

    for (const item of active) {
      this.renderCard(
        this.host,
        item,
        themePeerCounts.get(discoveryThemeKey(item)) ?? 1,
      );
    }
  }

  private renderCard(
    parent: HTMLElement,
    item: Discovery,
    themePeerCount: number,
  ): void {
    const card = parent.createDiv({ cls: 'interestseed-discovery-card' });
    card.setAttr('data-discovery-id', item.id);
    card.setAttr('data-feedback', item.feedbackStatus);
    card.setAttr('data-status', item.status);
    card.setAttr('data-application', item.application?.state ?? 'none');
    card.setAttr('role', 'group');
    card.setAttr('tabindex', '0');
    card.setAttr(
      'aria-label',
      `${item.title}；${item.feedbackStatus}；${item.application?.state ?? 'none'}；按上下键浏览发现`,
    );
    card.addEventListener('keydown', (event) => {
      if (event.target !== card) return;
      const cards = Array.from(
        parent.querySelectorAll<HTMLElement>('.interestseed-discovery-card'),
      );
      const index = cards.indexOf(card);
      if (index < 0) return;
      let next: number;
      if (event.key === 'ArrowDown') next = Math.min(cards.length - 1, index + 1);
      else if (event.key === 'ArrowUp') next = Math.max(0, index - 1);
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = cards.length - 1;
      else return;
      event.preventDefault();
      cards[next]?.focus();
    });

    card.createDiv({ cls: 'interestseed-discovery-title', text: item.title });

    const involved = card.createDiv({ cls: 'interestseed-discovery-nodes' });
    involved.createSpan({ text: '涉及节点：' });
    involved.createSpan({
      text: item.nodeIds.map((nodeId) => this.deps.nodeTitle(nodeId)).join(' ↔ '),
    });

    const theme = card.createDiv({ cls: 'interestseed-discovery-theme' });
    theme.createSpan({
      text: `共享主题：${item.subjectKeys.map((key) => `#${key}`).join('、')}`,
    });
    if (themePeerCount > 1) {
      theme.createSpan({
        text: `同主题活动候选：${themePeerCount} 条（分别反馈，不合并）`,
      });
    }

    card.createEl('p', {
      cls: 'interestseed-discovery-desc',
      text: item.description,
    });

    if (item.correction && item.feedbackStatus === 'corrected') {
      const correction = card.createDiv({ cls: 'interestseed-discovery-correction' });
      correction.createEl('strong', { text: '你的修正（原发现未被覆盖）' });
      correction.createDiv({ text: `标题：${item.correction.title}` });
      correction.createDiv({ text: `描述：${item.correction.description}` });
      correction.createDiv({ cls: 'interestseed-faint', text: '修正不会自动应用到图谱。' });
    }

    const project = card.createDiv({ cls: 'interestseed-discovery-meta' });
    project.createSpan({
      text: `推定项目：${item.projectKeys.join('、')}`,
    });
    project.createSpan({ text: `强度：${item.strength}` });
    project.createSpan({
      text: `状态：${FEEDBACK_LABELS[item.feedbackStatus] ?? '未反馈'}`,
    });
    project.createSpan({
      text: `排序：${discoveryPriorityLabel(item)}`,
    });
    project.createSpan({
      text: `应用：${APPLICATION_LABELS[item.application?.state ?? 'none'] ?? '未应用'}`,
    });
    if (item.application?.edgeId) {
      const current = this.deps.edgeSummary(item.application.edgeId);
      project.createSpan({
        text: current ? `当前关系：${current}` : '当前关系：不存在',
      });
    }

    const metrics = discoveryDisplayMetrics(item);
    const metricLine = card.createDiv({ cls: 'interestseed-discovery-metrics' });
    metricLine.createSpan({
      text: `证据：${metrics.evidenceCount} 条（来源 ${metrics.sourceEvidenceCount}、标签 ${metrics.sharedTagEvidenceCount}、确认关系 ${metrics.confirmedEvidenceCount}）`,
    });
    metricLine.createSpan({
      text: `结构可追溯：${metrics.traceableEvidenceCount}/${metrics.evidenceCount}`,
    });
    metricLine.createSpan({
      text: metrics.sourceComplete ? '来源完整' : '来源不完整',
    });

    const nodes = card.createDiv({ cls: 'interestseed-discovery-meta' });
    for (const nodeId of item.nodeIds) {
      const uri = this.deps.sourceUri(nodeId);
      nodes.createSpan({
        text: uri ? `来源：${uri}` : '来源不可定位',
      });
    }

    const why = card.createEl('details', { cls: 'interestseed-discovery-why' });
    why.createEl('summary', { text: '为什么出现这条发现' });
    why.createEl('p', {
      text: '这条发现基于：不同推定目录 + 共享标签 + 每个节点至少一条已确认关系。目录分组来自文件路径，不等于你确认的项目实体。',
    });

    const evidence = card.createDiv({ cls: 'interestseed-discovery-evidence' });
    for (const itemEvidence of item.evidence) {
      evidence.createDiv({
        cls: 'interestseed-evidence',
        text: itemEvidence.text,
      });
    }

    const actions = card.createDiv({ cls: 'interestseed-discovery-actions' });
    this.actionButton(actions, '✓', '接受发现', 'accept', () =>
      this.deps.onAccept(item.id),
    );
    this.actionButton(actions, '✕', '拒绝并抑制当前发现', 'reject', () =>
      this.deps.onReject(item.id),
    );
    this.actionButton(actions, '✎', '修正发现', 'correct', () =>
      this.deps.onCorrect(item.id),
    );
    this.actionButton(actions, '↓', '标记低价值（只抑制当前发现）', 'low-value', () =>
      this.deps.onLowValue(item.id),
    );
    this.actionButton(actions, '…', '标记待验证', 'needs', () =>
      this.deps.onNeedsVerification(item.id),
    );
    if (item.feedbackStatus !== 'none') {
      this.actionButton(
        actions,
        '↺',
        '撤销当前反馈（不会删除已应用的图谱关系）',
        'undo',
        () => this.deps.onUndo(item.id),
      );
    }
    if (item.feedbackStatus === 'accepted') {
      this.actionButton(actions, '↗', '应用到图谱', 'apply', () =>
        this.deps.onApply(item.id),
      );
    }
    if (item.application?.edgeId) {
      this.actionButton(actions, '◎', '查看已应用关系', 'edge', () =>
        this.deps.onOpenEdge(item.application?.edgeId ?? ''),
      );
    }
  }

  private actionButton(
    parent: HTMLElement,
    text: string,
    label: string,
    cls: string,
    onClick: () => void,
  ): void {
    const button = parent.createEl('button', {
      cls: `interestseed-discovery-action is-${cls}`,
      text,
      attr: { 'aria-label': label, title: label },
    });
    button.addEventListener('click', onClick);
  }
}
