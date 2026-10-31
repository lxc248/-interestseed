# InterestSeed 3.1.0 — AI 关系建议默认开启

## 默认开启

```text
enableAI: true
aiConsentGranted: true
provider: 本地 DeepSeek V4 Pro · localhost:7863
```

只发送：

```text
节点 id
标题
标签
```

不发送：

```text
笔记正文
来源路径
完整观察
Vault 内容
```

AI 只生成候选关系，确认后才写入图谱。模型不可用时自动保留本地规则发现。

## 设置页

新增 AI 关系建议区块：

```text
启用 / 关闭
模型提供方：本地 DeepSeek / Claudian
允许发送关系请求字段
当前模型与服务地址
```

图谱「关系」菜单新增 **AI 建议** 入口。

## 同时包含

```text
3.0.9 的清空图谱确认
全功能模拟实验报告与 47 条路径截图
```

## 验证

```text
70 test files / 516 tests passing
MCP smoke 4/4
npm run verify 通过
```

AGPL-3.0-only. Author: aicoder.
