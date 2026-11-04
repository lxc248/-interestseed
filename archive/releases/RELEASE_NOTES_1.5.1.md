# InterestSeed 1.5.1 — 视觉层级与主行动优化

这一版不增加新功能，只让现有界面更容易读、更容易开始。

## 主界面

- 工具栏从 12 个入口收敛为 `记录 / 收件箱 / 更多`；
- `记录` 成为唯一主行动；
- 扫描、节点、撤销、发现、导出移入「更多」；
- 收件箱显示待判断数量；
- 主题轨改为「主题优先」，标签和数量更大。

## 火花弹窗

- 移除四步说明；
- 目标兴趣与“为什么留下”收进「更多选项」；
- `Ctrl/Cmd + Enter` 直接留下；
- 减少空白预览高度。

## 收件箱

- 一次只显示一条；
- 底部提示队列剩余数量；
- 处理完自动轮到下一条；
- 只是路过不写图谱。

## 视觉

- 最小可读字号提升；
- 次级文字对比度提高；
- 详情面板按钮从白色默认样式改为深色玻璃按钮；
- 主题轨、实验条、footer 的字号和间距统一；
- 分享弹窗与收件箱继续使用深色表面。

## 验证

```text
52 test files
460 tests passing
typecheck / lint / build passing
```

截图：

```text
review/sim-artifacts/19-simplified-main.png
review/sim-artifacts/20-simplified-spark.png
review/sim-artifacts/21-inbox-one-at-a-time.png
review/sim-artifacts/24-final-visual.png
```

AGPL-3.0-only.
