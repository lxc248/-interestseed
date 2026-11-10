import { beforeEach, describe, expect, it, vi } from 'vitest';

const createOpen = vi.fn();
const editOpen = vi.fn();

vi.mock('../../src/ui/RelationCreateModal', () => ({
  RelationCreateModal: class {
    constructor(
      public app: unknown,
      public source: unknown,
      public targets: unknown,
      public onConfirm: unknown,
    ) {}
    open() {
      createOpen(this);
    }
  },
}));

vi.mock('../../src/ui/RelationEditModal', () => ({
  RelationEditModal: class {
    constructor(public app: unknown, public relation: unknown, public onConfirm: unknown) {}
    open() {
      editOpen(this);
    }
  },
}));

import { openRelationCreateModal, openRelationEditModal } from '../../src/plugin/relationPrompts';

describe('relationPrompts', () => {
  beforeEach(() => {
    createOpen.mockReset();
    editOpen.mockReset();
  });

  it('opens the create modal with source and targets', () => {
    const onConfirm = vi.fn();
    openRelationCreateModal({
      app: {} as never,
      source: { id: 's', title: 'S' } as never,
      targets: [{ id: 't', title: 'T' }] as never,
      onConfirm,
    });
    expect(createOpen).toHaveBeenCalledTimes(1);
    const modal = createOpen.mock.calls[0]?.[0] as { onConfirm: unknown } | undefined;
    expect(modal?.onConfirm).toBe(onConfirm);
  });

  it('opens the edit modal with the current relation', () => {
    const onConfirm = vi.fn();
    openRelationEditModal({ app: {} as never, relation: '引出', onConfirm });
    expect(editOpen).toHaveBeenCalledTimes(1);
    const modal = editOpen.mock.calls[0]?.[0] as { relation: string; onConfirm: unknown } | undefined;
    expect(modal?.relation).toBe('引出');
    expect(modal?.onConfirm).toBe(onConfirm);
  });
});
