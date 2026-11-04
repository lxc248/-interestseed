# InterestSeed 3.0.9 — 清空图谱确认

## 修复

```text
命令面板 → 清空兴趣图谱
之前：立即清空，没有确认
现在：先弹出确认，取消后节点和关系保持不变
```

抽出了 `confirmClearGraph()`，并补了自动回归：

```text
tests/ClearGraphConfirmation.test.ts
```

## 全功能模拟实验

```text
47 项功能路径
真实 Obsidian 桌面端
真实 Canvas / 文件 / 撤销 / 备份
截图：review/experiment-3.0.8/
报告：review/experiment-3.0.8.md
```

## 验证

```text
69 test files / 513 tests passing
MCP smoke 4/4
npm run verify 通过
```

AGPL-3.0-only. Author: aicoder.
