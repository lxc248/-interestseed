# AI 本地模型实测 — 2026-10-31

## 环境

```text
模型：cn:deepseek-v4.1-flash
服务：http://localhost:7863/v1
API Key：已保存到 Obsidian SecretStorage
Vault：InterestSeed-4C11-Disposable
```

## 流程

```text
选中节点：AI 与工具
→ AI 关系建议
→ 返回 5 条候选
→ 确认第 1 条
→ 关系写入图谱
→ 撤销，恢复基线
```

## 结果

```text
候选数量：5
候选类型：全部围绕焦点节点“AI 与工具”
确认前：32 条关系
确认后：33 条关系
撤销后：32 条关系
```

确认写入的关系证据：

```text
AI 建议：该观察直接带有“AI 与工具”标签，是焦点主题下的具体观察。
用户确认
```

## 真实模型行为

v4.1 Flash 返回了 `source`、`target`、`reason`，但省略了 `relation` 和 `confidence`。

当前处理：

```text
缺 relation → 从共享标签推导；没有共享标签时回退“相关”
缺 confidence → 显示“未评分”，不伪造分数
单条坏数据 → 跳过，不让整批失败
```

## 截图

```text
review/experiment-3.0.8/55-ai-focus-live.png
review/experiment-3.0.8/56-ai-confirmed-edge.png
```

## 验证

```text
71 test files / 522 tests passing
MCP smoke 4/4
npm run verify 通过
```
