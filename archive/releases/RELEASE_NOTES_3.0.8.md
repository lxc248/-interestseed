# InterestSeed 3.0.8 — 代码结构优化

## 重构

```text
compareText 6 处 → utils/text.ts
clamp / hash → utils/math.ts
节点调色板 2 处 → ui/nodeStyle.ts
分享主题统计 2 处 → shareTopics()
isVideoSpark / describeSpark → services/shareAnalysis.ts
```

## 结果

```text
68 test files / 511 tests passing
总行覆盖 74.74%
UI 43.81%
core 92.25%
services 84.89%
utils 78.52%
```

纯重构：不改变持久化格式、ID 语义和用户路径。

## 报告

```text
review/3.0.8-code-structure-audit.md
```

AGPL-3.0-only. Author: aicoder.
