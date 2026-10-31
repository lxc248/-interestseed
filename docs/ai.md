# AI 建议

AI 不是 InterestSeed 的附加功能，它是这个项目最核心的一步：

```text
你有太多收藏
→ AI 从你的图谱里挑一条最值得验证的连接
→ 你决定：连上 / 换一个 / 先不用
→ 连上后进入 3 天实验
```

它不替你收藏，也不替你决定。  
它只把“下一条值得试的连接”放到你面前。

## 为什么不是聊天框

聊天框会给你很多答案，但不会帮你做决定。

InterestSeed 的 AI 只做一件事：

```text
一次给一条建议
附一句理由
关系名可以改
连上后才写入
写入后可以撤销
```

## 它怎么选

```text
有焦点节点 → 焦点优先，再找共享标签的候选
没有焦点 → 孤立 / 低度数节点优先
请求最多 32 个节点
请求最多 5 条建议
带上已有关系对，避免重复推荐
```

## 模型在哪里

```text
本地 OpenAI-compatible 服务
http://localhost:7863/v1
模型 ID 可配置，默认 cn:deepseek-v4.1-flash
API Key 存在 Obsidian SecretStorage
```

不使用 Claudian，不依赖任何第三方 Agent 插件。

## 数据边界

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

## 失败时

```text
模型不可用 → 保留本地规则发现
401/403 → 打开接入引导
单条坏数据 → 跳过，不影响整批
没有置信度 → 不伪造分数
```

## 实测

```text
模型：cn:deepseek-v4.1-flash
结果：5 条聚焦候选
连上：32 → 33 条关系
撤销：33 → 32 条关系
```

## 截图

```text
assets/ai-suggestions-live.png
assets/ai-model-panel.png
assets/ai-setup.png
```
