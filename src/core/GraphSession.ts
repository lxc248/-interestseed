import type {
  InterestSeedEdge,
  InterestSeedGraph,
  InterestSeedNode,
} from '../types/graph';
import { GraphStoreError } from './GraphStore';
import type { InterestSeedGraphStore } from './GraphStore';
import type { UndoManager } from './UndoManager';

/**
 * 所有对“当前图谱”的用户编辑都必须经过这里：
 * - 每次只记录最近一次编辑的 apply / revert；
 * - 删除节点会连同关联关系一起恢复；
 * - 确认 / 拒绝候选关系会回退到原状态；
 * - `apply()` 用于重新扫描等系统操作，不进入撤销历史。
 */
export class GraphSession {
  constructor(
    private readonly store: InterestSeedGraphStore,
    private readonly undo: UndoManager,
  ) {}

  getGraph(): InterestSeedGraph {
    return this.store.getGraph();
  }

  getNode(id: string): InterestSeedNode | undefined {
    return this.store.getNode(id);
  }

  validate(): string[] {
    return this.store.validate();
  }

  addNode(node: InterestSeedNode, label = `新建节点「${node.title}」`): void {
    this.undo.execute(
      label,
      () => {
        this.store.addNode(node);
      },
      () => {
        this.store.removeNode(node.id);
      },
    );
  }

  updateNode(
    id: string,
    patch: Partial<InterestSeedNode>,
    label = '修改节点',
  ): void {
    const before = this.requireNode(id);
    const patchCopy: Partial<InterestSeedNode> = { ...patch };

    this.undo.execute(
      label,
      () => {
        this.store.updateNode(id, patchCopy);
      },
      () => {
        this.store.updateNode(id, {
          title: before.title,
          type: before.type,
          tags: [...before.tags],
          metadata: { ...before.metadata },
          sourceUri: before.sourceUri ?? '',
        });
      },
    );
  }

  removeNode(id: string, label = '删除节点'): void {
    const node = this.requireNode(id);
    const incident = this.store
      .listEdges()
      .filter((edge) => edge.source === id || edge.target === id)
      .map((edge) => ({ ...edge }));
    const source = { ...node };

    this.undo.execute(
      label,
      () => {
        this.store.removeNode(id);
      },
      () => {
        this.store.addNode(source);
        for (const edge of incident) {
          try {
            this.store.addEdge(edge);
          } catch {
            // 端点已失效的关系无法恢复。
          }
        }
      },
    );
  }

  addEdge(edge: InterestSeedEdge, label = `新建关系「${edge.relation}」`): void {
    if (this.store.findEdge(edge.source, edge.target, edge.relation)) {
      throw new GraphStoreError('duplicate-edge', '关系已存在，不能重复新增');
    }

    let createdId = edge.id;
    this.undo.execute(
      label,
      () => {
        createdId = this.store.addEdge(edge).id;
      },
      () => {
        this.store.removeEdge(createdId);
      },
    );
  }

  updateEdge(
    id: string,
    patch: Partial<InterestSeedEdge>,
    label = '修改关系',
  ): void {
    const before = this.store.getEdge(id);
    if (!before) throw new GraphStoreError('invalid-edge', `关系不存在：${id}`);

    const patchCopy: Partial<InterestSeedEdge> = { ...patch };

    this.undo.execute(
      label,
      () => {
        this.store.updateEdge(id, patchCopy);
      },
      () => {
        // 用“删除 + 按原值新增”恢复全部字段（含可选字段的清除）。
        this.store.removeEdge(id);
        this.store.addEdge({ ...before });
      },
    );
  }

  removeEdge(id: string, label = '删除关系'): void {
    const edge = this.store.getEdge(id);
    if (!edge) throw new GraphStoreError('invalid-edge', `关系不存在：${id}`);

    const snapshot = { ...edge };
    this.undo.execute(
      label,
      () => {
        this.store.removeEdge(id);
      },
      () => {
        this.store.addEdge(snapshot);
      },
    );
  }

  /** 将已拒绝关系恢复为待确认建议，保留关系 ID 与其他字段。 */
  restoreEdge(id: string, label = '恢复关系为建议'): void {
    const edge = this.store.getEdge(id);
    if (!edge) throw new GraphStoreError('invalid-edge', `关系不存在：${id}`);
    if (edge.status !== 'rejected') {
      throw new GraphStoreError('invalid-edge', '只有已拒绝的关系可以恢复为建议');
    }

    this.undo.execute(
      label,
      () => {
        this.store.updateEdge(id, { status: 'suggested' });
      },
      () => {
        this.store.updateEdge(id, { status: 'rejected' });
      },
    );
  }

  /** 用户动作（如清空图谱）的整体替换，可撤销。 */
  replace(graph: InterestSeedGraph, label: string): void {
    const before = this.store.getGraph();
    this.undo.execute(
      label,
      () => {
        this.store.replace(graph);
      },
      () => {
        this.store.replace(before);
      },
    );
  }

  /** 重新扫描 / 刷新建议等系统操作：更新图谱但不写入撤销历史。 */
  apply(graph: InterestSeedGraph): void {
    this.store.replace(graph);
  }

  private requireNode(id: string): InterestSeedNode {
    const node = this.store.getNode(id);
    if (!node) throw new GraphStoreError('missing-node', `节点不存在：${id}`);
    return node;
  }
}
