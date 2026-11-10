/**
 * Type declarations for the plain-JS importer used by the MCP server.
 * The plugin ships a TypeScript twin; `tests/importersParity.test.ts` keeps
 * the two implementations identical.
 */

export type ImportFormat = 'bookmarks-html' | 'json' | 'csv' | 'urls' | 'empty' | 'unknown';

export interface ImportEntry {
  title: string;
  url: string | null;
}

export interface ImportResult {
  format: ImportFormat;
  items: ImportEntry[];
  duplicates: number;
  truncated: boolean;
}

export declare function detectFormat(text: string): ImportFormat;

export declare function parseImport(text: string, options?: { maxItems?: number }): ImportResult;
