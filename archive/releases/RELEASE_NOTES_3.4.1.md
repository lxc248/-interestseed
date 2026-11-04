# InterestSeed 3.4.1 — AI 实测与确认修复

## 真实模型跑通

```text
模型：cn:deepseek-v4.1-flash
服务：http://localhost:7863/v1
流程：选中节点 → 5 条候选 → 确认 1 条 → 写入 → 撤销
```

实测：

```text
候选：5 条，全部围绕焦点节点
写入前：32 条关系
写入后：33 条关系
撤销后：32 条关系
```

## 修复

确认 AI 候选时，之前只把 source/target/relation 传给写入层，理由和置信度会丢。现在：

```text
理由 → 进入关系证据
置信度（如果有）→ 进入边数据
没有置信度 → 不伪造 0.5
```

## 展示更新

```text
README 新增 AI 关系建议截图
README 新增接入自己的 AI 截图
README 增补 AI-READY 标识
GitHub Release 附上实测结果
```

## 验证

```text
71 test files / 522 tests passing
MCP smoke 4/4
npm run verify 通过
```

AGPL-3.0-only. Author: aicoder.
