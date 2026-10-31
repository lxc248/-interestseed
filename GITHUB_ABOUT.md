# GitHub Repository Metadata

This file is the source of truth for the repository About panel, social preview,
and release description. Keep English and Chinese aligned with the product.

## Repository name

```text
interestseed
```

## About — English

```text
A small Obsidian plugin where your own local AI suggests one testable connection,
then a 3-day experiment decides whether to keep it. Local-first,
human-in-the-loop, MCP-ready.
```

## About — 简体中文

```text
一个 Obsidian 小插件：你自己的本地 AI 一次给一条能验证的连接，
再用 3 天实验决定继续还是放下。本地优先，人做决定，MCP 可连接。
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
InterestSeed 3.6.0 — 本地 AI，一次一条
```

## Release body — English

```markdown
InterestSeed is a small Obsidian plugin for a very specific moment: you saved
something, and you already know you will probably never try it. It gives that
save a 3-day test, then lets the evidence decide.

![InterestSeed](https://raw.githubusercontent.com/lxc248/-interestseed/main/assets/github-social-preview.png)

![InterestSeed demo](https://raw.githubusercontent.com/lxc248/-interestseed/main/assets/interestseed-demo.gif)

### What 3.6.0 actually changes

AI is the headline, not a feature row:

- one local suggestion at a time: connect / next / not now;
- a reason attached; relation name editable; undo after writing;
- no batch pending-confirmation wall, no auto-write;
- only your local OpenAI-compatible endpoint at `localhost:7863/v1`;
- your own key in Obsidian SecretStorage; model ID configurable;
- default `cn:deepseek-v4.1-flash`;
- Claudian provider, detection, settings, and tests are gone;
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

### 这次 3.6.0，AI 是主角

- 一次只给一条本地 AI 建议：连上 / 换一个 / 先不用
- 带理由，关系名可改，写入后可撤销
- 没有批量“待确认”，不会自动写图谱
- 只连你自己的本地 OpenAI-compatible 服务 `localhost:7863/v1`
- Key 存在 Obsidian SecretStorage，模型 ID 可配置
- 默认模型 `cn:deepseek-v4.1-flash`
- Claudian 提供方、检测、设置项和测试都已移除
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
