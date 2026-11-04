# InterestSeed 3.6.0 — 只使用用户自己的本地模型

## Claudian 已移除

```text
没有 Claudian 选项
没有 Claudian 检测
没有 Claudian 会话依赖
没有 Claudian 测试
```

只保留：

```text
本地 OpenAI-compatible 服务
localhost:7863/v1
用户自己的 API Key
用户自己的模型 ID
```

## 借鉴布局，不借鉴依赖

设置页新增本地模型面板：

```text
MODEL
本地模型
cn:deepseek-v4.1-flash
http://localhost:7863/v1
已保存 Key / 未配置 Key
```

## 保留

```text
AI 一次只给一条建议
连上 / 换一个 / 先不用
关系名可改
连上后可撤销
Key 存 Obsidian SecretStorage
```

## 验证

```text
70 test files / 522 tests passing
MCP smoke 4/4
npm run verify 通过
```

AGPL-3.0-only. Author: aicoder.
