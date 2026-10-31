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
缺 confidence → 不显示百分比，顶部说明模型未给分
单条坏数据 → 跳过，不让整批失败
```

## 3.5.0 单条建议

```text
一次只显示一条：AI 建议 · 1 / 5
动作：连上 / 换一个 / 先不用
关系名可在连上之前编辑
连上后显示“已连上这条关系”，可撤销
撤销后回到下一条，图谱恢复 32 条关系
```

## 3.6.0 只使用本地模型

```text
Claudian 已移除
只保留 localhost:7863/v1
模型 ID 可配置
设置页新增 MODEL 面板：模型 / 地址 / Key 状态
```

## 截图

```text
review/experiment-3.0.8/61-ai-single-suggestion.png
review/experiment-3.0.8/62-ai-single-connected.png
review/experiment-3.0.8/63-ai-single-undone.png
review/experiment-3.0.8/64-ai-local-model-panel.png
```

## 验证

```text
71 test files / 525 tests passing
MCP smoke 4/4
npm run verify 通过
```
