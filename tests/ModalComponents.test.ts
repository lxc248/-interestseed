// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { installDomShims } from './ui-test-shim';
import { NodeCreateModal } from '../src/ui/NodeCreateModal';
import { RelationCreateModal } from '../src/ui/RelationCreateModal';
import { RelationEditModal } from '../src/ui/RelationEditModal';
import { ScanConfirmModal } from '../src/ui/ScanConfirmModal';
import { AiSuggestionModal } from '../src/ui/AiSuggestionModal';
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
      [{ source: 'a', target: 'b', relation: 'related-to' }],
      {
        getNodeTitle: (id) => (id === 'a' ? '节点 A' : '节点 B'),
        confirm: vi.fn(async () => ({ ok: true })),
      },
    );
    modal.open();
    expect(modal.contentEl.textContent).toContain('共 1 条');
    expect(modal.contentEl.textContent).toContain('节点 A → 节点 B');
    const ignore = [...modal.contentEl.querySelectorAll('button')].find((b) => b.textContent === '忽略') as HTMLButtonElement;
    ignore.click();
    expect(modal.contentEl.textContent).toContain('已忽略');
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
