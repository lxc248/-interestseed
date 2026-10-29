# InterestSeed 1.7.2 — 先给熟悉的列表，再给专注卡片

这一版回应用户反馈：

> 不要一上来就要求用户学滑卡。

## 默认：标准收件箱列表

打开「分享收件箱」后，先看到熟悉的列表：

```text
2 待判断
[粘贴分享……] [放进来]

抖音 · 游戏：塞尔达为什么让我绕路
游戏 / 虚拟世界
[留下并连接] [只是路过]
```

这是 Observable、Obsidian、GitHub 用户都能立即理解的模式。

## 可选：专注一条

想一次只判断一张卡时，点：

```text
专注一条
```

才进入 Focus Deck：

```text
01 / 02
左滑路过 · 右滑留下
[只是路过] [留下并连接 →]
```

按钮：

```text
返回列表
```

## 设计原则

- 默认交互不要求学习新手势；
- 高级交互按需进入；
- 语言从英文实验词收回中文；
- 列表模式保留所有待判断项；
- 专注模式保留一屏一卡；
- 命令面板仍然可以进入收件箱。

## 实际验证

```text
默认打开：2 条列表
点「专注一条」：切换为 1 张卡片
显示 01 / 02
```

截图：

```text
review/sim-artifacts/51-inbox-list-conventional.png
review/sim-artifacts/50-inbox-focus-final.png
```

## 验证

```text
52 test files
460 tests passing
typecheck / lint / build passing
```

AGPL-3.0-only.
