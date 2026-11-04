# InterestSeed 3.3.0 — 接入引导窗口

## 新增

当 AI 未启用、未授权，或本地服务返回 401/403 时，直接打开引导窗口：

```text
把 AI 推荐接上
```

窗口里能完成：

```text
看到当前模型与服务地址
看到当前状态
阅读会发送 / 不会发送的字段
填入自己的本地服务 API Key
保存到 Obsidian SecretStorage
打开设置
切换到 Claudian
```

## 入口

```text
命令面板 → 接入 AI 推荐
设置 → AI 关系建议 → 打开接入引导
AI 建议失败且是 401/403
```

## 仍然坚持

```text
Key 不写入 data.json
Key 不进入图谱
不发送笔记正文、路径或完整观察
没有 Key 就安全降级到本地规则
```

## 验证

```text
71 test files / 520 tests passing
MCP smoke 4/4
npm run verify 通过
```

AGPL-3.0-only. Author: aicoder.
