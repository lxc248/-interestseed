import { describe, expect, it } from 'vitest';
import { ShareInbox } from '../src/inbox/ShareInbox';

describe('Share Inbox', () => {
  it('queues a share without writing to the graph', () => {
    const inbox = new ShareInbox();
    const result = inbox.enqueue('美妆：早八底妆 https://www.douyin.com/video/1');
    expect(result?.duplicate).toBe(false);
    expect(inbox.pendingCount()).toBe(1);
    expect(inbox.pending()[0]?.text).toContain('早八底妆');
  });

  it('deduplicates the same URL while pending', () => {
    const inbox = new ShareInbox();
    inbox.enqueue('A https://www.douyin.com/video/42?x=1');
    const second = inbox.enqueue('B https://www.douyin.com/video/42?x=2');
    expect(second?.duplicate).toBe(true);
    expect(inbox.pendingCount()).toBe(1);
  });

  it('supports keep and pass without inventing a graph node', () => {
    const inbox = new ShareInbox();
    const first = inbox.enqueue('美妆');
    const second = inbox.enqueue('游戏');
    if (first) inbox.resolve(first.item.id, 'passed');
    if (second) inbox.resolve(second.item.id, 'kept');
    expect(inbox.pendingCount()).toBe(0);
    expect(inbox.all()).toHaveLength(2);
  });

  it('round-trips serialized state and ignores malformed items', () => {
    const inbox = new ShareInbox();
    inbox.enqueue('美妆');
    inbox.enqueue('运动');
    const raw = inbox.serialize();
    const restored = new ShareInbox();
    restored.load([...raw, { bad: true }, null]);
    expect(restored.pendingCount()).toBe(2);
    expect(restored.all()[0]?.text).toBe('运动');
  });

  it('preserves the source of a context packet', () => {
    const inbox = new ShareInbox();
    inbox.enqueue('课程笔记：观察用户如何停下', 'note', '课程/观察.md');
    const raw = inbox.serialize();
    const restored = new ShareInbox();
    restored.load(raw);
    expect(restored.pending()[0]?.source).toBe('note');
    expect(restored.pending()[0]?.sourceRef).toBe('课程/观察.md');
    expect(restored.pending()[0]?.text).toContain('课程笔记');
  });
});
