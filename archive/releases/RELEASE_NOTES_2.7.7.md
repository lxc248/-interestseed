# InterestSeed 2.7.7 — JSON Canvas 导出

从 `kepano/obsidian-skills` 的 `json-canvas` 规范学习并落地。

## 新命令

```text
导出 JSON Canvas（Obsidian Canvas）
```

## 行为

- 把当前兴趣图谱导出为符合 JSON Canvas 1.0 的 `.canvas` 文件；
- 节点为文本卡，包含标题、类型、任务状态、标签；
- 边包含关系标签与可解析的 `fromNode` / `toNode`；
- 导出路径：

```text
InterestSeed/兴趣图谱-<日期>.canvas
```

- 同名文件自动递增，不覆盖已有画布；
- 导出后自动在 Obsidian 中打开。

## 测试

```text
57 test files
472 tests passing
```

实际验证：

```text
path: InterestSeed/兴趣图谱-2026-10-30.canvas
nodes: 18
edges: 23
```

## 报告

```text
review/2.7.7-skill-practice.md
```

AGPL-3.0-only.
