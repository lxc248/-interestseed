# InterestSeed 3.1.1 — 本地 AI 密钥安全存储

## 改进

```text
AI 关系建议默认开启
本地服务 API Key 可保存到 Obsidian SecretStorage
不写入 data.json，不进入图谱数据
留空时仍读取 INTERESTSEED_AI_API_KEY 环境变量
401/403 会提示检查 API Key
```

## 设置页

```text
AI 关系建议
  启用 / 关闭
  模型提供方：本地 DeepSeek / Claudian
  允许发送关系请求字段
  本地服务 API Key（可选）
```

## 边界

```text
发送：节点 id、标题、标签
不发送：笔记正文、来源路径、完整观察、Vault 内容
AI 只出候选关系，确认后才写入
```

## 验证

```text
70 test files / 516 tests passing
MCP smoke 4/4
npm run verify 通过
```

AGPL-3.0-only. Author: aicoder.
