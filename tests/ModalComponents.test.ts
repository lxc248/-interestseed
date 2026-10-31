// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { installDomShims } from './ui-test-shim';
import { NodeCreateModal } from '../src/ui/NodeCreateModal';
import { RelationCreateModal } from '../src/ui/RelationCreateModal';
import { RelationEditModal } from '../src/ui/RelationEditModal';
import { ScanConfirmModal } from '../src/ui/ScanConfirmModal';
import { AiSuggestionModal } from '../src/ui/AiSuggestionModal';
import { AiSetupModal } from '../src/ui/AiSetupModal';
import { DiscoveryOverviewModal } from '../src/ui/DiscoveryOverviewModal';
import { DiscoveryCorrectionModal } from '../src/ui/DiscoveryCorrectionModal';
import { GapCoachModal } from '../src/ui/GapCoachModal';
import { SparkCaptureModal } from '../src/ui/SparkCaptureModal';
import { DiscoveryApplyModal } from '../src/ui/DiscoveryApplyModal';
import type { InterestSeedNode } from '../src/types/graph';

installDomShims();

const node = (id: string, title: string): InterestSeedNode => ({
  id,
  type: 'topic',
  title,
  tags: [],
  createdAt: '',
  updatedAt: '',
  metadata: {},
});

describe('NodeCreateModal', () => {
  it('submits a trimmed title and closes', () => {
    const onSubmit = vi.fn();
    const modal = new NodeCreateModal({} as never, onSubmit);
    modal.open();
    const input = modal.contentEl.querySelector('input') as HTMLInputElement;
    input.value = '  新兴趣  ';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const create = [...modal.contentEl.querySelectorAll('button')].find((b) => b.textContent === '创建') as HTMLButtonElement;
    create.click();
    expect(onSubmit).toHaveBeenCalledWith('新兴趣', 'topic');
  });

  it('ignores empty titles', () => {
    const onSubmit = vi.fn();
    const modal = new NodeCreateModal({} as never, onSubmit);
    modal.open();
    const create = [...modal.contentEl.querySelectorAll('button')].find((b) => b.textContent === '创建') as HTMLButtonElement;
    create.click();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('RelationCreateModal', () => {
  it('submits the first target and relation', () => {
    const onSubmit = vi.fn();
    const modal = new RelationCreateModal({} as never, node('a', 'A'), [node('b', 'B'), node('c', 'C')], onSubmit);
    modal.open();
    const create = [...modal.contentEl.querySelectorAll('button')].find((b) => b.textContent === '创建') as HTMLButtonElement;
    create.click();
    expect(onSubmit).toHaveBeenCalledWith({ targetId: 'b', relation: 'related-to' });
  });

  it('shows an empty state without targets', () => {
    const modal = new RelationCreateModal({} as never, node('a', 'A'), [], vi.fn());
    modal.open();
    expect(modal.contentEl.textContent).toContain('还没有其他节点');
  });
});

describe('RelationEditModal', () => {
  it('saves a trimmed relation name', () => {
    const onSubmit = vi.fn();
    const modal = new RelationEditModal({} as never, 'old-relation', onSubmit);
    modal.open();
    const input = modal.contentEl.querySelector('input') as HTMLInputElement;
    input.value = '  new-relation  ';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const save = [...modal.contentEl.querySelectorAll('button')].find((b) => b.textContent === '保存') as HTMLButtonElement;
    save.click();
    expect(onSubmit).toHaveBeenCalledWith('new-relation');
  });

  it('does not save an empty relation', () => {
    const onSubmit = vi.fn();
    const modal = new RelationEditModal({} as never, 'old-relation', onSubmit);
    modal.open();
    const input = modal.contentEl.querySelector('input') as HTMLInputElement;
    input.value = '   ';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const save = [...modal.contentEl.querySelectorAll('button')].find((b) => b.textContent === '保存') as HTMLButtonElement;
    save.click();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('AiSuggestionModal', () => {
  it('renders a suggestion and can ignore it', () => {
    const modal = new AiSuggestionModal(
      {} as never,
      [{ source: 'a', target: 'b', relation: 'related-to', reason: '共享标签：focus', confidence: 0.82 }],
      {
        getNodeTitle: (id) => (id === 'a' ? '节点 A' : '节点 B'),
        confirm: vi.fn(async () => ({ ok: true })),
      },
    );
    modal.open();
    expect(modal.contentEl.textContent).toContain('共 1 条候选');
    expect(modal.contentEl.textContent).toContain('节点 A → 节点 B');
    expect(modal.contentEl.textContent).toContain('82%');
    expect(modal.contentEl.textContent).toContain('共享标签：focus');
    const ignore = [...modal.contentEl.querySelectorAll('button')].find((b) => b.textContent === '忽略') as HTMLButtonElement;
    ignore.click();
    expect(modal.contentEl.textContent).toContain('已忽略');
  });

  it('passes reason and confidence through confirmation', async () => {
    const confirm = vi.fn(async () => ({ ok: true }));
    const modal = new AiSuggestionModal(
      {} as never,
      [{ source: 'a', target: 'b', relation: '共享方法', reason: '共享标签：focus', confidence: 0.82 }],
      {
        getNodeTitle: (id) => (id === 'a' ? '节点 A' : '节点 B'),
        confirm,
      },
    );
    modal.open();
    const button = [...modal.contentEl.querySelectorAll('button')].find(
      (item) => item.textContent === '确认',
    ) as HTMLButtonElement;
    button.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(confirm).toHaveBeenCalledWith({
      source: 'a',
      target: 'b',
      relation: '共享方法',
      reason: '共享标签：focus',
      confidence: 0.82,
    });
  });
});

describe('AiSetupModal', () => {
  it('saves a user-provided key and explains the boundary', async () => {
    const onSaveKey = vi.fn(async () => {});
    const modal = new AiSetupModal({} as never, {
      endpoint: 'http://localhost:7863/v1',
      providerLabel: '本地 DeepSeek V4 Pro',
      enabled: true,
      consentGranted: true,
      hasKey: false,
      onSaveKey,
      onOpenSettings: vi.fn(),
    });
    modal.open();
    expect(modal.titleEl.textContent).toContain('把 AI 推荐接上');
    expect(modal.contentEl.textContent).toContain('不会发送笔记正文');

    const input = modal.contentEl.querySelector(
      '.interestseed-ai-setup-input',
    ) as HTMLInputElement;
    input.value = 'sk-local-test';
    input.dispatchEvent(new Event('input'));
    const save = [...modal.contentEl.querySelectorAll('button')].find(
      (button) => button.textContent === '保存 Key',
    ) as HTMLButtonElement;
    save.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onSaveKey).toHaveBeenCalledWith('sk-local-test');
  });
});

describe('ScanConfirmModal', () => {
  it('renders the scope and confirms', () => {
    const onConfirm = vi.fn();
    const modal = new ScanConfirmModal(
      {} as never,
      { count: 12, includeFolders: ['Notes'], excludeFolders: [], includeTags: ['focus'] },
      onConfirm,
    );
    modal.open();
    expect(modal.contentEl.textContent).toContain('12 篇 Markdown 笔记');
    expect(modal.contentEl.textContent).toContain('#focus');
    const start = [...modal.contentEl.querySelectorAll('button')].find((b) => b.textContent === '开始扫描') as HTMLButtonElement;
    start.click();
    expect(onConfirm).toHaveBeenCalled();
  });

  it('warns when the scope has no notes', () => {
    const modal = new ScanConfirmModal(
      {} as never,
      { count: 0, includeFolders: [], excludeFolders: [], includeTags: [] },
      vi.fn(),
    );
    modal.open();
    expect(modal.contentEl.textContent).toContain('当前范围没有 Markdown 笔记');
  });
});

describe('DiscoveryOverviewModal', () => {
  it('renders stats, activity, themes and edges', () => {
    const modal = new DiscoveryOverviewModal({} as never, {
      total: 12,
      active: 7,
      dismissed: 3,
      superseded: 2,
      feedback: { none: 2, accepted: 5, rejected: 3, corrected: 1, 'low-value': 1, 'needs-verification': 0 },
      application: { applied: 4, pending: 2, skipped: 0 },
      themes: [{ key: 'focus', active: 3, accepted: 2, corrected: 1, lowValue: 0, applied: 1 }],
      appliedEdges: [{ edgeId: 'e1', source: 'A', target: 'B', relation: 'related-to', discoveryId: 'd1' }],
      activity: [{ date: '2026-10-30', label: '10-30', count: 4 }],
      recent: [{ id: 'd1', title: '发现一', feedback: 'accepted', status: 'active', application: 'applied' }],
    } as never);
    modal.open();
    expect(modal.titleEl.textContent).toContain('兴趣总览');
    expect(modal.contentEl.textContent).toContain('12');
    expect(modal.contentEl.textContent).toContain('focus');
    expect(modal.contentEl.textContent).toContain('A → B');
  });
});

describe('DiscoveryCorrectionModal', () => {
  it('submits trimmed correction and closes', async () => {
    const onSubmit = vi.fn(async () => {});
    const modal = new DiscoveryCorrectionModal({} as never, '  原标题  ', '  原描述  ', { onSubmit });
    modal.open();
    const inputs = modal.contentEl.querySelectorAll('input, textarea');
    (inputs[0] as HTMLInputElement).value = '  修正标题  ';
    (inputs[1] as HTMLTextAreaElement).value = '  修正描述  ';
    const save = [...modal.contentEl.querySelectorAll('button')].find((b) => b.textContent === '保存修正') as HTMLButtonElement;
    save.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ title: '修正标题', description: '修正描述' }));
  });

  it('rejects empty title or description', async () => {
    const onSubmit = vi.fn(async () => {});
    const modal = new DiscoveryCorrectionModal({} as never, '', '', { onSubmit });
    modal.open();
    const save = [...modal.contentEl.querySelectorAll('button')].find((b) => b.textContent === '保存修正') as HTMLButtonElement;
    save.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(modal.contentEl.textContent).toContain('标题和描述都不能为空');
  });
});

describe('GapCoachModal', () => {
  it('captures a non-empty observation', () => {
    const plugin = { captureGapSeed: vi.fn(), activateView: vi.fn(async () => {}) };
    const modal = new GapCoachModal({} as never, plugin as never, {
      id: 'i1', kind: 'gap', title: '补一条连接', detail: '还缺一个具体观察', nodeIds: [], score: 1,
    } as never);
    modal.open();
    const textarea = modal.contentEl.querySelector('textarea') as HTMLTextAreaElement;
    textarea.value = '一个具体观察';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    const submit = [...modal.contentEl.querySelectorAll('button')].find((b) => b.textContent === '种下这个观察') as HTMLButtonElement;
    submit.click();
    expect(plugin.captureGapSeed).toHaveBeenCalledWith(expect.objectContaining({ id: 'i1' }), '一个具体观察');
    expect(plugin.activateView).toHaveBeenCalled();
  });

  it('does nothing for empty observations', () => {
    const plugin = { captureGapSeed: vi.fn(), activateView: vi.fn(async () => {}) };
    const modal = new GapCoachModal({} as never, plugin as never, {
      id: 'i1', kind: 'gap', title: '补一条连接', detail: '还缺一个具体观察', nodeIds: [], score: 1,
    } as never);
    modal.open();
    const submit = [...modal.contentEl.querySelectorAll('button')].find((b) => b.textContent === '种下这个观察') as HTMLButtonElement;
    submit.click();
    expect(plugin.captureGapSeed).not.toHaveBeenCalled();
  });
});

describe('SparkCaptureModal', () => {
  const makePlugin = () => ({
    store: { listNodes: () => [] },
    captureInterestSpark: vi.fn(() => 'id1'),
    resolveInboxItem: vi.fn(),
    setSelectedNode: vi.fn(),
    activateView: vi.fn(async () => {}),
  });

  it('captures a spark when text is present', () => {
    const plugin = makePlugin();
    const modal = new SparkCaptureModal({} as never, plugin as never, '一个让我停下来的想法');
    modal.open();
    const submit = [...modal.contentEl.querySelectorAll('button')].find((b) => b.textContent === '留下这个火花') as HTMLButtonElement;
    expect(submit.disabled).toBe(false);
    submit.click();
    expect(plugin.captureInterestSpark).toHaveBeenCalled();
    expect(plugin.activateView).toHaveBeenCalled();
  });

  it('keeps submit disabled without text', () => {
    const plugin = makePlugin();
    const modal = new SparkCaptureModal({} as never, plugin as never, '');
    modal.open();
    const submit = [...modal.contentEl.querySelectorAll('button')].find((b) => b.textContent === '留下这个火花') as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });
});

describe('DiscoveryApplyModal', () => {
  it('applies a valid discovery and reports finish', async () => {
    const apply = vi.fn(async () => ({ status: 'applied', message: '已应用' }));
    const onFinished = vi.fn();
    const modal = new DiscoveryApplyModal(
      {} as never,
      {
        title: '发现',
        description: '描述',
        projectKeys: ['Projects/A'],
        nodeIds: ['a', 'b'],
        evidence: [{ kind: 'source', nodeId: 'a', sourceUri: 'Notes/a.md', text: '证据' }],
      } as never,
      {
        nodes: [node('a', 'A'), node('b', 'B')],
        preview: () => ({ kind: 'ok', reason: '可以应用', conflicts: [] }),
        apply,
        onFinished,
      } as never,
    );
    modal.open();
    const submit = [...modal.contentEl.querySelectorAll('button')].find((b) => b.textContent === '确认写入图谱') as HTMLButtonElement;
    expect(submit.disabled).toBe(false);
    submit.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(apply).toHaveBeenCalled();
  });
});

