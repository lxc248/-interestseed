export interface UndoCommand {
  label: string;
  apply(): void;
  revert(): void;
}

/** 撤销管理器契约。 */
export interface UndoManager {
  execute(label: string, apply: () => void, revert: () => void): void;

  undo(): boolean;

  canUndo(): boolean;

  clear(): void;
}

export interface UndoHistoryOptions {
  maxDepth?: number;
  onError?: (error: unknown, command: UndoCommand) => void;
}

export interface UndoState {
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string | null;
  redoLabel: string | null;
  depth: number;
}

/**
 * 基于命令的撤销历史。
 *
 * - 只记录显式传入的 apply / revert，不触碰用户原始笔记；
 * - 每次 undo 只回退最近一条命令；
 * - 重新扫描等系统操作不应调用 execute，从而不会清空或污染历史。
 */
export class UndoHistory implements UndoManager {
  private undoStack: UndoCommand[] = [];
  private redoStack: UndoCommand[] = [];
  private readonly maxDepth: number;
  private readonly listeners = new Set<() => void>();
  private readonly onError: (error: unknown, command: UndoCommand) => void;

  constructor(options: UndoHistoryOptions = {}) {
    this.maxDepth = Math.max(1, Math.floor(options.maxDepth ?? 50));
    this.onError =
      options.onError ??
      ((error) => {
        console.error('[InterestSeed] 撤销命令执行失败', error);
      });
  }

  execute(label: string, apply: () => void, revert: () => void): void {
    apply();
    this.push({ label, apply, revert });
  }

  undo(): boolean {
    const command = this.undoStack.pop();
    if (!command) return false;

    try {
      command.revert();
    } catch (error) {
      // 引用已失效的命令不能再放回栈顶，否则会永久阻塞后续撤销。
      this.onError(error, command);
      this.notify();
      return false;
    }

    this.redoStack.push(command);
    this.notify();
    return true;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  clear(): void {
    if (this.undoStack.length === 0 && this.redoStack.length === 0) return;
    this.undoStack = [];
    this.redoStack = [];
    this.notify();
  }

  // ------------------------------------------------------------ 扩展能力

  redo(): boolean {
    const command = this.redoStack.pop();
    if (!command) return false;

    try {
      command.apply();
    } catch (error) {
      // 同理：失效的 redo 命令不能反复卡住栈顶。
      this.onError(error, command);
      this.notify();
      return false;
    }

    this.undoStack.push(command);
    this.trim();
    this.notify();
    return true;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  undoLabel(): string | null {
    return this.undoStack.at(-1)?.label ?? null;
  }

  redoLabel(): string | null {
    return this.redoStack.at(-1)?.label ?? null;
  }

  depth(): number {
    return this.undoStack.length;
  }

  getState(): UndoState {
    return {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      undoLabel: this.undoLabel(),
      redoLabel: this.redoLabel(),
      depth: this.depth(),
    };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private push(command: UndoCommand): void {
    this.undoStack.push(command);
    this.trim();
    this.redoStack = [];
    this.notify();
  }

  private trim(): void {
    while (this.undoStack.length > this.maxDepth) this.undoStack.shift();
  }

  private notify(): void {
    for (const listener of [...this.listeners]) {
      try {
        listener();
      } catch (error) {
        console.error('[InterestSeed] 撤销状态监听器执行失败', error);
      }
    }
  }
}
