# InterestSeed 2.7.3 — 密集图谱可读性

## 问题

图谱一旦有十几个节点，标签会变成“标签墙”：

- 相似节点如 `Discovery Audit` 反复出现；
- 每个节点都抢注意力；
- 轨道标签和节点标签互相竞争；
- 真正的结构反而看不清。

## 修复

### 1. 密集图按重要度显示标签

密集图不再显示全部标签，而是按度数优先：

```text
selected / hovered 永远显示
高连接度节点优先
最多 12 个标签
```

### 2. 密集图标签稍大

```text
密集图标签：9px → 10px
最大宽度：106px → 118px
```

少量标签变清楚，而不是全量标签变噪声。

### 3. 轨道标签让位

节点数大于 10 时，画布上的通用轨道标签默认隐藏；轨道信息仍由右侧“主题簇 / 其他轨道”承载。

## 视觉验证

在 disposable Vault 的 18 节点真实图上验证：

```text
节点数: 18
zoom: 1.08
画布轨道标签: 隐藏
标签数量: 12 以内
```

截图：

```text
review/dense-graph-273.png
```

## 回归

```text
56 test files
471 tests passing
typecheck / lint / build passing
```

AGPL-3.0-only.
