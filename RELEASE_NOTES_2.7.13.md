# InterestSeed 2.7.13 — Node 工程化优化

学习 `goldbergyoni/nodebestpractices` 后落地。

## 变更

```text
- MCP 错误集中处理：客户端稳定提示，细节写 stderr
- SIGINT / SIGTERM 优雅退出
- stdin error / uncaughtException / unhandledRejection 兜底
```

## 报告

```text
review/2.7.13-nodebestpractices.md
```

## Verification

```text
node --check mcp/server.mjs：通过
MCP initialize + tools/call：通过
57 test files / 472 tests passing
```

AGPL-3.0-only.
