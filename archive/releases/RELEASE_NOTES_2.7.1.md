# InterestSeed 2.7.1 — 分享卡继续打磨

在 2.7.0 的封面结构上，继续补三件事。

## 1. 真实关注主题上卡

分享卡底部新增：

```text
最近在关注 · theme8 · 创造 · 工具
```

不是通用口号，而是从当前图谱标签里算出来的真实信号。

## 2. 标签避让

星图标签现在会：

- 避开其他节点；
- 避开其他标签；
- 依次尝试右、左、上、下四个位置；
- 没有安全位置时宁可不显示，也不压住星图。

## 3. 大图预览

分享弹窗加宽，预览卡更高，打开就能看到完整钩子、数字和星图。

## 结果

```text
小红书 1080 × 1440
Instagram 1080 × 1350
X / 微博 1600 × 900
朋友圈 1080 × 1080
Story 1080 × 1920
```

## 验证

```text
56 test files
471 tests passing
typecheck / lint / build passing
```

五个平台全部 Canvas 导出成功。

资产：

```text
assets/share-card-xiaohongshu.png
assets/social-card.png
review/share-final-{xiaohongshu,instagram,x,wechat,story}.png
```

AGPL-3.0-only.
