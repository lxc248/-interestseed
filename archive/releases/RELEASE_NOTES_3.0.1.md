# InterestSeed 3.0.1 — 质量与 CI 补强

## 新增

```text
.github/workflows/ci.yml
  → push / PR 自动跑 npm run verify

mcp/smoke.test.mjs
  → initialize + tools/call + 错误不泄露路径
```

## 修复

```text
mcp/server.mjs
  → 客户端最后一行没有换行符时，行尾消息不再丢失
```

## 打分

```text
修复前：78 / 100
修复后：86 / 100
详见 review/3.0.1-scorecard.md
```

## Verification

```text
57 test files / 472 tests passing
MCP smoke tests 2/2 passing
```

AGPL-3.0-only. Author: aicoder.
