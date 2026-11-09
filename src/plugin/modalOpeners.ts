import { type App } from 'obsidian';
import type { Insight } from '../core/InsightEngine';
import type { InboxSource } from '../inbox/ShareInbox';
import { ExperimentModal } from '../ui/ExperimentModal';
import { GapCoachModal } from '../ui/GapCoachModal';
import { SeedSprintModal } from '../ui/SeedSprintModal';
import { ShareCardModal } from '../ui/ShareCardModal';
import { ShareInboxModal } from '../ui/ShareInboxModal';
import { SparkCaptureModal } from '../ui/SparkCaptureModal';

export function openExperimentModal(app: App, plugin: unknown): void {
  new ExperimentModal(app, plugin as never).open();
}

export function openGapCoachModal(app: App, plugin: unknown, insight: Insight): void {
  new GapCoachModal(app, plugin as never, insight).open();
}

export function openSeedSprintModal(app: App, plugin: unknown): void {
  new SeedSprintModal(app, plugin as never).open();
}

export function openShareCardModal(app: App, plugin: unknown): void {
  new ShareCardModal(app, plugin as never).open();
}

export function openInboxModal(app: App, plugin: unknown): void {
  new ShareInboxModal(app, plugin as never).open();
}

export function openSparkCaptureModal(
  app: App,
  plugin: unknown,
  initialText: string,
  inboxId: string | undefined,
  source: InboxSource,
  sourceRef: string,
): void {
  new SparkCaptureModal(app, plugin as never, initialText, inboxId, source, sourceRef).open();
}
