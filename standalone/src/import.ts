import type { ImportOutcome } from '../../src/inbox/importToInbox';
import { inboxTextFor, parseImport, type ImportFormat } from '../../src/services/importers';
import { enqueueInbox } from './inbox';

/** A caller mistake (empty or unrecognisable file), safe to report as 400. */
export class ImportInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportInputError';
  }
}

export interface ImportReport extends ImportOutcome {
  format: ImportFormat;
  parsed: number;
  duplicatesInFile: number;
  truncated: boolean;
}

/**
 * Import an exported favourites file into the standalone inbox.
 *
 * Parsing is shared with the plugin, so the CLI and the modal accept exactly the
 * same formats. The recommended standalone path should not be the poorer one.
 */
export async function importFavorites(vaultPath: string, text: string): Promise<ImportReport> {
  if (!text.trim()) {
    throw new ImportInputError('text 不能为空：请粘贴导出文件的内容。');
  }
  const parsed = parseImport(text);
  if (parsed.items.length === 0) {
    throw new ImportInputError(
      `没有识别到可导入的条目（格式判断为 ${parsed.format}）。支持书签 HTML、JSON、CSV（含 url 列）与纯链接列表。`,
    );
  }

  const outcome: ImportOutcome = { added: 0, duplicates: 0, skipped: 0 };
  for (const entry of parsed.items) {
    const itemText = inboxTextFor(entry);
    if (!itemText) {
      outcome.skipped += 1;
      continue;
    }
    const result = await enqueueInbox(vaultPath, itemText, 'clipboard', 'export-import');
    if (result.duplicate) outcome.duplicates += 1;
    else outcome.added += 1;
  }

  return {
    format: parsed.format,
    parsed: parsed.items.length,
    duplicatesInFile: parsed.duplicates,
    truncated: parsed.truncated,
    ...outcome,
  };
}
