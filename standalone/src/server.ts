import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { chmod, readFile, rm, writeFile } from 'node:fs/promises';
import { extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { InsightEngine } from '../../src/core/InsightEngine';
import type { AiRelationSuggestion } from '../../src/services/ModelProvider';
import { connectSuggestion, resolveApiKey } from './ai';
import { captureToVault } from './capture';
import { suggestRelations, AiPreconditionError } from './ai';
import {
  activeExperiment,
  ExperimentError,
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
import { ImportInputError, importFavorites } from './import';
import { scanAndBuild } from './graph';
import { ensureStateDir, loadConfig, loadState, saveConfig, saveGraph, stateDir, undoGraph } from './state';

declare const __INTERESTSEED_VERSION__: string | undefined;
const SERVICE_VERSION = typeof __INTERESTSEED_VERSION__ === 'string' ? __INTERESTSEED_VERSION__ : 'dev';

export interface ServerOptions {
  vaultPath: string;
  port: number;
}

const MAX_REQUEST_BODY_BYTES = 1024 * 1024;

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * 把领域层的“可预期失败”翻译成正确的 HTTP 状态码。
 * 未识别的错误继续向上抛，由统一错误处理返回 500 且不泄露内部信息。
 */
function mapDomainError(error: unknown): never {
  if (error instanceof AiPreconditionError) {
    throw new HttpError(409, error.message);
  }
  if (error instanceof ExperimentError) {
    throw new HttpError(error.status, error.message);
  }
  throw error;
}

const webRoot = [
  resolve(fileURLToPath(new URL('../web', import.meta.url))),
  resolve(fileURLToPath(new URL('./web', import.meta.url))),
].find((path) => existsSync(join(path, 'index.html'))) ?? resolve(fileURLToPath(new URL('../web', import.meta.url)));

export function createInterestSeedServer(options: ServerOptions): Server {
  const sessionToken = randomBytes(32).toString('hex');
  return createServer(async (request, response) => {
    try {
      await route(request, response, options, sessionToken);
    } catch (error) {
      if (error instanceof HttpError) {
        if (!response.headersSent) {
          sendJson(response, error.status, { error: error.message });
        } else {
          response.end();
        }
        return;
      }
      console.error('InterestSeed server error:', error);
      if (response.headersSent) {
        response.end();
        return;
      }
      sendJson(response, 500, { error: 'Internal server error.' });
    }
  });
}

export function startServer(options: ServerOptions): Server {
  if (!Number.isInteger(options.port) || options.port < 0 || options.port > 65535) {
    throw new Error('Port must be an integer between 0 and 65535.');
  }
  const server = createInterestSeedServer(options);
  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${options.port} is already in use. Try another --port value.`);
    } else {
      console.error(`InterestSeed server failed: ${error.message}`);
    }
    process.exitCode = 1;
  });
  server.listen(options.port, '127.0.0.1', () => {
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : options.port;
    console.log(`InterestSeed running at http://127.0.0.1:${port}`);
    console.log(`Vault: ${options.vaultPath}`);
    console.log('Local only: do not expose this port to a network.');
  });
  return server;
}

async function route(
  request: IncomingMessage,
  response: ServerResponse,
  options: ServerOptions,
  sessionToken: string,
): Promise<void> {
  const isApi = (request.url ?? '/').startsWith('/api/');
  if (isApi) {
    if (!isAllowedHost(request)) {
      return sendJson(response, 403, { error: 'Host rejected.' });
    }
    if (!isAllowedOrigin(request)) {
      return sendJson(response, 403, { error: 'Cross-origin request rejected.' });
    }
    if (
      !(request.url ?? '').startsWith('/api/session') &&
      requiresSessionToken(request) &&
      request.headers['x-interestseed-token'] !== sessionToken
    ) {
      return sendJson(response, 403, { error: 'Session token required.' });
    }
  }
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method ?? '')) {
    const contentType = String(request.headers['content-type'] ?? '').toLowerCase();
    if (!contentType.startsWith('application/json')) {
      return sendJson(response, 415, { error: 'Content-Type must be application/json.' });
    }
  }
  if (url.pathname === '/api/session' && request.method === 'GET') {
    return sendJson(response, 200, { token: sessionToken });
  }
  if (url.pathname === '/api/health' && request.method === 'GET') {
    return sendJson(response, 200, {
      ok: true,
      service: 'interestseed',
      version: SERVICE_VERSION,
      localOnly: true,
    });
  }
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
    try {
      const suggestions = await suggestRelations(options.vaultPath, nodeId ?? undefined);
      return sendJson(response, 200, { suggestions });
    } catch (error) {
      // AI 未配置是客户端可修复状态，用 409 把可操作提示透出去，而不是 500 掩盖掉。
      mapDomainError(error);
    }
  }
  if (url.pathname === '/api/connect' && request.method === 'POST') {
    const body = await readJson(request);
    const suggestion = body.suggestion as AiRelationSuggestion | undefined;
    if (!suggestion) return sendJson(response, 400, { error: 'suggestion required' });
    const result = await connectSuggestion(options.vaultPath, suggestion);
    return sendJson(response, 200, result);
  }
  if (url.pathname === '/api/edges/reject' && request.method === 'POST') {
    const body = await readJson(request);
    const edgeId = typeof body.edgeId === 'string' ? body.edgeId : '';
    if (!edgeId) return sendJson(response, 400, { error: 'edgeId required' });
    const state = await loadState(options.vaultPath);
    const edge = state.graph.edges.find((item) => item.id === edgeId);
    if (!edge) return sendJson(response, 404, { error: 'Edge not found.' });
    const now = new Date().toISOString();
    await saveGraph(options.vaultPath, {
      ...state.graph,
      edges: state.graph.edges.map((item) =>
        item.id === edgeId ? { ...item, status: 'rejected' as const, updatedAt: now } : item,
      ),
      updatedAt: now,
    });
    return sendJson(response, 200, { ok: true, ...(await statePayload(options.vaultPath)) });
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
    try {
      const experiment = await startExperiment(options.vaultPath, {
        title: typeof body.title === 'string' ? body.title : '',
        ...(typeof body.hypothesis === 'string' ? { hypothesis: body.hypothesis } : {}),
        ...(typeof body.nodeId === 'string' ? { nodeId: body.nodeId } : {}),
        ...(typeof body.targetDays === 'number' ? { targetDays: body.targetDays } : {}),
      });
      return sendJson(response, 200, { ok: true, experiment: experimentView(experiment) });
    } catch (error) {
      mapDomainError(error);
    }
  }
  if (url.pathname === '/api/experiments/log' && request.method === 'POST') {
    const body = await readJson(request);
    try {
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
    } catch (error) {
      mapDomainError(error);
    }
  }
  if (url.pathname === '/api/experiments/extend' && request.method === 'POST') {
    const body = await readJson(request);
    try {
      const experiment = await extendExperiment(
        options.vaultPath,
        typeof body.id === 'string' ? body.id : '',
        Number(body.targetDays ?? 7),
      );
      return sendJson(response, 200, { ok: true, experiment: experimentView(experiment) });
    } catch (error) {
      mapDomainError(error);
    }
  }
  if (url.pathname === '/api/experiments/decision' && request.method === 'POST') {
    const body = await readJson(request);
    const decision = body.decision;
    if (decision !== 'keep' && decision !== 'change' && decision !== 'drop') {
      return sendJson(response, 400, { error: 'decision must be keep, change or drop' });
    }
    const id = typeof body.id === 'string' ? body.id : '';
    if (!id) return sendJson(response, 400, { error: 'id required' });
    await ensureStateDir(options.vaultPath);
    const path = join(stateDir(options.vaultPath), 'decisions.json');
    let decisions: unknown[] = [];
    try {
      const parsed = JSON.parse(await readFile(path, 'utf8')) as { decisions?: unknown[] };
      if (Array.isArray(parsed.decisions)) decisions = parsed.decisions;
    } catch {
      decisions = [];
    }
    decisions.push({
      experimentId: id,
      decision,
      note: typeof body.note === 'string' ? body.note.slice(0, 500) : '',
      at: new Date().toISOString(),
    });
    await writeFile(path, `${JSON.stringify({ decisions }, null, 2)}\n`, 'utf8');
    return sendJson(response, 200, { ok: true, decision });
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
  if (url.pathname === '/api/inbox/import' && request.method === 'POST') {
    const body = await readJson(request);
    try {
      const report = await importFavorites(options.vaultPath, typeof body.text === 'string' ? body.text : '');
      return sendJson(response, 200, { ok: true, ...report });
    } catch (error) {
      if (error instanceof HttpError) throw error;
      if (error instanceof ImportInputError) throw new HttpError(400, error.message);
      mapDomainError(error);
    }
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
    if (typeof body.baseUrl === 'string' && body.baseUrl.trim()) {
      try {
        config.baseUrl = normalizeHttpBaseUrl(body.baseUrl.trim());
      } catch (error) {
        return sendJson(response, 400, {
          ok: false,
          message: error instanceof Error ? error.message : 'API 地址无效。',
        });
      }
    }
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
      if (value) {
        await writeFile(keyPath, value, { encoding: 'utf8', mode: 0o600 });
        await chmod(keyPath, 0o600).catch(() => undefined);
      } else if (existsSync(keyPath)) await rm(keyPath);
    }
    await saveConfig(options.vaultPath, config);
    const key = await resolveApiKey(options.vaultPath, config);
    return sendJson(response, 200, { ok: true, config, keyReady: Boolean(key) });
  }
  if (url.pathname === '/api/config/test' && request.method === 'POST') {
    const body = await readJson(request);
    const config = await loadConfig(options.vaultPath);
    const rawBaseUrl = typeof body.baseUrl === 'string' && body.baseUrl.trim()
      ? body.baseUrl.trim()
      : config.baseUrl;
    let baseUrl: string;
    try {
      baseUrl = normalizeHttpBaseUrl(rawBaseUrl);
    } catch (error) {
      return sendJson(response, 400, {
        ok: false,
        message: error instanceof Error ? error.message : 'API 地址无效。',
      });
    }
    const model = typeof body.model === 'string' && body.model.trim()
      ? body.model.trim()
      : config.model;
    const key = typeof body.apiKey === 'string' && body.apiKey.trim()
      ? body.apiKey.trim()
      : await resolveApiKey(options.vaultPath, config);
    if (!key) {
      return sendJson(response, 400, { ok: false, message: '还没有配置 Key。' });
    }
    const started = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      };
      const models = await fetch(`${baseUrl}/models`, { headers, signal: controller.signal });
      if (models.ok) {
        const payload = await models.json() as { data?: unknown[] };
        return sendJson(response, 200, {
          ok: true,
          mode: 'models',
          latencyMs: Date.now() - started,
          modelCount: Array.isArray(payload.data) ? payload.data.length : undefined,
        });
      }
      const chat = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
        }),
        signal: controller.signal,
      });
      if (!chat.ok) {
        const detail = (await chat.text()).replaceAll(key, '[redacted]').slice(0, 180);
        const retryAfter = chat.headers.get('retry-after')?.trim();
        if (chat.status === 429) {
          return sendJson(response, 429, {
            ok: false,
            message: retryAfter
              ? `模型限流（429），请 ${retryAfter} 秒后重试。`
              : '模型限流（429），请稍后重试。',
          });
        }
        return sendJson(response, 502, {
          ok: false,
          message: `模型返回 HTTP ${chat.status}${detail ? `：${detail}` : ''}`,
        });
      }
      const payload = await chat.json() as { model?: string };
      return sendJson(response, 200, {
        ok: true,
        mode: 'chat',
        latencyMs: Date.now() - started,
        model: payload.model ?? model,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return sendJson(response, 502, {
        ok: false,
        message: `连接失败：${detail}`,
      });
    } finally {
      clearTimeout(timeout);
    }
  }
  if (url.pathname === '/api/graph') {
    return sendJson(response, 200, (await loadState(options.vaultPath)).graph);
  }

  const filePath = url.pathname === '/' ? join(webRoot, 'index.html') : join(webRoot, url.pathname);
  const relativePath = relative(webRoot, filePath);
  if (!relativePath || relativePath.startsWith('..') || relativePath.includes(`..${sep}`)) {
    return sendText(response, 403, 'Forbidden');
  }
  try {
    const content = await readFile(filePath);
    response.writeHead(200, {
      'Content-Type': mime(filePath),
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'X-Permitted-Cross-Domain-Policies': 'none',
    });
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
  let advice = '';
  try {
    const deep = new InsightEngine().analyze(state.graph).insights;
    if (deep[0]) {
      advice = deep[0].kind === 'orphan'
        ? `有 ${deep[0].nodeIds.length} 个节点还没确认关系，先从当前节点开始连一条。`
        : `${deep[0].title}：${deep[0].detail}`;
    }
  } catch {
    advice = '';
  }
  if (!advice && orphans > 0) advice = `有 ${orphans} 个孤岛，先从它们开始连一条。`;
  const insights = { top, themes, orphans, advice };
  return {
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
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Resource-Policy': 'same-origin',
  });
  response.end(JSON.stringify(value));
}

function sendText(
  response: ServerResponse,
  status: number,
  value: string,
): void {
  response.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Resource-Policy': 'same-origin',
  });
  response.end(value);
}

function localPort(request: IncomingMessage): number | undefined {
  return request.socket.localPort;
}

function isLocalHostname(hostname: string): boolean {
  return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1' || hostname === '[::1]';
}

function isAllowedHost(request: IncomingMessage): boolean {
  const host = request.headers.host;
  if (!host) return false;
  try {
    const parsed = new URL(`http://${host}`);
    const port = parsed.port ? Number(parsed.port) : 80;
    return isLocalHostname(parsed.hostname) && port === localPort(request);
  } catch {
    return false;
  }
}

function isAllowedOrigin(request: IncomingMessage): boolean {
  const origin = request.headers.origin;
  const site = String(request.headers['sec-fetch-site'] ?? '');
  if (site === 'cross-site') return false;
  if (origin) {
    if (origin === 'null') return false;
    try {
      const parsed = new URL(origin);
      const port = parsed.port ? Number(parsed.port) : parsed.protocol === 'https:' ? 443 : 80;
      return isLocalHostname(parsed.hostname) && port === localPort(request);
    } catch {
      return false;
    }
  }
  return !site || site === 'same-origin' || site === 'none' || site === 'same-site';
}

function requiresSessionToken(request: IncomingMessage): boolean {
  const site = String(request.headers['sec-fetch-site'] ?? '');
  return Boolean(request.headers.origin) || site === 'same-origin';
}

function normalizeHttpBaseUrl(value: string): string {
  const parsed = new URL(value);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('API 地址只支持 http(s)。');
  }
  const local = ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(parsed.hostname);
  if (!local && process.env.INTERESTSEED_ALLOW_REMOTE_AI !== '1') {
    throw new Error('API 地址只允许本地 loopback；如需远端地址，请显式设置 INTERESTSEED_ALLOW_REMOTE_AI=1。');
  }
  return parsed.toString().replace(/\/+$/, '');
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_REQUEST_BODY_BYTES) {
      throw new HttpError(413, 'Request body too large.');
    }
    chunks.push(buffer);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new HttpError(400, 'Invalid JSON body.');
  }
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
