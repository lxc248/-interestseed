import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { InterestSeedGraph } from '../../src/types/graph';
import { emptyGraph } from '../../src/types/graph';

export const STATE_DIR = '.interestseed';
export const STATE_FILE = 'state.json';
export const CONFIG_FILE = 'config.json';

export interface StandaloneConfig {
  includeFolders: string[];
  excludeFolders: string[];
  includeTags: string[];
  model: string;
  baseUrl: string;
  keyEnv: string;
}

export const DEFAULT_CONFIG: StandaloneConfig = {
  includeFolders: [],
  excludeFolders: ['.obsidian', '.trash', '.interestseed', 'node_modules'],
  includeTags: [],
  model: 'cn:deepseek-v4.1-flash',
  baseUrl: 'http://localhost:7863/v1',
  keyEnv: 'INTERESTSEED_AI_API_KEY',
};

export interface StateFile {
  schemaVersion: 1;
  updatedAt: string;
  graph: InterestSeedGraph;
}

export function stateDir(vaultPath: string): string {
  return join(vaultPath, STATE_DIR);
}

export function statePath(vaultPath: string): string {
  return join(stateDir(vaultPath), STATE_FILE);
}

export function configPath(vaultPath: string): string {
  return join(stateDir(vaultPath), CONFIG_FILE);
}

export async function ensureStateDir(vaultPath: string): Promise<void> {
  await mkdir(stateDir(vaultPath), { recursive: true });
}

export async function loadConfig(vaultPath: string): Promise<StandaloneConfig> {
  const path = configPath(vaultPath);
  if (!existsSync(path)) return { ...DEFAULT_CONFIG };
  const raw = (await readFile(path, 'utf8')).replace(/^\uFEFF/, '');
  const parsed = JSON.parse(raw) as Partial<StandaloneConfig>;
  return {
    ...DEFAULT_CONFIG,
    ...parsed,
    includeFolders: Array.isArray(parsed.includeFolders)
      ? parsed.includeFolders
      : DEFAULT_CONFIG.includeFolders,
    excludeFolders: Array.isArray(parsed.excludeFolders)
      ? parsed.excludeFolders
      : DEFAULT_CONFIG.excludeFolders,
    includeTags: Array.isArray(parsed.includeTags)
      ? parsed.includeTags
      : DEFAULT_CONFIG.includeTags,
  };
}

export async function saveConfig(
  vaultPath: string,
  config: StandaloneConfig,
): Promise<void> {
  await ensureStateDir(vaultPath);
  await writeJson(configPath(vaultPath), config);
}

export async function loadState(vaultPath: string): Promise<StateFile> {
  const path = statePath(vaultPath);
  if (!existsSync(path)) {
    return { schemaVersion: 1, updatedAt: new Date().toISOString(), graph: emptyGraph(new Date().toISOString()) };
  }
  const raw = (await readFile(path, 'utf8')).replace(/^\uFEFF/, '');
  const parsed = JSON.parse(raw) as Partial<StateFile>;
  if (!parsed.graph || !Array.isArray(parsed.graph.nodes) || !Array.isArray(parsed.graph.edges)) {
    throw new Error(`Invalid InterestSeed state: ${path}`);
  }
  return {
    schemaVersion: 1,
    updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    graph: parsed.graph,
  };
}

export async function saveGraph(vaultPath: string, graph: InterestSeedGraph): Promise<void> {
  await ensureStateDir(vaultPath);
  const state: StateFile = {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    graph,
  };
  await writeJson(statePath(vaultPath), state);
}

async function writeJson(path: string, value: unknown): Promise<void> {
  const temp = `${path}.tmp`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temp, path);
}
