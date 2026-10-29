# InterestSeed 2.6.2 — 全局 Bug 修复

这一版修的是全局功能 bug 和浅深色适配，不是新功能。

## P0：桌面搜索入口恢复

旧 CSS 在 `641px` 以上隐藏了筛选按钮，同时筛选面板默认隐藏，导致桌面用户无法搜索。

现在：

- 桌面显示筛选按钮；
- 点击后显示筛选面板；
- 筛选项保持深色表面；
- 搜索覆盖标题、标签、来源、观察和“为什么留下”。

## P1：浅色宿主下实验弹窗对比度

实验弹窗是深色表面，但根文本继承了浅色宿主主题。

现在根节点和 modal content 都有深色文本 fallback。

## P1：浅色主题筛选输入框

输入框从白色改为深色：

```text
background: rgb(13, 22, 35)
color: rgb(219, 228, 242)
```

## 回归

```text
56 test files
471 tests passing
typecheck / lint / build passing
```

真实冒烟：

```text
steps: 9
page errors: 0
nodes: 18
edges: 23
pending: 0
experiment logs: 0
```

## 全局验证

```text
浅色宿主：主视图 / 搜索 / 实验 / 收件箱 / Spark / 概览 / 探索
深色宿主：主视图 / 搜索
窄栏：480px
视图：关系建议 / 节点详情 / 发现
```

截图与结果：

```text
review/bug-audit-2.6.2/
```

完整报告：

```text
review/2.6.2-global-bug-audit.md
```

AGPL-3.0-only.
