import type { ChildProcessWithoutNullStreams } from 'node:child_process';

export type DshAgentStatus = 'starting' | 'ready' | 'working' | 'idle' | 'closed';

export interface DshPermissionOption {
  optionId: string;
  name: string;
  kind: string;
}

export interface DshPermissionRequest {
  requestId: string | number;
  sessionId: string;
  toolCallId?: string;
  title: string;
  kind: string;
  options: DshPermissionOption[];
}

export type DshAgentEvent =
  | { type: 'status'; status: DshAgentStatus; detail?: string }
  | { type: 'message'; text: string }
  | { type: 'thought'; text: string }
  | { type: 'tool'; id: string; title: string; kind: string; status: string }
  | { type: 'permission'; request: DshPermissionRequest }
  | { type: 'error'; message: string };

export interface DshAcpClientOptions {
  command: string;
  profile: string;
  cwd: string;
  /** e.g. deepseek-account/deepseek-flash. Empty means let DSH choose. */
  model?: string;
  env?: Record<string, string>;
  onEvent(event: DshAgentEvent): void;
}

interface PendingRequest {
  resolve(value: unknown): void;
  reject(error: Error): void;
  timer: ReturnType<typeof setTimeout>;
}

interface JsonRpcMessage {
  jsonrpc?: string;
  id?: string | number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code?: number; message?: string };
}

/**
 * Minimal ACP v1 client for DSH.
 *
 * DSH owns the agent and its tools; InterestSeed owns the conversation surface.
 * The process is spawned lazily and only from a desktop plugin runtime.
 */
export class DshAcpClient {
  private child: ChildProcessWithoutNullStreams | null = null;
  private nextId = 1;
  private readonly pending = new Map<string | number, PendingRequest>();
  private readonly pendingPermissions = new Map<string | number, DshPermissionRequest>();
  private sessionId: string | null = null;
  private buffer = '';
  private closed = false;

  constructor(private readonly options: DshAcpClientOptions) {}

  get isRunning(): boolean {
    return this.child !== null && !this.closed;
  }

  get currentSessionId(): string | null {
    return this.sessionId;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.options.onEvent({ type: 'status', status: 'starting', detail: '启动 DSH ACP…' });
    const { spawn } = await import('node:child_process');
    const child = spawn(this.options.command, ['--profile', this.options.profile], {
      cwd: this.options.cwd,
      env: {
        ...process.env,
        ...this.options.env,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      shell: process.platform === 'win32',
    }) as ChildProcessWithoutNullStreams;
    this.child = child;
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => this.consume(chunk));
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      const text = chunk.trim();
      if (text) this.options.onEvent({ type: 'status', status: 'working', detail: text.slice(0, 240) });
    });
    child.on('error', (error) => this.fail(error));
    child.on('exit', (code, signal) => {
      if (this.closed) return;
      this.fail(new Error(`DSH ACP exited (${code ?? signal ?? 'unknown'})`));
    });

    try {
      await this.request('initialize', {
        protocolVersion: 1,
        clientCapabilities: {},
      });
    } catch (error) {
      this.fail(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
    try {
      const session = await this.request('session/new', {
        cwd: this.options.cwd,
        mcpServers: [],
      });
      if (!isRecord(session) || typeof session.sessionId !== 'string') {
        throw new Error('DSH 未返回 sessionId');
      }
      this.sessionId = session.sessionId;
      await this.selectModel(session);
      this.options.onEvent({ type: 'status', status: 'ready', detail: 'DSH 会话已就绪' });
    } catch (error) {
      this.fail(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  private async selectModel(session: Record<string, unknown>): Promise<void> {
    const rawOptions = session.configOptions;
    if (!Array.isArray(rawOptions)) return;
    const modelConfig = rawOptions.find(
      (option) => isRecord(option) && option.id === 'model' && Array.isArray(option.options),
    );
    if (!isRecord(modelConfig) || !Array.isArray(modelConfig.options)) return;
    const choices: Array<{ value: string; label: string }> = [];
    for (const group of modelConfig.options) {
      if (!isRecord(group) || !Array.isArray(group.options)) continue;
      for (const option of group.options) {
        if (isRecord(option) && typeof option.value === 'string') {
          choices.push({
            value: option.value,
            label: typeof option.name === 'string' ? option.name : option.value,
          });
        }
      }
    }
    if (choices.length === 0) return;

    const preferred = this.options.model?.trim();
    const preferredValue = preferred
      ? choices.find((choice) => choice.value === JSON.stringify(preferred.split('/')))
      : undefined;
    const localValue = choices.find((choice) => choice.value.includes('wodebody'));
    const accountValue = choices.find((choice) => choice.value.includes('deepseek-account'));
    const chosen = preferredValue ?? localValue ?? accountValue ?? choices[0];
    if (!chosen) return;
    try {
      await this.request('session/set_config_option', {
        sessionId: this.sessionId,
        configId: 'model',
        value: chosen.value,
      });
      this.options.onEvent({
        type: 'status',
        status: 'ready',
        detail: `模型：${chosen.label}`,
      });
    } catch {
      // The server may not expose model control in older ACP builds; keep going.
    }
  }

  async prompt(text: string): Promise<string> {    if (!this.sessionId) await this.start();
    if (!this.sessionId) throw new Error('DSH 会话未就绪');
    this.options.onEvent({ type: 'status', status: 'working' });
    try {
      const result = await this.request('session/prompt', {
        sessionId: this.sessionId,
        prompt: [{ type: 'text', text }],
      }, 5 * 60_000);
      this.options.onEvent({ type: 'status', status: 'idle' });
      if (isRecord(result) && typeof result.stopReason === 'string') return result.stopReason;
      return 'end_turn';
    } catch (error) {
      this.options.onEvent({ type: 'status', status: 'idle' });
      throw error;
    }
  }

  async cancel(): Promise<void> {
    if (!this.sessionId) return;
    this.notify('session/cancel', { sessionId: this.sessionId });
  }

  respondPermission(requestId: string | number, optionId: string | null): void {
    if (!this.pendingPermissions.delete(requestId)) return;
    this.respond(requestId, optionId === null
      ? { outcome: { outcome: 'cancelled' } }
      : { outcome: { outcome: 'selected', optionId } });
  }

  async dispose(): Promise<void> {
    if (this.closed) return;
    const sessionId = this.sessionId;
    if (sessionId) {
      try {
        await this.request('session/close', { sessionId }, 2000);
      } catch {
        // best-effort
      }
    }
    this.closed = true;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error('DSH client closed'));
    }
    this.pending.clear();
    this.pendingPermissions.clear();
    this.child?.stdin.end();
    this.child?.kill();
    this.child = null;
    this.options.onEvent({ type: 'status', status: 'closed' });
  }

  private consume(chunk: string): void {
    this.buffer += chunk;
    for (;;) {
      const newline = this.buffer.indexOf('\n');
      if (newline < 0) break;
      const line = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);
      if (!line) continue;
      let message: JsonRpcMessage;
      try {
        message = JSON.parse(line) as JsonRpcMessage;
      } catch {
        this.options.onEvent({ type: 'error', message: `DSH 返回了非 JSON 数据：${line.slice(0, 120)}` });
        continue;
      }
      this.handle(message);
    }
  }

  private handle(message: JsonRpcMessage): void {
    if (message.method && message.id !== undefined && message.id !== null) {
      this.handleServerRequest(message);
      return;
    }
    if (message.method) {
      this.handleNotification(message);
      return;
    }
    if (message.id === undefined || message.id === null) return;
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    clearTimeout(pending.timer);
    if (message.error) {
      pending.reject(new Error(message.error.message ?? 'DSH JSON-RPC 请求失败'));
    } else {
      pending.resolve(message.result);
    }
  }

  private handleNotification(message: JsonRpcMessage): void {
    if (message.method !== 'session/update') return;
    const params = isRecord(message.params) ? message.params : {};
    const update = isRecord(params.update) ? params.update : {};
    const kind = typeof update.sessionUpdate === 'string' ? update.sessionUpdate : '';
    if (kind === 'agent_message_chunk') {
      const text = contentText(update.content);
      if (text) this.options.onEvent({ type: 'message', text });
      return;
    }
    if (kind === 'agent_thought_chunk') {
      const text = contentText(update.content);
      if (text) this.options.onEvent({ type: 'thought', text });
      return;
    }
    if (kind === 'tool_call' || kind === 'tool_call_update') {
      const tool = isRecord(update.toolCall) ? update.toolCall : update;
      const id = typeof tool.toolCallId === 'string' ? tool.toolCallId : 'tool';
      const title = typeof tool.title === 'string' ? tool.title : '工具调用';
      const toolKind = typeof tool.kind === 'string' ? tool.kind : 'other';
      const status = typeof tool.status === 'string' ? tool.status : 'pending';
      this.options.onEvent({ type: 'tool', id, title, kind: toolKind, status });
    }
  }

  private handleServerRequest(message: JsonRpcMessage): void {
    if (message.method !== 'session/request_permission') {
      this.respond(message.id!, { outcome: { outcome: 'cancelled' } });
      return;
    }
    const params = isRecord(message.params) ? message.params : {};
    const tool = isRecord(params.toolCall) ? params.toolCall : {};
    const rawOptions = Array.isArray(params.options) ? params.options : [];
    const options: DshPermissionOption[] = rawOptions
      .filter(isRecord)
      .map((option) => ({
        optionId: typeof option.optionId === 'string' ? option.optionId : '',
        name: typeof option.name === 'string' ? option.name : '允许',
        kind: typeof option.kind === 'string' ? option.kind : 'other',
      }))
      .filter((option) => option.optionId);
    const request: DshPermissionRequest = {
      requestId: message.id!,
      sessionId: typeof params.sessionId === 'string' ? params.sessionId : (this.sessionId ?? ''),
      toolCallId: typeof tool.toolCallId === 'string' ? tool.toolCallId : undefined,
      title: typeof tool.title === 'string' ? tool.title : 'DSH 请求权限',
      kind: typeof tool.kind === 'string' ? tool.kind : 'other',
      options,
    };
    this.pendingPermissions.set(message.id!, request);
    this.options.onEvent({ type: 'permission', request });
  }

  private request(method: string, params: unknown, timeoutMs = 30_000): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.child || this.closed) {
        reject(new Error('DSH ACP 连接未启动'));
        return;
      }
      const id = this.nextId++;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`DSH 请求超时：${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.send({ jsonrpc: '2.0', id, method, params });
    });
  }

  private notify(method: string, params: unknown): void {
    this.send({ jsonrpc: '2.0', method, params });
  }

  private respond(id: string | number, result: unknown): void {
    this.send({ jsonrpc: '2.0', id, result });
  }

  private send(message: JsonRpcMessage): void {
    if (!this.child || this.closed) throw new Error('DSH ACP 连接已关闭');
    this.child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  private fail(error: Error): void {
    if (this.closed) return;
    this.closed = true;
    this.child?.kill();
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
    this.options.onEvent({ type: 'error', message: error.message });
    this.options.onEvent({ type: 'status', status: 'closed' });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function contentText(value: unknown): string {
  if (!isRecord(value)) return '';
  return value.type === 'text' && typeof value.text === 'string' ? value.text : '';
}
