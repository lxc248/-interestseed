# InterestSeed 2.3.0 — 时间线、路线与 Agent 上下文

这一版不再增加入口，只补三件让图谱更有用的事。

## 1. Observation Timeline

每个节点可以带一条只追加的观察时间线：

```text
at
source
sourceRef
evidence
belief: stronger | weaker | changed
```

触发点：

- 捕获火花；
- 3/7 天验证记录；
- 冷启动生成的判断。

详情面板显示最近 4 条，路线笔记引用最近观察。

## 2. 兴趣路线 MOC

新命令：

```text
生成兴趣路线笔记（Markdown MOC）
```

只由用户显式执行，输出：

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

不会自动覆盖或写入已有笔记。

## 3. MCP v2

协议升级到：

```text
2026-07-28
```

新增工具：

```text
interestseed_get_context
```

新增资源：

```text
interestseed://graph
interestseed://experiment
interestseed://next
interestseed://context
```

新增 prompts：

```text
review-interest
plan-next-experiment
```

仍然是只读，不访问网络。

## 4. UI

- 详情面板新增“时间线”；
- “更多 → 导出”新增“生成兴趣路线”；
- 保留 2.2 的任务状态与来源点击。

## 验证

```text
55 test files
467 tests passing
typecheck / lint / build passing
```

实际验证：

```text
时间线：1 条观察，状态“已捕获”
路线：InterestSeed/兴趣路线 - 全部兴趣 - 2026-10-29.md
MCP：2026-07-28，resources + prompts + context
```

截图：

```text
review/2.3.0-observation-timeline.png
review/2.3.0-interest-route.png
```

## 边界

- 不自动写图谱；
- 不自动写路线；
- 不访问网络；
- 不做账号和积分；
- 不抓取平台内容。

AGPL-3.0-only.
