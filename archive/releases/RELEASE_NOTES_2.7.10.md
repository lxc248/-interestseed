# InterestSeed 2.7.10 — 学习 Solid/Fastify 的性能原则

从 `solidjs/solid` 和 `fastify/fastify` 两个高星项目学习，并落地最小实现。

## Solid：derived state 缓存

```text
src/core/GraphStore.ts
```

`stats()` 以 `updatedAt:revision` 为键缓存，只在图谱变更后重算。

## Fastify：避免重复请求工作

```text
mcp/server.mjs
```

图谱读取按 `mtime` 缓存，文件不变不重复读盘解析。

## 报告

```text
review/2.7.10-solid-fastify-study.md
```

## Verification

```text
57 test files
472 tests passing
typecheck / lint / build passing
```

AGPL-3.0-only.
