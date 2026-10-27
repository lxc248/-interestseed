import { normalizePath } from '../utils/paths';

export type AuditReportSaveFailure =
  | 'invalid-path'
  | 'exists'
  | 'not-file'
  | 'failed';

export type AuditReportSaveResult =
  | { ok: true; path: string }
  | { ok: false; reason: AuditReportSaveFailure; path: string };

export interface AuditReportStorage {
  exists(path: string): boolean;
  isFile(path: string): boolean;
  create(path: string, text: string): Promise<void>;
  modify(path: string, text: string): Promise<void>;
}

export function normalizeAuditReportPath(input: string): string | null {
  const raw = input.trim();
  if (
    !raw ||
    raw.startsWith('/') ||
    raw.includes('..') ||
    /^[a-z]:[\\/]/i.test(raw)
  ) {
    return null;
  }
  const path = normalizePath(raw);
  if (!path || !/\.md$/i.test(path)) return null;
  return path;
}

/** 保存独立审计报告；不改发现、反馈、应用状态或图谱。 */
export async function saveAuditReport(
  storage: AuditReportStorage,
  inputPath: string,
  text: string,
  overwrite: boolean,
): Promise<AuditReportSaveResult> {
  const path = normalizeAuditReportPath(inputPath);
  if (!path) return { ok: false, reason: 'invalid-path', path: inputPath };
  if (storage.exists(path)) {
    if (!storage.isFile(path)) return { ok: false, reason: 'not-file', path };
    if (!overwrite) return { ok: false, reason: 'exists', path };
    try {
      await storage.modify(path, text);
      return { ok: true, path };
    } catch {
      return { ok: false, reason: 'failed', path };
    }
  }
  try {
    await storage.create(path, text);
    return { ok: true, path };
  } catch {
    return { ok: false, reason: 'failed', path };
  }
}
