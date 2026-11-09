import { describe, expect, it, vi } from 'vitest';

const open = vi.fn();

vi.mock('../../src/ui/ScanConfirmModal', () => ({
  ScanConfirmModal: class {
    constructor(
      public app: unknown,
      public info: { count: number; includeFolders: string[]; excludeFolders: string[]; includeTags: string[] },
      public onConfirm: () => void,
    ) {}
    open() {
      open(this);
    }
  },
}));

import { openScanConfirmModal } from '../../src/plugin/scanPrompts';

describe('scanPrompts', () => {
  it('passes folder/tag scope and markdown count into the modal', () => {
    const onConfirm = vi.fn();
    const countMarkdown = vi.fn(() => 12);
    openScanConfirmModal({
      app: {} as never,
      includeFolders: ['in'],
      excludeFolders: ['out'],
      includeTags: ['#tag'],
      countMarkdown,
      onConfirm,
    });
    expect(open).toHaveBeenCalledTimes(1);
    const modal = open.mock.calls[0]?.[0] as { info: { count: number }; onConfirm: () => void };
    expect(modal.info.count).toBe(12);
    expect(countMarkdown).toHaveBeenCalledWith(
      expect.objectContaining({ maxFiles: 5000, includeFolders: ['in'] }),
    );
    expect(modal.onConfirm).toBe(onConfirm);
  });
});
