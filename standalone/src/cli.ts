#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { connectSuggestion, suggestRelations } from './ai';
import { captureToVault } from './capture';
import {
  applyDiscovery,
  dismissDiscovery,
  discoveryView,
  listDiscoveries,
  refreshDiscoveries,
} from './discoveries';
import { enqueueInbox, listInbox, resolveInbox } from './inbox';
import {
  activeExperiment,
  experimentView,
  listExperiments,
  logExperiment,
  startExperiment,
} from './experiments';
import { scanAndBuild } from './graph';
import { startServer } from './server';
import {
  DEFAULT_CONFIG,
  ensureStateDir,
  loadConfig,
  loadState,
  saveConfig,
  undoGraph,
} from './state';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] ?? 'help';
  const flags = parseFlags(args.slice(1));
  const vaultPath = resolve(
    typeof flags.vault === 'string' ? flags.vault : process.cwd(),
  );

  if (command === 'help' || flags.help) return help();
  if (!existsSync(vaultPath)) throw new Error(`Vault not found: ${vaultPath}`);

  if (command === 'init') {
    await ensureStateDir(vaultPath);
    await saveConfig(vaultPath, { ...DEFAULT_CONFIG, ...(await loadConfig(vaultPath)) });
    const result = await scanAndBuild(vaultPath);
    return print({
      ok: true,
      vaultPath,
      nodes: result.graph.nodes.length,
      edges: result.graph.edges.length,
      files: result.files,
    });
  }

  if (command === 'scan') {
    const result = await scanAndBuild(vaultPath);
    return print({
      ok: true,
      nodes: result.graph.nodes.length,
      edges: result.graph.edges.length,
      files: result.files,
      skipped: result.skipped,
      warnings: result.warnings.slice(0, 5),
    });
  }

  if (command === 'capture') {
    const text = typeof flags.text === 'string' ? flags.text : '';
    if (!text.trim()) throw new Error('capture requires --text');
    const captured = await captureToVault(vaultPath, {
      text,
      ...(typeof flags.url === 'string' ? { url: flags.url } : {}),
      ...(typeof flags.title === 'string' ? { title: flags.title } : {}),
    });
    const result = await scanAndBuild(vaultPath);
    return print({
      ok: true,
      captured,
      nodes: result.graph.nodes.length,
      edges: result.graph.edges.length,
    });
  }

  if (command === 'status') {
    const state = await loadState(vaultPath);
    const config = await loadConfig(vaultPath);
    const active = await activeExperiment(vaultPath);
    const experiments = await listExperiments(vaultPath);
    return print({
      vaultPath,
      model: config.model,
      baseUrl: config.baseUrl,
      nodes: state.graph.nodes.length,
      edges: state.graph.edges.length,
      experiments: experiments.length,
      activeExperiment: active ? experimentView(active) : null,
      discoveries: (await listDiscoveries(vaultPath)).length,
      inbox: (await listInbox(vaultPath)).filter((item) => item.status === 'pending').length,
    });
  }

  if (command === 'undo') {
    const previous = await undoGraph(vaultPath);
    if (!previous) return print({ ok: false, message: 'Nothing to undo.' });
    return print({ ok: true, nodes: previous.nodes.length, edges: previous.edges.length });
  }

  if (command === 'suggest') {
    const nodeId = typeof flags.node === 'string' ? flags.node : undefined;
    const suggestions = await suggestRelations(vaultPath, nodeId);
    return print({ suggestions });
  }

  if (command === 'connect') {
    const source = typeof flags.source === 'string' ? flags.source : '';
    const target = typeof flags.target === 'string' ? flags.target : '';
    const relation = typeof flags.relation === 'string' ? flags.relation : '相关';
    if (!source || !target) throw new Error('connect requires --source and --target');
    const result = await connectSuggestion(vaultPath, {
      source,
      target,
      relation,
      ...(typeof flags.reason === 'string' ? { reason: flags.reason } : {}),
      ...(typeof flags.confidence === 'string'
        ? { confidence: Number(flags.confidence) }
        : {}),
    });
    return print(result);
  }

  if (command === 'experiment') {
    const sub = args[1] ?? 'list';
    if (sub === 'list') {
      const experiments = (await listExperiments(vaultPath)).map(experimentView);
      return print({ experiments });
    }
    if (sub === 'start') {
      const title = typeof flags.title === 'string' ? flags.title : '';
      if (!title) throw new Error('experiment start requires --title');
      const experiment = await startExperiment(vaultPath, {
        title,
        ...(typeof flags.node === 'string' ? { nodeId: flags.node } : {}),
        ...(typeof flags.days === 'string' ? { targetDays: Number(flags.days) } : {}),
      });
      return print({ ok: true, experiment: experimentView(experiment) });
    }
    if (sub === 'log') {
      const id = typeof flags.id === 'string' ? flags.id : '';
      const evidence = typeof flags.evidence === 'string' ? flags.evidence : '';
      if (!id) throw new Error('experiment log requires --id');
      const experiment = await logExperiment(vaultPath, id, {
        interest: Number(flags.interest ?? 3),
        energy: Number(flags.energy ?? 3),
        evidence,
        ...(typeof flags.next === 'string' ? { next: flags.next } : {}),
      });
      return print({ ok: true, experiment: experimentView(experiment) });
    }
    throw new Error(`Unknown experiment command: ${sub}`);
  }

  if (command === 'discoveries') {
    const sub = args[1] ?? 'list';
    if (sub === 'list') {
      return print({ discoveries: (await listDiscoveries(vaultPath)).map(discoveryView) });
    }
    if (sub === 'refresh') {
      const discoveries = await refreshDiscoveries(vaultPath);
      return print({ ok: true, discoveries: discoveries.map(discoveryView) });
    }
    if (sub === 'apply') {
      return print(await applyDiscovery(vaultPath, typeof flags.id === 'string' ? flags.id : ''));
    }
    if (sub === 'dismiss') {
      return print(await dismissDiscovery(vaultPath, typeof flags.id === 'string' ? flags.id : ''));
    }
    throw new Error(`Unknown discoveries command: ${sub}`);
  }

  if (command === 'inbox') {
    const sub = args[1] ?? 'list';
    if (sub === 'list') {
      return print({ items: await listInbox(vaultPath) });
    }
    if (sub === 'add') {
      const text = typeof flags.text === 'string' ? flags.text : '';
      const result = await enqueueInbox(vaultPath, text, 'clipboard');
      return print({ ok: true, ...result });
    }
    if (sub === 'keep' || sub === 'pass') {
      const id = typeof flags.id === 'string' ? flags.id : '';
      const result = await resolveInbox(vaultPath, id, sub === 'keep' ? 'kept' : 'passed');
      if (sub === 'keep') {
        const graph = await scanAndBuild(vaultPath);
        return print({ ok: true, ...result, nodes: graph.graph.nodes.length });
      }
      return print({ ok: true, ...result });
    }
    throw new Error(`Unknown inbox command: ${sub}`);
  }

  if (command === 'serve') {
    const port = Number(flags.port ?? 4173);
    startServer({ vaultPath, port });
    return;
  }

  if (command === 'skill') {
    const skillPath = resolve(import.meta.dirname, '..', 'skill', 'SKILL.md');
    console.log(skillPath);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

function parseFlags(args: string[]): Record<string, string | true> {
  const result: Record<string, string | true> = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = args[index + 1];
    if (next && !next.startsWith('--')) {
      result[key] = next;
      index += 1;
    } else {
      result[key] = true;
    }
  }
  return result;
}

function print(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

function help(): void {
  console.log(`InterestSeed — local-first interest validation for Markdown vaults

Usage:
  interestseed init [--vault <path>]
  interestseed scan [--vault <path>]
  interestseed capture --text <text> [--title <title>] [--url <url>]
  interestseed status [--vault <path>]
  interestseed discoveries list | refresh | apply --id <id> | dismiss --id <id>
  interestseed inbox list | add --text <text> | keep --id <id> | pass --id <id>
  interestseed suggest [--vault <path>] [--node <id>]
  interestseed connect --source <id> --target <id> --relation <name> [--reason <text>]
  interestseed undo
  interestseed experiment start --title <title> [--node <id>] [--days 3]
  interestseed experiment log --id <id> --evidence <text> [--interest 4] [--energy 4]
  interestseed experiment list
  interestseed serve [--vault <path>] [--port 4173]
  interestseed skill

Environment:
  INTERESTSEED_AI_API_KEY   local model key
  INTERESTSEED_AI_MODEL     optional model override
`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
