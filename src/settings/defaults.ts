import { DEFAULT_AI_MODEL } from '../services/ModelProvider';
import type { InterestSeedSettings } from '../types/graph';
import { isRecord, sanitizeTags } from '../utils/validation';

export const DEFAULT_SETTINGS: InterestSeedSettings = {
  autoBuildOnOpen: true,
  includeFolders: [],
  excludeFolders: ['.obsidian', '.trash'],
  includeTags: [],
  enableRuleSuggestions: true,
  enableAI: true,
  aiProvider: 'local',
  aiModel: DEFAULT_AI_MODEL,
  aiConsentGranted: true,
  seedSprintCompletedAt: null,
  enableDshAgent: false,
  dshCommand: 'dsh',
  dshProfile: 'acp',
  dshModel: 'wodebody/cn:deepseek-v4.1-flash',
};

export function normalizeSettings(raw: unknown): InterestSeedSettings {
  const source = isRecord(raw) ? raw : {};
  return {
    autoBuildOnOpen:
      typeof source.autoBuildOnOpen === 'boolean'
        ? source.autoBuildOnOpen
        : DEFAULT_SETTINGS.autoBuildOnOpen,
    includeFolders: sanitizeFolders(source.includeFolders),
    excludeFolders:
      source.excludeFolders === undefined
        ? [...DEFAULT_SETTINGS.excludeFolders]
        : sanitizeFolders(source.excludeFolders),
    includeTags: sanitizeTags(source.includeTags),
    enableRuleSuggestions:
      typeof source.enableRuleSuggestions === 'boolean'
        ? source.enableRuleSuggestions
        : DEFAULT_SETTINGS.enableRuleSuggestions,
    enableAI:
      typeof source.enableAI === 'boolean' ? source.enableAI : DEFAULT_SETTINGS.enableAI,
    aiProvider:
      source.aiProvider === 'claudian' ? 'claudian' : 'local',
    aiModel:
      typeof source.aiModel === 'string' && source.aiModel.trim()
        ? source.aiModel.trim()
        : DEFAULT_SETTINGS.aiModel,
    aiConsentGranted:
      typeof source.aiConsentGranted === 'boolean'
        ? source.aiConsentGranted
        : DEFAULT_SETTINGS.aiConsentGranted,
    seedSprintCompletedAt:
      typeof source.seedSprintCompletedAt === 'string'
        ? source.seedSprintCompletedAt
        : null,
    enableDshAgent:
      typeof source.enableDshAgent === 'boolean'
        ? source.enableDshAgent
        : DEFAULT_SETTINGS.enableDshAgent,
    dshCommand:
      typeof source.dshCommand === 'string' && source.dshCommand.trim()
        ? source.dshCommand.trim()
        : DEFAULT_SETTINGS.dshCommand,
    dshProfile:
      typeof source.dshProfile === 'string' && source.dshProfile.trim()
        ? source.dshProfile.trim()
        : DEFAULT_SETTINGS.dshProfile,
    dshModel:
      typeof source.dshModel === 'string' && source.dshModel.trim()
        ? source.dshModel.trim()
        : DEFAULT_SETTINGS.dshModel,
  };
}

export function sanitizeFolders(input: unknown): string[] {
  const source = Array.isArray(input)
    ? input
    : typeof input === 'string'
      ? input.split(/[\n,，]+/)
      : [];
  const seen = new Set<string>();
  const folders: string[] = [];
  for (const entry of source) {
    if (typeof entry !== 'string') continue;
    const folder = entry.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').trim();
    if (!folder || seen.has(folder)) continue;
    seen.add(folder);
    folders.push(folder);
  }
  return folders;
}
