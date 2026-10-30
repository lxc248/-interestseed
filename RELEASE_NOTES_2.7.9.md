# InterestSeed 2.7.9 — 性能优化（画布与渲染）

继续沿 performance 方向优化热路径。

## 1. Canvas 帧预算减半

```text
src/ui/CosmicGraphCanvas.ts
```

动画时间按显示频率推进，`draw()` 每两帧执行一次。

## 2. refresh 复用图谱

```text
src/ui/InterestSeedView.ts
```

`refresh()` 把同一份图传给 `renderNextStep(graph)`，避免同一帧重复克隆图谱。

## 报告

```text
review/2.7.9-performance-canvas.md
```

## Verification

```text
57 test files
472 tests passing
typecheck / lint / build passing
```

AGPL-3.0-only.
