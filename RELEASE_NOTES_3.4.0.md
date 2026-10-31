# InterestSeed 3.4.0 — 模型可配置，默认 v4.1 Flash

## 模型

本地服务实际暴露的模型是：

```text
cn:deepseek-v4.1-flash
```

现在默认使用它，也可以在设置里改成服务实际暴露的任意 ID。

```text
设置 → AI 关系建议 → 模型 ID
```

## 请求兼容性

真实模型返回时可能省略 `relation` 或 `confidence`。现在：

```text
缺 relation → 从共享标签推导，例如“共享 火花”
没有共享标签 → 回退“相关”
缺 confidence → 显示“未评分”，不假装 50%
缺字段的条目 → 跳过，不让整批建议失败
```

同时兼容常见别名：

```text
source / sourceId / from / fromId
target / targetId / to / toId
relation / label / type / name
reason / why / explanation
confidence / score
```

## 实测

```text
模型：cn:deepseek-v4.1-flash
服务：http://localhost:7863/v1
结果：5 条候选关系正常显示
```

## 验证

```text
71 test files / 521 tests passing
MCP smoke 4/4
npm run verify 通过
```

AGPL-3.0-only. Author: aicoder.
