# 社交分享卡片

InterestSeed 可以把当前图谱导出为平台尺寸的 PNG，而不是直接截 Obsidian 界面。新版分享卡先给钩子，再给数字，最后给星图证据。

## 平台与尺寸

| 平台 | 文件 |
| --- | --- |
| 小红书 | `interestseed-star-map-xiaohongshu-1080x1440.png` |
| Instagram | `interestseed-star-map-instagram-1080x1350.png` |
| X / 微博 | `interestseed-star-map-x-1600x900.png` |
| 微信朋友圈 | `interestseed-star-map-wechat-1080x1080.png` |
| Story | `interestseed-star-map-story-1080x1920.png` |

## 兼容性

- PNG，主流社交平台均可上传；
- 无外链字体和图片，Canvas 不会被 taint；
- 竖版使用 3:4 / 4:5 / 9:16，横版使用 16:9；
- 标题与标签有安全边距，避免被平台裁切；
- 标签自动避让节点，避免文字压住星图；
- 密集图只标注关键节点，避免社交图片变成不可读的标签墙；
- 首屏包含钩子、三个证据数字和底部三步闭环；
- 下载、复制图片、系统分享三条路径按环境降级。

## 使用

1. 打开兴趣图谱；
2. 点击工具栏「导出分享星图」；
3. 选择平台；
4. 下载 PNG / 复制图片 / 复制文案 / 系统分享。

命令面板：

```text
InterestSeed: 导出分享星图（社交平台 PNG）
```
