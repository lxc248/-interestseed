# GitHub Repository Metadata

This file is the source of truth for the repository About panel, social preview,
and release description. Keep English and Chinese aligned with the product.

## Repository name

```text
interestseed
```

## About — English

```text
InterestSeed is an interest validator for Obsidian: turn one saved post into a
real 3-day action, then let evidence decide whether to keep it. Local-first,
human-in-the-loop, MCP-ready.
```

## About — 简体中文

```text
InterestSeed 是 Obsidian 里的兴趣验证器：把一条收藏变成 3 天真实行动，用证据
决定继续还是放下。本地优先、人做决定、MCP 可连接。
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
InterestSeed 3.0.8 — 把一条收藏变成 3 天真实行动
```

## Release body — English

```markdown
InterestSeed is an interest validator for Obsidian. It turns a saved post into
a real 3-day action, then lets evidence decide whether to keep it.

![InterestSeed](https://raw.githubusercontent.com/lxc248/-interestseed/main/assets/github-social-preview.png)

### What is new in 3.0.8

- Consolidated duplicate helpers into `utils/text`, `utils/math`, and `ui/nodeStyle`.
- Moved spark text helpers out of `main.ts` into `services/shareAnalysis`.
- Added the 64-bit Canvas export IDs, BOM handling, and inbox dedupe fixes from 3.0.7.
- 511 tests passing, 74.74% line coverage, CI and Release green.

### Core loop

`Capture → Decide → Connect → Verify → Review → Next action`

### Install

1. Download `interestseed-v3.0.8.zip`.
2. Extract into `<vault>/.obsidian/plugins/interestseed/`.
3. Enable InterestSeed in Community plugins.
4. Run the cold-start questionnaire, then process the Share Inbox.

AGPL-3.0-only. Author: aicoder.
```

## Release body — 简体中文

```markdown
InterestSeed 是 Obsidian 里的兴趣验证器：把一条收藏变成 3 天真实行动，再用证据决定继续还是放下。

![InterestSeed](https://raw.githubusercontent.com/lxc248/-interestseed/main/assets/github-social-preview.png)

### 3.0.8 更新

- 重复工具函数收敛到 `utils/text`、`utils/math`、`ui/nodeStyle`。
- 火花文本逻辑从 `main.ts` 移到 `services/shareAnalysis`。
- 包含 3.0.7 的 Canvas 64 位 ID、BOM 处理、收件箱去重修复。
- 511 个测试通过，总行覆盖 74.74%，CI 与 Release 全绿。

### 核心闭环

`Capture → Decide → Connect → Verify → Review → Next action`

### 安装

1. 下载 `interestseed-v3.0.8.zip`。
2. 解压到 `<vault>/.obsidian/plugins/interestseed/`。
3. 在第三方插件中启用 InterestSeed。
4. 运行冷启动问卷，然后处理分享收件箱。

AGPL-3.0-only. Author: aicoder.
```

## Pinned issue / security notice

```text
Please do not post real vault contents, API keys, cookies, personal paths or
unredacted discovery data. Report vulnerabilities privately; see SECURITY.md.
```
