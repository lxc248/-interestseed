# GitHub 高星对标与 InterestSeed 缺口 · 2026-10-29

> 本轮只选一个能落地、能验证的方向。  
> 数据来自 GitHub API / 官方文档，星数为 2026-10-29 抓取。

## 一、同赛道高星

| 项目 | Stars | 已验证的行为 | 对 InterestSeed 的镜子 |
| --- | ---: | --- | --- |
| Claudian | 15,844 | 把 Agent 放进 Obsidian，项目共享 memory，Zen Mode | InterestSeed 已有 MCP context，不需要做聊天侧栏 |
| Smart Second Brain | 1,326 | 搜索和图谱无 AI 也能用；语义搜索；主题分组 | InterestSeed 搜索只覆盖标题/标签/摘要，覆盖太窄 |
| Waypoint | 866 | 自动生成 MOC，文件变更自动更新 | InterestSeed 已做显式兴趣路线，不自动写，这是更好的边界 |
| Extended Graph | 241 | 强化 Obsidian 原生图谱 | InterestSeed 已有自制 canvas，不重复造 |
| Obsidian MCP Plugin | 467 | 把 vault 暴露给 MCP | InterestSeed 已做只读 MCP，并升级到 2026-07-28 |
| Graphiti | 32,335 | 时间化知识图，事实变化与 provenance | InterestSeed 2.3 已有 Observation Timeline，但搜索没利用它 |
| Mem0 | 68,057 | semantic + BM25 + entity 多信号检索 | InterestSeed 只做单一子串匹配，缺多信号 |
| Cognee | 32,892 | 跨 session 记忆、决策、ontology | InterestSeed 有 Task State，搜索不能查“为什么” |
| MCP TypeScript SDK | 13,678 | 2026-07-28 官方协议 | InterestSeed 已升级协议，但仍是单文件实现 |

## 二、真正的差距

### 差距 1：搜索没有覆盖“上下文”

当前搜索只查：

```text
标题
标签
摘要
```

但图谱里已经有：

```text
sourceRef
why
raw
observations
contextSourceRef
```

用户搜“我为什么留下它”或“那次访谈”时，找不到。

这是 Smart Second Brain / Mem0 已经验证过的行为：

> 搜索应该找“你想的那条”，不是“你输入的 exact title”。

### 差距 2：Bases 原生表格/看板

Obsidian 1.14 的 Bases 已支持 table / kanban / cards / mobile filter。

InterestSeed 仍是自制 canvas + 自定义列表。

但这需要把 graph node 镜像成 Markdown 属性，数据重复，暂不做。

### 差距 3：同步

Automerge / Electric 已把 local-first sync 做成成熟能力。

InterestSeed 仍是单机 JSON，当前不是瓶颈。

## 三、筛选结果：只做一个

### 选中：Context Search

理由：

1. 高星项目已验证“搜索优先于更多入口”；
2. 不需要 AI、embedding、网络或新依赖；
3. 能立即利用 2.3 新写入的 observations / sourceRef；
4. 不改变写入边界；
5. 可用纯单元测试验证。

### 不选

- 不做 Agent 聊天侧栏：Claudian 已占据，InterestSeed 的差异是图谱判断。
- 不做自动 MOC：已有显式路线，自动写会破坏边界。
- 不做 Bases 镜像：数据重复，收益不匹配。
- 不做 CRDT 同步：当前不是瓶颈。

## 四、已落地

`matchesNode` 现在搜索：

```text
title
summary
why
raw
sourceRef
contextSourceRef
path
tags
observations[].evidence
```

并支持多词 AND：

```text
"观察 今天" → 两个词都命中
```

搜索框提示改为：

```text
搜索标题、标签、来源、观察…
```

测试：

```text
56 test files
471 tests passing
```

新增测试：

```text
搜索来源、为什么和观察时间线
```
