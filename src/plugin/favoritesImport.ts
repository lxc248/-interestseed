/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Copyright (C) 2026 aicoder
 */
import type { App } from 'obsidian';

import type { ImportOutcome } from '../inbox/importToInbox';
import { ImportFavoritesModal } from '../ui/ImportFavoritesModal';

/**
 * Opening the import modal is kept separate from the import itself so the
 * submit handler stays a plain function the host owns (and can be tested).
 */
export function openImportFavoritesModal(
  app: App,
  submit: (text: string) => ImportOutcome,
): void {
  new ImportFavoritesModal(app, submit).open();
}
