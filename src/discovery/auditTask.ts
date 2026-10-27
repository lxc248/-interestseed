/**
 * 最小审计任务代次/取消控制。
 * 不负责 UI，也不发布结果；调用方在发布前必须检查 isCurrent。
 */
export interface AuditTaskToken {
  readonly generation: number;
  readonly signal: AbortSignal;
}

export class AuditTaskCoordinator {
  private generation = 0;
  private controller: AbortController | null = null;
  private closed = false;

  begin(): AuditTaskToken | null {
    if (this.closed) return null;
    this.controller?.abort();
    this.generation += 1;
    const controller = new AbortController();
    this.controller = controller;
    return { generation: this.generation, signal: controller.signal };
  }

  isCurrent(token: AuditTaskToken): boolean {
    return (
      !this.closed &&
      token.generation === this.generation &&
      !token.signal.aborted
    );
  }

  cancel(): void {
    this.generation += 1;
    this.controller?.abort();
    this.controller = null;
  }

  invalidate(): void {
    this.closed = true;
    this.cancel();
  }

  finish(token: AuditTaskToken): void {
    if (token.generation === this.generation) {
      this.controller = null;
    }
  }

  get isClosed(): boolean {
    return this.closed;
  }
}
