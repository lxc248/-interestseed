# InterestSeed 2.7.0 — 分享卡重做

这一版把“分享星图”从一张好看的图，改成一张**会被看完的封面**。

## 新的分享卡

首屏先给钩子，不先给图：

```text
18 个兴趣
我先验证 1 个
```

下面才是证据：

```text
18 个兴趣
14 条确认关系
3 天真实行动
```

再下面是星图本身，最后给出完整闭环：

```text
01 收藏 → 02 验证 → 03 决定
```

## 五平台适配

```text
小红书 1080 × 1440
Instagram 1080 × 1350
X / 微博 1600 × 900
朋友圈 1080 × 1080
Story 1080 × 1920
```

横版重新排成左右双栏，不再缩放竖版。

## 视觉

- 深色夜空 + 金色证据线；
- 大字号钩子，手机缩略图也能读；
- 数量卡突出“兴趣 / 关系 / 3 天”；
- 星图节点只保留高价值标签；
- 标签自动避让节点，避免文字压住星图；
- 底部三步条明确产品闭环；
- 所有图片由本地 Canvas 绘制，无外链素材。

## 文案

分享文案从：

```text
我的兴趣星图：18 个节点，23 条关系。
```

改为：

```text
我把 18 个兴趣，先验证 1 个。
星图：18 个节点，23 条关系。
最近在关注：theme8、创造、工具、观察。
#InterestSeed #兴趣验证 #自我探索
```

## 预览

分享弹窗加宽，预览更高，先看到卡片，再操作下载。

## 验证

```text
56 test files
471 tests passing
typecheck / lint / build passing
```

五个平台全部实际 Canvas 导出通过。

## 资产

```text
assets/share-card-xiaohongshu.png
assets/social-card.png
review/share-final-xiaohongshu.png
review/share-final-instagram.png
review/share-final-x.png
review/share-final-wechat.png
review/share-final-story.png
```

AGPL-3.0-only.
