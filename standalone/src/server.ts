import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { existsSync } from 'node:fs';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AiRelationSuggestion } from '../../src/services/ModelProvider';
import { connectSuggestion, resolveApiKey } from './ai';
import { captureToVault } from './capture';
import { suggestRelations } from './ai';
import {
  activeExperiment,
  experimentView,
  extendExperiment,
  listExperiments,
  logExperiment,
  startExperiment,
} from './experiments';
import {
  applyDiscovery,
  dismissDiscovery,
  discoveryView,
  feedbackDiscovery,
  listDiscoveries,
  refreshDiscoveries,
} from './discoveries';
import { enqueueInbox, listInbox, resolveInbox } from './inbox';
import { scanAndBuild } from './graph';
import { ensureStateDir, loadConfig, loadState, saveConfig, stateDir, undoGraph } from './state';

export interface ServerOptions {
  vaultPath: string;
  port: number;
}

const webRoot = [
  resolve(fileURLToPath(new URL('../web', import.meta.url))),
  resolve(fileURLToPath(new URL('./web', import.meta.url))),
].find((path) => existsSync(join(path, 'index.html'))) ?? resolve(fileURLToPath(new URL('../web', import.meta.url)));

export function startServer(options: ServerOptions): void {
  const server = createServer(async (request, response) => {
    try {
      await route(request, response, options);
    } catch (error) {
      sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) });
    }
  });
  server.listen(options.port, '127.0.0.1', () => {
    console.log(`InterestSeed running at http://127.0.0.1:${options.port}`);
    console.log(`Vault: ${options.vaultPath}`);
  });
}

async function route(
  request: IncomingMessage,
  response: ServerResponse,
  options: ServerOptions,
): Promise<void> {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  if (url.pathname === '/api/state') return sendJson(response, 200, await statePayload(options.vaultPath));
  if (url.pathname === '/api/scan' && request.method === 'POST') {
    const result = await scanAndBuild(options.vaultPath);
    return sendJson(response, 200, {
      ...(await statePayload(options.vaultPath)),
      files: result.files,
      skipped: result.skipped,
      warnings: result.warnings,
    });
  }
  if (url.pathname === '/api/capture' && request.method === 'POST') {
    const body = await readJson(request);
    const captured = await captureToVault(options.vaultPath, {
      text: typeof body.text === 'string' ? body.text : '',
      ...(typeof body.url === 'string' ? { url: body.url } : {}),
      ...(typeof body.title === 'string' ? { title: body.title } : {}),
    });
    await scanAndBuild(options.vaultPath);
    return sendJson(response, 200, { ok: true, captured, ...(await statePayload(options.vaultPath)) });
  }
  if (url.pathname === '/api/suggest' && (request.method === 'GET' || request.method === 'POST')) {
    const body = request.method === 'POST' ? await readJson(request) : {};
    const nodeId =
      url.searchParams.get('nodeId') ??
      (typeof body.nodeId === 'string' ? body.nodeId : undefined);
    const suggestions = await suggestRelations(options.vaultPath, nodeId ?? undefined);
    return sendJson(response, 200, { suggestions });
  }
  if (url.pathname === '/api/connect' && request.method === 'POST') {
    const body = await readJson(request);
    const suggestion = body.suggestion as AiRelationSuggestion | undefined;
    if (!suggestion) return sendJson(response, 400, { error: 'suggestion required' });
    const result = await connectSuggestion(options.vaultPath, suggestion);
    return sendJson(response, 200, result);
  }
  if (url.pathname === '/api/undo' && request.method === 'POST') {
    const previous = await undoGraph(options.vaultPath);
    if (!previous) return sendJson(response, 200, { ok: false, message: 'Nothing to undo.' });
    return sendJson(response, 200, { ok: true, ...(await statePayload(options.vaultPath)) });
  }
  if (url.pathname === '/api/experiments' && request.method === 'GET') {
    const experiments = (await listExperiments(options.vaultPath)).map(experimentView);
    return sendJson(response, 200, { experiments });
  }
  if (url.pathname === '/api/experiments' && request.method === 'POST') {
    const body = await readJson(request);
    const experiment = await startExperiment(options.vaultPath, {
      title: typeof body.title === 'string' ? body.title : '',
      ...(typeof body.hypothesis === 'string' ? { hypothesis: body.hypothesis } : {}),
      ...(typeof body.nodeId === 'string' ? { nodeId: body.nodeId } : {}),
      ...(typeof body.targetDays === 'number' ? { targetDays: body.targetDays } : {}),
    });
    return sendJson(response, 200, { ok: true, experiment: experimentView(experiment) });
  }
  if (url.pathname === '/api/experiments/log' && request.method === 'POST') {
    const body = await readJson(request);
    const experiment = await logExperiment(
      options.vaultPath,
      typeof body.id === 'string' ? body.id : '',
      {
        interest: Number(body.interest ?? 3),
        energy: Number(body.energy ?? 3),
        evidence: typeof body.evidence === 'string' ? body.evidence : '',
        ...(typeof body.next === 'string' ? { next: body.next } : {}),
      },
    );
    return sendJson(response, 200, { ok: true, experiment: experimentView(experiment) });
  }
  if (url.pathname === '/api/experiments/extend' && request.method === 'POST') {
    const body = await readJson(request);
    const experiment = await extendExperiment(
      options.vaultPath,
      typeof body.id === 'string' ? body.id : '',
      Number(body.targetDays ?? 7),
    );
    return sendJson(response, 200, { ok: true, experiment: experimentView(experiment) });
  }
  if (url.pathname === '/api/discoveries' && request.method === 'GET') {
    const discoveries = (await listDiscoveries(options.vaultPath)).map(discoveryView);
    return sendJson(response, 200, { discoveries });
  }
  if (url.pathname === '/api/discoveries/refresh' && request.method === 'POST') {
    const discoveries = (await refreshDiscoveries(options.vaultPath)).map(discoveryView);
    return sendJson(response, 200, { ok: true, discoveries });
  }
  if (url.pathname === '/api/discoveries/apply' && request.method === 'POST') {
    const body = await readJson(request);
    const result = await applyDiscovery(
      options.vaultPath,
      typeof body.id === 'string' ? body.id : '',
    );
    return sendJson(response, 200, { ...result, ...(await statePayload(options.vaultPath)) });
  }
  if (url.pathname === '/api/discoveries/dismiss' && request.method === 'POST') {
    const body = await readJson(request);
    const result = await dismissDiscovery(
      options.vaultPath,
      typeof body.id === 'string' ? body.id : '',
    );
    return sendJson(response, 200, result);
  }
  if (url.pathname === '/api/discoveries/feedback' && request.method === 'POST') {
    const body = await readJson(request);
    const action = body.action as 'accepted' | 'rejected' | 'low-value' | 'needs-verification' | 'corrected';
    const result = await feedbackDiscovery(
      options.vaultPath,
      typeof body.id === 'string' ? body.id : '',
      action,
      typeof body.correction === 'string' ? body.correction : undefined,
    );
    return sendJson(response, 200, { ...result, ...(await statePayload(options.vaultPath)) });
  }
  if (url.pathname === '/api/inbox' && request.method === 'GET') {
    return sendJson(response, 200, { items: await listInbox(options.vaultPath) });
  }
  if (url.pathname === '/api/inbox' && request.method === 'POST') {
    const body = await readJson(request);
    const result = await enqueueInbox(
      options.vaultPath,
      typeof body.text === 'string' ? body.text : '',
      body.source === 'share' || body.source === 'note' ? body.source : 'clipboard',
      typeof body.sourceRef === 'string' ? body.sourceRef : '',
    );
    return sendJson(response, 200, { ok: true, ...result });
  }
  if (url.pathname === '/api/inbox/resolve' && request.method === 'POST') {
    const body = await readJson(request);
    const status = body.status === 'passed' ? 'passed' : 'kept';
    const result = await resolveInbox(
      options.vaultPath,
      typeof body.id === 'string' ? body.id : '',
      status,
    );
    if (status === 'kept') await scanAndBuild(options.vaultPath);
    return sendJson(response, 200, { ok: true, ...result, ...(await statePayload(options.vaultPath)) });
  }
  if (url.pathname === '/api/config' && request.method === 'GET') {
    const config = await loadConfig(options.vaultPath);
    const key = await resolveApiKey(options.vaultPath, config);
    return sendJson(response, 200, { config, keyReady: Boolean(key) });
  }
  if (url.pathname === '/api/config' && request.method === 'PUT') {
    const body = await readJson(request);
    const config = await loadConfig(options.vaultPath);
    if (typeof body.model === 'string' && body.model.trim()) config.model = body.model.trim();
    if (typeof body.baseUrl === 'string' && body.baseUrl.trim()) config.baseUrl = body.baseUrl.trim();
    if (typeof body.keyEnv === 'string' && body.keyEnv.trim()) config.keyEnv = body.keyEnv.trim();
    if (typeof body.enableAI === 'boolean') config.enableAI = body.enableAI;
    if (typeof body.aiConsentGranted === 'boolean') config.aiConsentGranted = body.aiConsentGranted;
    if (Array.isArray(body.includeFolders)) config.includeFolders = body.includeFolders.map(String);
    if (Array.isArray(body.excludeFolders)) config.excludeFolders = body.excludeFolders.map(String);
    if (Array.isArray(body.includeTags)) config.includeTags = body.includeTags.map(String);
    if (typeof body.key === 'string') {
      await ensureStateDir(options.vaultPath);
      const keyPath = join(stateDir(options.vaultPath), 'key');
      const value = body.key.trim();
      if (value) await writeFile(keyPath, value, 'utf8');
      else if (existsSync(keyPath)) await rm(keyPath);
    }
    await saveConfig(options.vaultPath, config);
    const key = await resolveApiKey(options.vaultPath, config);
    return sendJson(response, 200, { ok: true, config, keyReady: Boolean(key) });
  }
  if (url.pathname === '/api/graph') {
    return sendJson(response, 200, (await loadState(options.vaultPath)).graph);
  }

  const filePath = url.pathname === '/' ? join(webRoot, 'index.html') : join(webRoot, url.pathname);
  if (!filePath.startsWith(webRoot)) return sendText(response, 403, 'Forbidden');
  try {
    const content = await readFile(filePath);
    response.writeHead(200, { 'Content-Type': mime(filePath) });
    response.end(content);
  } catch {
    sendText(response, 404, 'Not found');
  }
}

async function statePayload(vaultPath: string) {
  const state = await loadState(vaultPath);
  const config = await loadConfig(vaultPath);
  const key = await resolveApiKey(vaultPath, config);
  const active = await activeExperiment(vaultPath);
  const experiments = (await listExperiments(vaultPath)).map(experimentView);
  const discoveries = (await listDiscoveries(vaultPath)).map(discoveryView);
  const inbox = await listInbox(vaultPath);
  const degree = new Map<string, number>();
  for (const node of state.graph.nodes) degree.set(node.id, 0);
  for (const edge of state.graph.edges) {
    if (edge.status === 'rejected') continue;
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
  }
  const top = [...state.graph.nodes]
    .sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0))
    .slice(0, 3)
    .map((node) => ({ id: node.id, title: node.title, degree: degree.get(node.id) ?? 0 }));
  const themeCounts = new Map<string, number>();
  for (const node of state.graph.nodes) {
    for (const tag of node.tags ?? []) themeCounts.set(tag, (themeCounts.get(tag) ?? 0) + 1);
  }
  const themes = [...themeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([tag, count]) => ({ tag, count }));
  const orphans = state.graph.nodes.filter((node) => (degree.get(node.id) ?? 0) === 0).length;
  const insights = { top, themes, orphans };
  return {
    vaultPath,
    model: config.model,
    baseUrl: config.baseUrl,
    keyReady: Boolean(key),
    graph: state.graph,
    insights,
    activeExperiment: active ? experimentView(active) : null,
    experiments,
    discoveries,
    inbox: {
      pending: inbox.filter((item) => item.status === 'pending').length,
      items: inbox,
    },
    stats: {
      nodes: state.graph.nodes.length,
      edges: state.graph.edges.length,
      confirmed: state.graph.edges.filter((edge) => edge.status === 'confirmed').length,
      suggested: state.graph.edges.filter((edge) => edge.status === 'suggested').length,
    },
  };
}

function sendJson(
  response: ServerResponse,
  status: number,
  value: unknown,
): void {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
}

function sendText(
  response: ServerResponse,
  status: number,
  value: string,
): void {
  response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end(value);
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  return JSON.parse(raw) as Record<string, unknown>;
}

function mime(path: string): string {
  return (
    {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
    }[extname(path)] ?? 'application/octet-stream'
  );
}
