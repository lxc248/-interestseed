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
InterestSeed 3.4.2 — AI 确认流程重做
```

## Release body — English

```markdown
InterestSeed is a small Obsidian plugin for a very specific moment: you saved
something, and you already know you will probably never try it. It gives that
save a 3-day test, then lets the evidence decide.

![InterestSeed](https://raw.githubusercontent.com/lxc248/-interestseed/main/assets/github-social-preview.png)

![InterestSeed demo](https://raw.githubusercontent.com/lxc248/-interestseed/main/assets/interestseed-demo.gif)

### What 3.4.2 actually changes

The AI confirmation flow now explains itself:

- after writing, a banner says how many relations were written;
- the banner offers "undo this write" and "done";
- undone rows show "undone" instead of a stale "accepted";
- relation names are editable before confirmation;
- missing confidence no longer renders "unrated"; one note explains it;
- saved keys show "saved, keep blank to keep it" and a clear-key action;
- live run on `cn:deepseek-v4.1-flash`: 5 focused candidates, 32 → 33 → 32 edges;
- README shows the redesigned AI screens;
- 525 tests passing, CI and Release green.

### The loop

`Capture → Decide → Connect → Verify → Review → Next action`

### Install

1. Download `interestseed-v3.4.2.zip`.
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

### 这次 3.4.2，AI 确认流程重做

- 写入后弹窗顶部显示“已写入 1 条 AI 关系”
- 提供“撤销这次写入”和“完成”
- 撤销后卡片显示“已撤销”，图谱恢复原状
- 关系名可以在确认前直接改
- 模型没给置信度时，不再显示“未评分”
- Key 已保存时提示“留空保持不变”，并提供清除按钮
- 本地实测：5 条聚焦候选，关系 32 → 33 → 32
- 525 个测试通过，CI 和 Release 都是绿的。

### 它怎么跑

`Capture → Decide → Connect → Verify → Review → Next action`

### 装起来

1. 下载 `interestseed-v3.4.2.zip`；
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
