# InterestSeed 2.6.1 — 适配性收口

这一版处理窄分栏、窄窗口和模态框适配。

## 新增

### ≤360px：图标优先

- 隐藏 vault、count、subtitle、Agent CTA；
- 标题保持单行；
- 隐藏 NEXT / 实验条 / 启动横幅；
- quickbar 只保留图标，允许换行；
- 显示提示：

```text
面板较窄，拉宽分栏查看完整图谱。
```

### ≤300px：结构降级

- NEXT 和实验条完全隐藏；
- 画布保留最小高度；
- 快捷操作变成 2×2 图标栏；
- 页面无横向溢出。

## 验证

```text
480 宽：
body.scrollWidth = 480
heading subtitle = none
narrow hint = block
next step = none
quickbar = 100px
```

Share Inbox 模态框在 480 宽下约 450px，可用。

## 覆盖

```text
桌面主视图
820 窄桌面分栏
480 近手机宽度
深色发现面板
Share Inbox 模态框
```

截图：

```text
review/adapt-820.png
review/adapt-480-compact.png
review/adapt-480-modal.png
```

## 回归

```text
56 test files
471 tests passing
typecheck / lint / build passing
```

AGPL-3.0-only.
