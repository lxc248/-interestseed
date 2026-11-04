# InterestSeed 优化方向重扫 · 2026-10-29

> 本轮为全新搜索，不复用 Buddy One 材料。  
> 目标：找能直接改善 InterestSeed 的“新内容”，不是堆概念。

## 一、这轮看到的五个新信号

### 1. Obsidian 已经把 Bases 做成了原生数据库

Obsidian 当前版本为 **1.14.5**（2026-10-22）。Bases 已从表格扩展出：

- Kanban 视图；
- Cards 视图；
- 分组、排序、过滤；
- 移动端底部筛选面板；
- CSV 导出；
- 公式字段。

来源：

```text
https://github.com/obsidianmd/obsidian-releases/releases/tag/v1.14.5
https://obsidian.md/changelog/
```

对 InterestSeed 的启发：

> 不要把所有“列表/看板”都做成自定义弹窗。  
> 用户已经熟悉 Bases 的 table / kanban / cards。  
> InterestSeed 应该提供 **Bases 兼容导出**，而不是再发明一套表格。

### 2. 高星 Obsidian 插件在走“无 AI 也能用”的路线

Smart Second Brain（1,326 stars）明确说：

- 搜索和图谱开箱即用；
- 不配置 AI provider 也能工作；
- AI 只是增强，不是前提。

Waypoint（866 stars）则把文件夹自动生成 MOC：

- 文件创建、重命名、移动、删除时自动更新；
- 用户不用维护索引。

来源：

```text
https://github.com/s2b-dev/smart-second-brain
https://github.com/IdreesInc/Waypoint
```

对 InterestSeed 的启发：

> “无 AI 也能判断”已经是社区共识。  
> InterestSeed 应该强化 **确定性图谱 + 可选 AI**，  
> 并增加一个 **兴趣路线 MOC**：把已确认节点生成可读的 Markdown 路径，而不是只存在 Canvas 里。

### 3. AI memory 已经从“存聊天”转向“时间化上下文图”

Graphiti（32,335 stars）的定位：

- temporal context graph；
- 跟踪事实如何随时间变化；
- 保留来源 provenance；
- 支持 prescribed / learned ontology。

Mem0（68,057 stars）强调：

- 多信号检索：semantic + BM25 + entity；
- temporal reasoning；
- entity linking；
- agent-generated facts 也是一等公民。

Cognee（32,892 stars）强调：

- 跨 session 记忆；
- 决策、修复、规则沉淀；
- 自定义 ontology。

来源：

```text
https://github.com/getzep/graphiti
https://github.com/mem0ai/mem0
https://github.com/topoteretes/cognee
```

对 InterestSeed 的启发：

> InterestSeed 现在有节点和关系，但缺少“这条兴趣是怎么变的”。  
> 下一步不是再接一个向量库，而是给节点加 **时间化证据**：
>
> ```text
> observation
>   at
>   source
>   evidence
>   changedBelief
> ```
>
> 这样“我三个月前为什么留下它”与“我现在还认不认”可以同时存在。

### 4. Agent 产品开始共享“项目记忆”，而不是共享聊天记录

Claudian（15,844 stars）的 Projects：

- 同一项目的多个 session 共享 instructions；
- 共享 memory file；
- agent 之间可以互相查找、读取、发消息；
- 还有 Zen Mode，把侧栏折叠成底部紧凑输入。

来源：

```text
https://github.com/YishenTu/claudian
```

对 InterestSeed 的启发：

> InterestSeed 的 Agent 不应该每次重新理解整张图。  
> 应该有一个显式的 **Agent Context Packet**：
>
> ```text
> 当前 NEXT
> 当前实验
> 最近 3 条判断
> 已确认关系
> 来源与证据
> ```
>
> 由用户确认后交给 Agent，而不是让 Agent 猜。

### 5. MCP 已经进入 v2，而 InterestSeed 还停在旧协议

MCP 最新规范：

```text
2026-07-28
```

官方 TypeScript SDK 已进入 v2：

```text
@modelcontextprotocol/server
@modelcontextprotocol/client
```

v1 只继续维护一段时间。MCP Registry 也已有 7,419 stars。

来源：

```text
https://modelcontextprotocol.io/specification/2026-07-28
https://github.com/modelcontextprotocol/typescript-sdk
https://github.com/modelcontextprotocol/registry
```

对 InterestSeed 的启发：

> 当前 `mcp/server.mjs` 还是手写 `2024-11-05`，只有 tools。  
> 下一步应该：
>
> - 迁移官方 SDK v2；
> - 增加 resources / prompts；
> - 暴露 `interestseed://graph`、`interestseed://experiment`、`interestseed://next`；
> - 再考虑 Registry 收录。

## 二、按投入产出排序

| 优先级 | 方向 | 为什么现在做 | 难度 |
| --- | --- | --- | --- |
| P0 | MCP v2 + resources/prompts | 旧协议已落后两个大版本，且是外部 Agent 的入口 | 中 |
| P0 | 时间化证据 / 决策日志 | 直接提升“为什么留下”的可信度 | 低 |
| P1 | 兴趣路线 MOC | 把图谱变成可读的 Markdown 资产 | 低 |
| P1 | Bases 兼容导出 | 借用用户已熟悉的 table / kanban | 中 |
| P1 | Agent Context Packet | 让外部 Agent 不再猜上下文 | 中 |
| P2 | 本地优先同步 | 多设备是长期需求，但现在不是瓶颈 | 高 |
| P2 | 原生 Kanban 兴趣板 | 自定义 canvas 已够用，先不重复造 | 中 |

## 三、建议的 2.3.0 范围

不要一次做五个。建议只做三个：

### 1. Observation Timeline

每个节点增加：

```text
observations: [
  {
    at,
    source,
    sourceRef,
    evidence,
    belief: 'stronger' | 'weaker' | 'changed'
  }
]
```

详情面板显示“这条兴趣怎么走到今天”。

### 2. 兴趣路线 MOC

用户显式点击后才生成：

```text
兴趣路线 - {cluster}.md
```

内容：

- 已确认节点；
- 每个节点的来源；
- 当前实验；
- 下一步；
- 最近一条证据。

不自动写入，不覆盖用户笔记。

### 3. MCP v2

先迁移官方 SDK，保持现有 4 个 tools 兼容，再加：

```text
resources:
  interestseed://graph
  interestseed://experiment
  interestseed://next

prompts:
  review-interest
  plan-next-experiment
```

这一步比“再接一个平台”更能提升 InterestSeed 的互操作性。

## 四、不建议现在做

### 不要做云端账号

Obsidian 用户选择本地优先，不是为了再登录一个中心化账号。

### 不要做通用聊天

Claudian 已经把“把 coding agent 放进 vault”做到很高完成度。  
InterestSeed 不应该变成另一个聊天侧栏。

### 不要做无限信息流

Bases、Smart Second Brain 都在降低信息组织成本；  
InterestSeed 的差异是“只留下少数值得验证的兴趣”，不是“更多内容”。

### 不要为了同步而同步

Automerge（6,696）和 Electric（10,420）证明本地优先同步是成熟方向，  
但 InterestSeed 当前是单机 JSON，先解决数据和任务模型，再谈 CRDT。

## 五、这轮最值得记住的一句

> 用户不需要一个更会连接的图谱，  
> 需要一个能解释“我为什么曾经在意、现在是否还成立”的图谱。

InterestSeed 的下一步，应该是 **时间化证据 + 可读路径 + 标准 Agent 接口**，而不是更多入口。
