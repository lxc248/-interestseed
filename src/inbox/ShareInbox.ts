import { hashString } from '../utils/ids';

export type InboxStatus = 'pending' | 'kept' | 'passed';

export interface ShareInboxItem {
  id: string;
  text: string;
  addedAt: string;
  status: InboxStatus;
}

export interface EnqueueResult {
  item: ShareInboxItem;
  duplicate: boolean;
}

function normalizeKey(text: string): string {
  const url = text.match(/https?:\/\/[^\s]+/i)?.[0];
  if (url) return url.replace(/[?#].*$/, '').replace(/\/+$/, '').toLowerCase();
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Local-first intake queue. It never writes to the graph by itself:
 * the user must still open a candidate and choose keep or pass.
 */
export class ShareInbox {
  private items: ShareInboxItem[] = [];
  private readonly maxItems: number;

  constructor(maxItems = 200) {
    this.maxItems = maxItems;
  }

  enqueue(text: string, now = new Date().toISOString()): EnqueueResult | null {
    const value = text.trim();
    if (!value) return null;
    const key = normalizeKey(value);
    const duplicate = this.items.find(
      (item) => normalizeKey(item.text) === key && item.status === 'pending',
    );
    if (duplicate) return { item: duplicate, duplicate: true };
    const item: ShareInboxItem = {
      id: `inbox_${hashString(key)}`,
      text: value,
      addedAt: now,
      status: 'pending',
    };
    this.items = [item, ...this.items].slice(0, this.maxItems);
    return { item, duplicate: false };
  }

  resolve(id: string, status: Exclude<InboxStatus, 'pending'>): ShareInboxItem | null {
    const item = this.items.find((candidate) => candidate.id === id);
    if (!item) return null;
    item.status = status;
    return item;
  }

  pending(): ShareInboxItem[] {
    return this.items.filter((item) => item.status === 'pending');
  }

  pendingCount(): number {
    return this.pending().length;
  }

  all(): readonly ShareInboxItem[] {
    return this.items;
  }

  serialize(): ShareInboxItem[] {
    return this.items.map((item) => ({ ...item }));
  }

  load(raw: unknown): void {
    if (!Array.isArray(raw)) return;
    this.items = raw
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
      .map((item) => ({
        id: String(item.id ?? ''),
        text: String(item.text ?? ''),
        addedAt: String(item.addedAt ?? ''),
        status: (item.status === 'kept' || item.status === 'passed'
          ? item.status
          : 'pending') as InboxStatus,
      }))
      .filter((item) => item.id && item.text)
      .slice(0, this.maxItems);
  }
}
