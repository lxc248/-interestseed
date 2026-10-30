import { describe, expect, it } from 'vitest';
import { ShareInbox } from '../src/inbox/ShareInbox';

describe('bug hunt: inbox corruption', () => {
  it('drops duplicate ids so resolve cannot hit the wrong item', () => {
    const inbox = new ShareInbox();
    inbox.load([
      { id: 'dup', text: '第一条', status: 'pending', source: 'share' },
      { id: 'dup', text: '第二条', status: 'pending', source: 'share' },
    ]);
    expect(inbox.all().map((item) => item.text)).toEqual(['第一条']);
    expect(inbox.pendingCount()).toBe(1);
  });
});
