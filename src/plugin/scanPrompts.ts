import { type App } from 'obsidian';
import { ScanConfirmModal } from '../ui/ScanConfirmModal';

export function openScanConfirmModal(input: {
  app: App;
  includeFolders: string[];
  excludeFolders: string[];
  includeTags: string[];
  countMarkdown: (options: {
    includeFolders: string[];
    excludeFolders: string[];
    includeTags: string[];
    maxFiles: number;
  }) => number;
  onConfirm: () => void;
}): void {
  const options = {
    includeFolders: input.includeFolders,
    excludeFolders: input.excludeFolders,
    includeTags: input.includeTags,
    maxFiles: 5000,
  };
  new ScanConfirmModal(
    input.app,
    {
      count: input.countMarkdown(options),
      includeFolders: input.includeFolders,
      excludeFolders: input.excludeFolders,
      includeTags: input.includeTags,
    },
    input.onConfirm,
  ).open();
}
