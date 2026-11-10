/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Copyright (C) 2026 aicoder
 */
import type { ShareInbox } from '../inbox/ShareInbox';
import { inboxTextFor, type ImportEntry } from '../services/importers';

export interface ImportOutcome {
  added: number;
  duplicates: number;
  skipped: number;
}

/**
 * Push parsed export entries into the share inbox.
 *
 * The inbox is the intake queue, not the graph: imported items still have to be
 * judged one by one, which keeps a 400-item export from silently rewriting the
 * user's star map.
 */
export function importEntriesToInbox(
  inbox: ShareInbox,
  entries: readonly ImportEntry[],
  sourceRef = 'export-import',
): ImportOutcome {
  const outcome: ImportOutcome = { added: 0, duplicates: 0, skipped: 0 };
  for (const entry of entries) {
    const text = inboxTextFor(entry);
    if (!text) {
      outcome.skipped += 1;
      continue;
    }
    const result = inbox.enqueue(text, 'clipboard', sourceRef);
    if (!result) {
      outcome.skipped += 1;
      continue;
    }
    if (result.duplicate) outcome.duplicates += 1;
    else outcome.added += 1;
  }
  return outcome;
}

export function describeImportOutcome(outcome: ImportOutcome): string {
  const parts = [`导入 ${outcome.added} 条`];
  if (outcome.duplicates > 0) parts.push(`重复 ${outcome.duplicates} 条`);
  if (outcome.skipped > 0) parts.push(`跳过 ${outcome.skipped} 条`);
  return parts.join('，');
}
