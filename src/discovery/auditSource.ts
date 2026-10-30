import { DISCOVERY_SCHEMA_VERSION } from './types';
import type { AuditVaultBinding } from './auditBinding';
import {
  projectDiscoveryAuditRecord,
  type DiscoveryAuditProjection,
  type DiscoveryAuditProjectionSet,
} from './audit';

const integrityStates = new WeakSet<object>();
const runtimeSessions = new WeakSet<object>();

export interface AuditRuntimeState {
  blocked: boolean;
  issues: readonly string[];
  queuePending: boolean;
  queueFailed: boolean;
  queueClosed: boolean;
  memoryMatchesPersisted: boolean;
  /** 插件已注册精确 primary 数据源；不代表已经完成磁盘内容验证。 */
  sourceRegistered: boolean;
}

function validRuntimeState(state: AuditRuntimeState): boolean {
  return (
    typeof state.blocked === 'boolean' &&
    Array.isArray(state.issues) &&
    typeof state.queuePending === 'boolean' &&
    typeof state.queueFailed === 'boolean' &&
    typeof state.queueClosed === 'boolean' &&
    typeof state.memoryMatchesPersisted === 'boolean' &&
    typeof state.sourceRegistered === 'boolean'
  );
}

/**
 * 完整性快照只能由受控 AuditRuntimeSession 创建。
 * 它不是授权凭证，只表达某一刻的运行时状态。
 */
export class AuditIntegritySnapshot {
  private constructor(private readonly state: AuditRuntimeState) {
    integrityStates.add(this);
  }

  get isSafe(): boolean {
    return (
      integrityStates.has(this) &&
      !this.state.blocked &&
      this.state.issues.length === 0 &&
      !this.state.queuePending &&
      !this.state.queueFailed &&
      !this.state.queueClosed &&
      this.state.memoryMatchesPersisted &&
      this.state.sourceRegistered
    );
  }

  get blocked(): boolean {
    return this.state.blocked;
  }

  get stateForDiagnostics(): AuditRuntimeState {
    return { ...this.state, issues: [...this.state.issues] };
  }

  /**
   * 只应由 AuditRuntimeSession.snapshot() 调用。
   * 这个入口不接受独立 runtimeState 回调，也不参与审计执行。
   */
  static createControlled(state: AuditRuntimeState): AuditIntegritySnapshot {
    if (!validRuntimeState(state)) throw new Error('完整性快照无效');
    return new AuditIntegritySnapshot({ ...state, issues: [...state.issues] });
  }
}

/**
 * 插件运行时持有的审计会话。
 * 调用方只能拿到会话，不直接注入快照/runtimeState 两个独立声明。
 */
export class AuditRuntimeSession {
  private active = true;

  private constructor(private readonly probe: () => AuditRuntimeState) {
    runtimeSessions.add(this);
  }

  static fromLiveRuntime(probe: () => AuditRuntimeState): AuditRuntimeSession {
    return new AuditRuntimeSession(probe);
  }

  get isActive(): boolean {
    return this.active && runtimeSessions.has(this);
  }

  invalidate(): void {
    this.active = false;
  }

  readState(): AuditRuntimeState {
    if (!this.isActive) {
      throw new Error('运行时审计会话已失效');
    }
    const state = this.probe();
    if (!validRuntimeState(state)) {
      throw new Error('运行时状态无效');
    }
    return { ...state, issues: [...state.issues] };
  }

  snapshot(): AuditIntegritySnapshot {
    return AuditIntegritySnapshot.createControlled(this.readState());
  }
}

export interface DiscoveryAuditReadOnlyAdapter {
  readonly binding: AuditVaultBinding;
  readExact(key: string): Promise<string | null>;
}

export const AUDIT_DISCOVERY_KEY = 'discoveries.json';

export type DiscoveryAuditSourceErrorCode =
  | 'blocked'
  | 'incomplete'
  | 'missing'
  | 'corrupt'
  | 'unsupported-schema'
  | 'cancelled'
  | 'context-invalid';

export type DiscoveryAuditSourceResult =
  | { ok: true; projection: DiscoveryAuditProjectionSet }
  | {
      ok: false;
      code: DiscoveryAuditSourceErrorCode;
      message: string;
    };

export interface DiscoveryAuditSourceOptions {
  key?: string;
  signal?: AbortSignal;
}

function isRuntimeStateSafe(state: AuditRuntimeState): boolean {
  return (
    !state.blocked &&
    state.issues.length === 0 &&
    !state.queuePending &&
    !state.queueFailed &&
    !state.queueClosed &&
    state.memoryMatchesPersisted &&
    state.sourceRegistered
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cancelled(signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true;
}

/**
 * 纯只读审计数据源。
 *
 * 不访问 Vault、不读取 Markdown，也不调用 DiscoveryRepository.loadDetailed。
 * 没有写方法；不接受裸 vaultId，只接受受控 binding + 必填完整性快照。
 */
export async function loadDiscoveryAuditSource(
  adapter: DiscoveryAuditReadOnlyAdapter,
  binding: AuditVaultBinding,
  session: AuditRuntimeSession,
  options: DiscoveryAuditSourceOptions = {},
): Promise<DiscoveryAuditSourceResult> {
  if (!binding || !binding.isActive) {
    return {
      ok: false,
      code: 'context-invalid',
      message: '当前审计上下文已失效，拒绝审计',
    };
  }
  if (!adapter || adapter.binding !== binding) {
    return {
      ok: false,
      code: 'context-invalid',
      message: '数据源与当前 Vault 绑定不一致，拒绝审计',
    };
  }
  if (!(session instanceof AuditRuntimeSession) || !session.isActive) {
    return {
      ok: false,
      code: 'incomplete',
      message: '缺少有效的审计运行时会话，拒绝审计',
    };
  }

  let observed: AuditRuntimeState;
  try {
    observed = session.readState();
  } catch {
    return {
      ok: false,
      code: 'incomplete',
      message: '无法读取当前运行时状态，拒绝审计',
    };
  }
  if (!isRuntimeStateSafe(observed)) {
    return {
      ok: false,
      code: observed.blocked ? 'blocked' : 'incomplete',
      message: observed.blocked
        ? '发现数据源处于阻塞状态，拒绝审计'
        : '当前运行时状态不满足审计条件，拒绝审计',
    };
  }
  if (cancelled(options.signal)) {
    return {
      ok: false,
      code: 'cancelled',
      message: '审计已取消',
    };
  }

  let raw: string | null;
  try {
    raw = await adapter.readExact(options.key ?? AUDIT_DISCOVERY_KEY);
  } catch {
    return {
      ok: false,
      code: 'blocked',
      message: '发现数据读取失败，拒绝审计',
    };
  }

  if (cancelled(options.signal)) {
    return {
      ok: false,
      code: 'cancelled',
      message: '审计已取消',
    };
  }

  try {
    observed = session.readState();
  } catch {
    return {
      ok: false,
      code: 'incomplete',
      message: '读取后无法确认运行时状态，拒绝审计',
    };
  }
  if (!isRuntimeStateSafe(observed)) {
    return {
      ok: false,
      code: 'incomplete',
      message: '读取后运行时状态不一致，拒绝审计',
    };
  }

  if (raw === null || raw.trim() === '') {
    return {
      ok: false,
      code: 'missing',
      message: '未找到发现数据，拒绝生成空审计',
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.replace(/^\uFEFF/, ""));
  } catch {
    return {
      ok: false,
      code: 'corrupt',
      message: '发现数据不是合法 JSON，拒绝审计',
    };
  }

  if (!isRecord(parsed)) {
    return {
      ok: false,
      code: 'corrupt',
      message: '发现数据结构无效，拒绝审计',
    };
  }
  if (
    typeof parsed.discoverySchemaVersion !== 'number' ||
    parsed.discoverySchemaVersion < 1 ||
    parsed.discoverySchemaVersion > DISCOVERY_SCHEMA_VERSION
  ) {
    return {
      ok: false,
      code: 'unsupported-schema',
      message: '发现数据 Schema 版本不受支持，拒绝审计',
    };
  }
  if (!Array.isArray(parsed.discoveries)) {
    return {
      ok: false,
      code: 'corrupt',
      message: '发现记录列表无效，拒绝审计',
    };
  }

  const records: DiscoveryAuditProjection[] = [];
  let invalidRecordCount = 0;
  for (const item of parsed.discoveries) {
    if (cancelled(options.signal)) {
      return {
        ok: false,
        code: 'cancelled',
        message: '审计已取消',
      };
    }
    const record = projectDiscoveryAuditRecord(item);
    if (record) records.push(record);
    else invalidRecordCount += 1;
  }

  if (invalidRecordCount > 0) {
    return {
      ok: false,
      code: 'incomplete',
      message: '发现数据包含无效记录，拒绝生成正常审计',
    };
  }

  try {
    observed = session.readState();
  } catch {
    return {
      ok: false,
      code: 'incomplete',
      message: '投影后无法确认运行时状态，拒绝审计',
    };
  }
  if (!isRuntimeStateSafe(observed)) {
    return {
      ok: false,
      code: 'incomplete',
      message: '投影后运行时状态不一致，拒绝审计',
    };
  }

  return {
    ok: true,
    projection: {
      records,
      inputCount: parsed.discoveries.length,
      invalidRecordCount,
    },
  };
}
