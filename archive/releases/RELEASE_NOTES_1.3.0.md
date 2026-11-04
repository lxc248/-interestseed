# InterestSeed 1.3.0 — 把星图发出去

**你的兴趣星图不只是一张 Obsidian 页面。它可以变成一张适合小红书、Instagram、X、朋友圈和 Story 的 PNG。**

## 新增：社交分享卡片

工具栏新增「导出分享星图」，命令面板新增：

```text
InterestSeed: 导出分享星图（社交平台 PNG）
```

平台预设：

| 平台 | 尺寸 | 比例 |
| --- | --- | --- |
| 小红书 | 1080 × 1440 | 3:4 |
| Instagram | 1080 × 1350 | 4:5 |
| X / 微博 | 1600 × 900 | 16:9 |
| 微信朋友圈 | 1080 × 1080 | 1:1 |
| Story | 1080 × 1920 | 9:16 |

每张卡片：

- 重新排版，不包含 Obsidian UI；
- 中心星核 + 主题行星 + 金色关系线；
- 自动压缩标题并跳过重叠标签；
- 显示节点数、关系数；
- 底部带 `InterestSeed` 来源标识和平台比例；
- 纯 Canvas 绘制，不使用外链图片，导出不会被画布安全策略阻断。

操作：

```text
下载 PNG
复制图片
系统分享（支持的设备）
```

## 文件输出

```text
interestseed-star-map-xiaohongshu-1080x1440.png
interestseed-star-map-x-1600x900.png
...
```

## 验证

```text
51 test files
455 tests passing
typecheck / lint / build passing
```

实际导出：

```text
1080 × 1440 PNG
1600 × 900 PNG
1080 × 1350 PNG
```

## 设计边界

- 不把 Obsidian 界面截图直接当分享图；
- 不加上用户没有提供的个人隐私；
- 不调用外部图片或字体服务；
- 不抓取平台内容；
- 分享卡片只使用本地图谱数据。

## 安装

```text
<your-vault>/.obsidian/plugins/interestseed/
```

AGPL-3.0-only.
