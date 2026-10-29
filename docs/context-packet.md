# Context Packet、时间线与兴趣路线

InterestSeed 不追求连接更多平台，而是让同一条兴趣在不同入口里保持同一份上下文。

## Context Packet

收件箱的每条内容都是一个上下文包：

```text
source       分享 / 剪贴板 / Obsidian 笔记
sourceRef    来源路径，例如 P2/theme-b-two.md
text         标题与正文摘要
capturedAt   捕获时间
status       pending / kept / passed
```

来源标签可以点击，回到原始笔记。

## Interest Task State

节点不再只有“存在”或“不存在”，而有一条任务状态：

```text
captured       已捕获，还没有判断
judged         已判断，但还没有连接
connected      已经进入兴趣结构
experimenting  正在验证
reviewed       已经复盘
```

推断规则：

- 有 `experimenting` / `reviewed` 元数据时，以元数据为准；
- 有 `nextStep` 的节点视为验证中；
- 已连接但仍是 captured / judged 的节点提升为 connected；
- 其余为 captured。

## Observation Timeline

每个节点可以带一条只追加的时间线：

```text
observations: [
  {
    at,
    source,
    sourceRef,
    evidence,
    belief: stronger | weaker | changed
  }
]
```

它记录的是“这条兴趣怎么走到今天”，不是聊天记录。

## 兴趣路线 MOC

命令：

```text
生成兴趣路线笔记（Markdown MOC）
```

只有用户显式执行时才写入：

```text
InterestSeed/兴趣路线 - {theme} - {date}.md
```

内容包括：

- 正在验证；
- 验证中的线索；
- 已连接的线索；
- 等待判断；
- 最近观察；
- 下一步。

不会自动覆盖或修改已有笔记。

## MCP

协议：

```text
2026-07-28
```

资源：

```text
interestseed://graph
interestseed://experiment
interestseed://next
interestseed://context
```

Prompts：

```text
review-interest
plan-next-experiment
```

MCP 仍然只读。


## 上下文搜索

搜索覆盖：

`	ext
title
summary
why
raw
sourceRef
contextSourceRef
path
tags
observations[].evidence
`

支持多词 AND，例如：

`	ext
观察 今天
`

## 设计边界

- 不引入中心化账号；
- 不做积分；
- 不自动抓取平台；
- 不自动写图谱。
