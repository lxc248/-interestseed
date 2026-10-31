import { beforeEach, describe, expect, it, vi } from 'vitest';
import { confirmAction } from '../src/ui/ConfirmModal';

vi.mock('../src/ui/ConfirmModal', () => ({
  confirmAction: vi.fn(),
}));

import { confirmClearGraph } from '../src/plugin/destructiveConfirm';

const confirmMock = vi.mocked(confirmAction);

describe('clear graph confirmation', () => {
  beforeEach(() => {
    confirmMock.mockReset();
  });

  it('asks for explicit confirmation before clearing', async () => {
    confirmMock.mockResolvedValueOnce(false);
    await expect(confirmClearGraph({} as never)).resolves.toBe(false);
    expect(confirmMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('清空当前图谱'),
      '清空',
    );
  });

  it('returns true only when the user confirms', async () => {
    confirmMock.mockResolvedValueOnce(true);
    await expect(confirmClearGraph({} as never)).resolves.toBe(true);
  });
});
