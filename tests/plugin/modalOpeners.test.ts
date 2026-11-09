import { describe, expect, it, vi } from 'vitest';

const opened: string[] = [];

vi.mock('../../src/ui/ExperimentModal', () => ({
  ExperimentModal: class { open() { opened.push('experiment'); } },
}));
vi.mock('../../src/ui/GapCoachModal', () => ({
  GapCoachModal: class { open() { opened.push('gap'); } },
}));
vi.mock('../../src/ui/SeedSprintModal', () => ({
  SeedSprintModal: class { open() { opened.push('seed'); } },
}));
vi.mock('../../src/ui/ShareCardModal', () => ({
  ShareCardModal: class { open() { opened.push('share-card'); } },
}));
vi.mock('../../src/ui/ShareInboxModal', () => ({
  ShareInboxModal: class { open() { opened.push('inbox'); } },
}));
vi.mock('../../src/ui/SparkCaptureModal', () => ({
  SparkCaptureModal: class { open() { opened.push('spark'); } },
}));

import {
  openExperimentModal,
  openGapCoachModal,
  openInboxModal,
  openSeedSprintModal,
  openShareCardModal,
  openSparkCaptureModal,
} from '../../src/plugin/modalOpeners';

describe('modalOpeners', () => {
  it('opens each modal through the central helpers', () => {
    openExperimentModal({} as never, {});
    openGapCoachModal({} as never, {}, { id: 'i', title: 'T', detail: 'D', nodeIds: [] } as never);
    openSeedSprintModal({} as never, {});
    openShareCardModal({} as never, {});
    openInboxModal({} as never, {});
    openSparkCaptureModal({} as never, {}, 'text', undefined, 'share', '');
    expect(opened).toEqual(['experiment', 'gap', 'seed', 'share-card', 'inbox', 'spark']);
  });
});
