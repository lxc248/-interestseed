# GitHub Repository Metadata

This file is the source of truth for the repository About panel, social preview,
and release description. Keep English and Chinese aligned with the product.

## Repository name

```text
interestseed
```

## About — English

```text
A small Obsidian plugin that turns one saved post into a real 3-day test, then
lets evidence decide whether to keep it. Local-first, human-in-the-loop,
AI suggestions on by default, MCP-ready.
```

## About — 简体中文

```text
一个 Obsidian 小插件：把一条收藏变成 3 天真实行动，再用证据决定继续还是放下。
本地优先，人做决定，AI 建议默认开启，MCP 可连接。
```

## Topics

```text
obsidian
obsidian-plugin
interest-validation
interest-graph
knowledge-graph
local-first
personal-knowledge-management
evidence
discovery
mcp
ai-agent
typescript
canvas
```

## Homepage

```text
https://github.com/lxc248/-interestseed#readme
```

## Social preview

```text
Asset: assets/github-social-preview.png (1280 × 640)
Alt (EN): InterestSeed — turn one saved post into a real 3-day action.
Alt (ZH): InterestSeed — 把一条收藏变成 3 天真实行动。
Set via: GitHub → Settings → Social preview
```

## Release title

```text
InterestSeed 3.6.0 — 只使用用户自己的本地模型
```

## Release body — English

```markdown
InterestSeed is a small Obsidian plugin for a very specific moment: you saved
something, and you already know you will probably never try it. It gives that
save a 3-day test, then lets the evidence decide.

![InterestSeed](https://raw.githubusercontent.com/lxc248/-interestseed/main/assets/github-social-preview.png)

![InterestSeed demo](https://raw.githubusercontent.com/lxc248/-interestseed/main/assets/interestseed-demo.gif)

### What 3.6.0 actually changes

AI now runs only against the user's local model:

- Claudian provider, detection, settings option, and tests are gone;
- one endpoint: local OpenAI-compatible service at `localhost:7863/v1`;
- one key: the user's own key in Obsidian SecretStorage;
- model ID is configurable; default `cn:deepseek-v4.1-flash`;
- a local model status panel shows model, endpoint, and key state;
- AI still gives one suggestion at a time: connect / next / not now;
- 522 tests passing, CI and Release green.

### The loop

`Capture → Decide → Connect → Verify → Review → Next action`

### Install

1. Download `interestseed-v3.6.0.zip`.
2. Extract into `<vault>/.obsidian/plugins/interestseed/`.
3. Enable InterestSeed in Community plugins.
4. Run the cold-start questionnaire, then process the Share Inbox.

AGPL-3.0-only. Author: aicoder.
```

## Release body — 简体中文

```markdown
InterestSeed 是 Obsidian 里的一个小插件，专门处理那个很具体的瞬间：你收藏了
一条东西，心里其实知道自己大概率不会去做。它给这条收藏一个 3 天实验，然后
让证据来决定。

![InterestSeed](https://raw.githubusercontent.com/lxc248/-interestseed/main/assets/github-social-preview.png)

![InterestSeed demo](https://raw.githubusercontent.com/lxc248/-interestseed/main/assets/interestseed-demo.gif)

### 这次 3.6.0，只使用用户自己的本地模型

- Claudian 提供方、检测、设置项和测试都已移除
- 只保留一个入口：本地 OpenAI-compatible 服务 `localhost:7863/v1`
- 只使用用户自己的 API Key，存在 Obsidian SecretStorage
- 模型 ID 可配置，默认 `cn:deepseek-v4.1-flash`
- 设置页新增本地模型状态面板：模型、地址、Key 状态
- AI 仍然一次只给一条：连上 / 换一个 / 先不用
- 522 个测试通过，CI 和 Release 都是绿的。

### 它怎么跑

`Capture → Decide → Connect → Verify → Review → Next action`

### 装起来

1. 下载 `interestseed-v3.6.0.zip`；
2. 解压到 `<vault>/.obsidian/plugins/interestseed/`；
3. 在第三方插件里启用 InterestSeed；
4. 跑一遍冷启动，然后处理分享收件箱。

AGPL-3.0-only. Author: aicoder.
```

## Pinned issue / security notice

```text
Please do not post real vault contents, API keys, cookies, personal paths or
unredacted discovery data. Report vulnerabilities privately; see SECURITY.md.
```
