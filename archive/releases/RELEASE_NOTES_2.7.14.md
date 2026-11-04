# InterestSeed 2.7.14 — 项目特点与学习落点

## 新增文档

```text
docs/project-characteristics.md
```

把项目五个特点与每轮学习内容一一对应。

## 代码

```text
mcp/server.mjs
```

- 工具调用错误也走集中处理 `toolFail`，细节只写 stderr。

## Verification

```text
57 test files / 472 tests passing
node --check mcp/server.mjs：通过
```

AGPL-3.0-only.
