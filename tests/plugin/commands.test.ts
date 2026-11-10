/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Copyright (C) 2026 aicoder
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const notices: string[] = [];
vi.mock('obsidian', () => ({
  Notice: class {
    constructor(public message: string) {
      notices.push(message);
    }
  },
}));

import type { Plugin } from 'obsidian';
import { registerCommands, type CommandHost } from '../../src/plugin/commands';

interface RegisteredCommand {
  id: string;
  name: string;
  callback?: () => unknown;
  checkCallback?: (checking: boolean) => unknown;
}

function makePlugin() {
  const commands: RegisteredCommand[] = [];
  const plugin = {
    addCommand: (command: RegisteredCommand) => {
      commands.push(command);
      return command;
    },
  } as unknown as Plugin;
  return { plugin, commands };
}

function makeHost(overrides: Record<string, unknown> = {}) {
  const calls: Record<string, unknown[][]> = {};
  const host = new Proxy(
    {},
    {
      get(_target, property) {
        if (typeof property !== 'string') return undefined;
        if (property === 'undo') {
          return overrides.undo ?? { undo: vi.fn(() => true), redo: vi.fn(() => true) };
        }
        const override = overrides[property];
        if (override !== undefined) return override;
        return (...args: unknown[]) => {
          (calls[property] ??= []).push(args);
          return undefined;
        };
      },
    },
  ) as unknown as CommandHost;
  return { host, calls };
}

function byId(commands: RegisteredCommand[], id: string): RegisteredCommand {
  const found = commands.find((command) => command.id === id);
  if (!found) throw new Error(`command not registered: ${id}`);
  return found;
}

const EXPECTED_IDS = [
  'interestseed-open',
  'interestseed-seed-sprint',
  'interestseed-spark',
  'interestseed-share-clipboard',
  'interestseed-canvas-export',
  'interestseed-route',
  'interestseed-share-card',
  'interestseed-import-favorites',
  'interestseed-inbox',
  'interestseed-note-inbox',
  'interestseed-experiment',
  'interestseed-quick-did',
  'interestseed-quick-thought',
  'interestseed-quick-missed',
  'interestseed-agent',
  'interestseed-export',
  'interestseed-rebuild',
  'interestseed-new-node',
  'interestseed-node-from-file',
  'interestseed-refresh-suggestions',
  'interestseed-audit',
  'interestseed-overview',
  'interestseed-explorer',
  'interestseed-reconcile-discoveries',
  'interestseed-undo',
  'interestseed-redo',
  'interestseed-ai-expand',
  'interestseed-ai-panel',
  'interestseed-ai-from-note',
  'interestseed-ai-setup',
  'interestseed-clear',
  'interestseed-retry-save',
  'interestseed-backup',
  'interestseed-repair-storage',
];

describe('commands', () => {
  beforeEach(() => {
    notices.length = 0;
  });

  it('registers the stable command id list in order', () => {
    const { plugin, commands } = makePlugin();
    const { host } = makeHost();
    registerCommands(plugin, host);
    expect(commands.map((command) => command.id)).toEqual(EXPECTED_IDS);
  });

  it('keeps ids unique and namespaced', () => {
    const { plugin, commands } = makePlugin();
    const { host } = makeHost();
    registerCommands(plugin, host);
    expect(new Set(commands.map((command) => command.id)).size).toBe(commands.length);
    for (const command of commands) {
      expect(command.id.startsWith('interestseed-')).toBe(true);
    }
  });

  it('keeps names non-empty and unique', () => {
    const { plugin, commands } = makePlugin();
    const { host } = makeHost();
    registerCommands(plugin, host);
    const names = commands.map((command) => command.name);
    for (const name of names) expect(name.trim().length).toBeGreaterThan(0);
    expect(new Set(names).size).toBe(names.length);
  });

  it('gives every command an executable handler', () => {
    const { plugin, commands } = makePlugin();
    const { host } = makeHost();
    registerCommands(plugin, host);
    for (const command of commands) {
      const handler = command.callback ?? command.checkCallback;
      expect(typeof handler).toBe('function');
    }
  });

  it('wires representative commands to their own host method', () => {
    const { plugin, commands } = makePlugin();
    const { host, calls } = makeHost();
    registerCommands(plugin, host);

    const expectations: Array<[string, string]> = [
      ['interestseed-open', 'activateView'],
      ['interestseed-seed-sprint', 'openSeedSprint'],
      ['interestseed-share-card', 'openShareCard'],
      ['interestseed-import-favorites', 'openImportFavorites'],
      ['interestseed-inbox', 'openInbox'],
      ['interestseed-audit', 'promptAudit'],
      ['interestseed-ai-panel', 'openAiPanel'],
      ['interestseed-clear', 'clearGraph'],
      ['interestseed-retry-save', 'retrySave'],
      ['interestseed-repair-storage', 'repairGraphStorage'],
      ['interestseed-backup', 'createBackup'],
    ];

    for (const [id, method] of expectations) {
      for (const key of Object.keys(calls)) delete calls[key];
      byId(commands, id).callback?.();
      expect(calls[method], `${id} should call ${method}`).toHaveLength(1);
    }
  });

  it('passes the right check-in kind for each quick command', () => {
    const { plugin, commands } = makePlugin();
    const kinds: string[] = [];
    const { host } = makeHost({
      recordQuickExperiment: (kind: string) => {
        kinds.push(kind);
        return true;
      },
    });
    registerCommands(plugin, host);

    byId(commands, 'interestseed-quick-did').callback?.();
    byId(commands, 'interestseed-quick-thought').callback?.();
    byId(commands, 'interestseed-quick-missed').callback?.();

    expect(kinds).toEqual(['did', 'thought', 'missed']);
  });

  it('notices when a quick check-in is refused', () => {
    const { plugin, commands } = makePlugin();
    const { host } = makeHost({ recordQuickExperiment: () => false });
    registerCommands(plugin, host);
    byId(commands, 'interestseed-quick-did').callback?.();
    expect(notices.at(-1)).toBe('今天已经记录过了，或没有进行中的实验。');
  });

  it('executes every registered command without throwing', () => {
    const { plugin, commands } = makePlugin();
    const { host } = makeHost({ recordQuickExperiment: () => true });
    registerCommands(plugin, host);

    for (const command of commands) {
      const handler = command.callback ?? command.checkCallback;
      expect(() => handler?.(false), `${command.id} threw`).not.toThrow();
    }
  });

  it('routes undo and redo through the undo history', () => {    const { plugin, commands } = makePlugin();
    const undo = { undo: vi.fn(() => true), redo: vi.fn(() => true) };
    const { host } = makeHost({ undo });
    registerCommands(plugin, host);

    byId(commands, 'interestseed-undo').callback?.();
    expect(undo.undo).toHaveBeenCalledTimes(1);

    byId(commands, 'interestseed-redo').callback?.();
    expect(undo.redo).toHaveBeenCalledTimes(1);
  });
});
