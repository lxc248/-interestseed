# Context Packet 与 Interest Task State

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

## 数据兼容

- 旧图谱没有 `taskState` 时自动推断；
- 不修改旧节点，不强制迁移；
- MCP 只读输出 `taskState` 与来源字段。

## 设计边界

- 不引入中心化账号；
- 不做积分；
- 不自动抓取平台；
- 不自动写图谱。
