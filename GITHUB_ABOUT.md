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
InterestSeed 3.1.1 — AI 关系建议默认开启
```

## Release body — English

```markdown
InterestSeed is a small Obsidian plugin for a very specific moment: you saved
something, and you already know you will probably never try it. It gives that
save a 3-day test, then lets the evidence decide.

![InterestSeed](https://raw.githubusercontent.com/lxc248/-interestseed/main/assets/github-social-preview.png)

![InterestSeed demo](https://raw.githubusercontent.com/lxc248/-interestseed/main/assets/interestseed-demo.gif)

### What 3.1.1 actually changes

AI relation suggestions are now on by default, with a local-first boundary:

- settings show the enable switch, provider, and consent;
- an optional local service key is stored in Obsidian SecretStorage, never in data.json;
- `INTERESTSEED_AI_API_KEY` remains the environment fallback;
- only node id, title, and tags are sent;
- candidates are never written without confirmation;
- unavailable models fall back to local rule discovery;
- 401/403 responses point to the API key setting;
- 516 tests passing, CI and Release green.

### The loop

`Capture → Decide → Connect → Verify → Review → Next action`

### Install

1. Download `interestseed-v3.1.1.zip`.
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

### 这次 3.1.1，AI 关系建议默认开启

- 设置页可以直接开关 AI、选择提供方、查看发送字段；
- 本地服务 API Key 可保存到 Obsidian SecretStorage，不写入 data.json；
- 仍支持 `INTERESTSEED_AI_API_KEY` 环境变量；
- 只发送节点 id、标题、标签；
- AI 只出候选关系，确认后才写入；
- 模型不可用时保留本地规则发现；
- 401/403 会提示检查 API Key；
- 516 个测试通过，CI 和 Release 都是绿的。

### 它怎么跑

`Capture → Decide → Connect → Verify → Review → Next action`

### 装起来

1. 下载 `interestseed-v3.1.1.zip`；
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
