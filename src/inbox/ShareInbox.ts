import { hashString } from '../utils/ids';
import { detectIngest } from '../services/ingest';

export type InboxStatus = 'pending' | 'kept' | 'passed';
export type InboxSource = 'share' | 'clipboard' | 'note';

export interface ShareInboxItem {
  id: string;
  text: string;
  addedAt: string;
  status: InboxStatus;
  source: InboxSource;
  sourceRef?: string;
  /** Detected platform id (douyin, youtube, …); absent for plain text items. */
  sourcePlatform?: string;
  /** Same URL with tracking parameters stripped. */
  canonicalUrl?: string;
}

export interface EnqueueResult {
  item: ShareInboxItem;
  duplicate: boolean;
}

function normalizeKey(text: string): string {
  const url = text.split(/\s+/).find((part) => /^https?:\/\//i.test(part));
  if (url) {
    let normalized = url;
    for (const marker of ['?', '#']) {
      const index = normalized.indexOf(marker);
      if (index >= 0) normalized = normalized.slice(0, index);
    }
    while (normalized.endsWith('/')) normalized = normalized.slice(0, -1);
    return normalized.toLowerCase();
  }
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

  enqueue(text: string, source: InboxSource = 'share', sourceRef = '', now = new Date().toISOString()): EnqueueResult | null {
    const value = text.trim();
    if (!value) return null;
    const key = normalizeKey(value);
    const duplicate = this.items.find(
      (item) => normalizeKey(item.text) === key && item.status === 'pending',
    );
    if (duplicate) return { item: duplicate, duplicate: true };
    const ingest = detectIngest(value);
    const item: ShareInboxItem = {
      id: `inbox_${hashString(key)}`,
      text: value,
      addedAt: now,
      status: 'pending',
      source,
      ...(sourceRef ? { sourceRef } : {}),
      ...(ingest.platform !== 'text' ? { sourcePlatform: ingest.platform } : {}),
      ...(ingest.canonicalUrl ? { canonicalUrl: ingest.canonicalUrl } : {}),
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
    const seenIds = new Set<string>();
    this.items = raw
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
      .map((item) => ({
        id: String(item.id ?? ''),
        text: String(item.text ?? ''),
        addedAt: String(item.addedAt ?? ''),
        status: (item.status === 'kept' || item.status === 'passed'
          ? item.status
          : 'pending') as InboxStatus,
        source: (item.source === 'clipboard' || item.source === 'note'
          ? item.source
          : 'share') as InboxSource,
        ...(item.sourceRef ? { sourceRef: String(item.sourceRef) } : {}),
        // Platform metadata must survive a reload, otherwise the inbox forgets
        // where an item came from after a restart.
        ...(typeof item.sourcePlatform === 'string' ? { sourcePlatform: item.sourcePlatform } : {}),
        ...(typeof item.canonicalUrl === 'string' ? { canonicalUrl: item.canonicalUrl } : {}),
      }))
      .filter((item) => {
        if (!item.id || !item.text || seenIds.has(item.id)) return false;
        seenIds.add(item.id);
        return true;
      })
      .slice(0, this.maxItems);
  }
}
