# InterestSeed 2.7.6 — 性能实践

从 GitHub `performance` 高星仓库学习并落地两项热路径优化。

## 1. 搜索字段索引缓存

```text
src/ui/FilterBar.ts
```

- 预计算 `NodeSearchIndex { path, searchable }`；
- 以 `graph.updatedAt + node.id` 为键缓存；
- 缓存上限 2048；
- 搜索输入不再重复拼接节点字段。

## 2. MCP 图谱读取缓存

```text
mcp/server.mjs
```

- 记录图谱文件 `mtimeMs`；
- mtime 不变时复用内存中的解析结果；
- 文件变化自动失效。

## 报告

```text
review/2.7.6-performance.md
```

## Verification

```text
56 test files
471 tests passing
typecheck / lint / build passing
```

AGPL-3.0-only.
