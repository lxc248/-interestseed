# InterestSeed 2.2.0 — 同一条兴趣，同一个上下文

这一版把 2.1 的 Context Packet 从“收件箱里的来源标签”，推进到图谱和 MCP。

## 1. 来源可以点开

收件箱里的来源标签现在可以点击：

```text
Obsidian 笔记
→ 关闭收件箱
→ 打开原笔记
```

保留：

```text
source: note
sourceRef: P2/theme-b-two.md
```

## 2. 笔记导入更干净

导入当前笔记时会去掉：

- YAML frontmatter；
- Markdown 标题井号；
- 多余空白。

## 3. Interest Task State

节点现在有一条任务状态：

```text
captured       已捕获
judged         已判断
connected      已连接
experimenting  验证中
reviewed       已复盘
```

规则：

- 验证节点显示“验证中”；
- 已连接但仍是 captured / judged 的节点自动提升为 connected；
- 旧图谱不迁移、不破坏，按需推断；
- 详情面板显示状态胶囊。

## 4. 图谱和 MCP 共享上下文

新火花节点会写入：

```text
taskState
contextSource
contextSourceRef
```

MCP 的 `interestseed_get_graph` 现在返回：

```text
taskState
source
sourceRef
```

仍然是只读，不会写入 Vault。

## 5. “更多”菜单继续收口

2.1.1 已把 13 项平铺改成：

```text
图谱
关系
发现
导出
```

2.2.0 保持该结构，不再扩大主界面。

## 验证

```text
53 test files
464 tests passing
typecheck / lint / build passing
```

实际验证：

```text
来源点击：收件箱来源 → 原笔记
任务状态：7 天兴趣实验 → 验证中
MCP：taskState = connected / experimenting
```

截图：

```text
review/2.2.0-task-state-selected.png
```

## 边界

- 不做中心化账号；
- 不做积分；
- 不自动抓取平台；
- 不自动写图谱。

AGPL-3.0-only.
