# InterestSeed 2.7.2 — 稀疏图谱可读性

## 问题

真实 Vault 常常刚起步：只有 4 个节点、1 条关系。

旧版在这种稀疏状态下会出现：

- 节点偏小，画布显得空；
- 标签字号 9px，在 4K / 高分屏上读不清；
- 少数标签因为碰撞规则被隐藏；
- 用户第一眼看到的是“还没长大的空图”。

## 修复

### 1. 按节点数动态放大

```text
≤10 节点：节点放大 1.35×
≤20 节点：节点放大 1.12×
>20 节点：维持原尺寸，避免拥挤
```

### 2. 稀疏图标签更清楚

```text
标签字号：9px → 11px
标签最大宽度：106px → 132px
显示阈值：zoom 0.52 → 0.36
```

### 3. 稀疏图不隐藏标签

密集图谱继续用碰撞规则隐藏次要标签；稀疏图谱保留全部标签，让 4 个节点的第一屏仍然有信息。

## 视觉验证

在 disposable Vault 用 4 节点 / 1 边的模拟图验证：

```text
节点半径放大
标签 11px
画布不再显得空
```

截图：

```text
review/sparse-graph-271.png
review/sparse-graph-271-final.png
```

## 回归

```text
56 test files
471 tests passing
typecheck / lint / build passing
```

AGPL-3.0-only.
