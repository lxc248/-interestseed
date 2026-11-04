# InterestSeed 3.0.3 — 视图布局修复

## 问题

```text
Agent 视图 / 图谱视图 切换时，
Obsidian 可能出现上下堆叠的第二个 leaf，
让界面看起来裂开。
```

## 修复

```text
activateAgentView() 复用当前 leaf
activateView() 复用当前 leaf
避免再创建第二个可见 pane
```

## 验证

```text
实际切换 Agent ↔ 图谱：
agentLeaves: 1
graphLeaves: 1
active: interestseed-agent-view
graph view 处于隐藏态，不再堆叠
```

## 回归

```text
57 test files / 472 tests passing
typecheck / lint / build passing
```

AGPL-3.0-only. Author: aicoder.
