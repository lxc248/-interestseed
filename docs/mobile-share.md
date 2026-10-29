# 移动端分享入口

InterestSeed 1.2 增加了两条移动端入口。它们都不抓取抖音/小红书页面内容，只处理用户主动分享的文本。

## 1. Obsidian URI（推荐给 iOS 快捷指令 / Android 分享动作）

把分享文本 URL 编码后打开：

```text
obsidian://interestseed-share?text=<URL-encoded share text>
```

例如分享内容：

```text
美妆：早八底妆不卡粉的三个步骤
https://www.douyin.com/video/...
```

快捷指令只需要：

```text
接收分享输入
→ URL 编码
→ 打开 URL: obsidian://interestseed-share?text=...
```

InterestSeed 会打开同一个分享判断卡，用户仍然要自己点“留下这个火花”。

## 2. 剪贴板入口

复制分享文本后，在 Obsidian 命令面板执行：

```text
InterestSeed: 从剪贴板记录分享（移动端快捷指令）
```

它等同于把剪贴板内容粘贴进分享判断卡。

## 边界

- 不读取私密收藏；
- 不调用平台私有接口；
- 不伪造视频字幕或内容摘要；
- 没有真实正文时，只根据用户分享文本做确定性分析；
- 所有写入仍然需要用户确认。
