# GitHub Repository Metadata

This file is the source of truth for the repository About panel, social preview,
and release description. Keep English and Chinese aligned with the product.

## Repository name

```text
interestseed
```

## About — English

```text
A local-first interest validator for any Markdown vault. Your own local AI
suggests one testable connection; a 3-day experiment decides. CLI + local web
+ agent skill. Obsidian is optional.
```

## About — 简体中文

```text
一个本地优先的兴趣验证器，读取任何 Markdown vault。你自己的本地 AI 一次给一条
能验证的连接，再用 3 天实验决定继续还是放下。CLI + 本地 Web + Agent Skill，
Obsidian 可选。
```

## Topics

```text
markdown
agent-skill
cli
local-web
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
InterestSeed Standalone 4.0.0 — 脱离 Obsidian，成为 Skill
```

## Release body — English

```markdown
InterestSeed no longer needs the Obsidian plugin runtime.

It treats a vault as a plain Markdown folder:

capture → scan → one AI connection → 3-day experiment → evidence

Three shapes:

- CLI: capture / scan / suggest / connect / experiment / serve
- Local Web: graph, one suggestion, undo, experiment strip
- Skill: standalone/skill/SKILL.md

The model only receives node id, title, tags, and existing edge pairs.
It never receives note bodies, source paths, or vault contents.

Download `interestseed-standalone-v4.0.0.zip`, then:

node cli.js init --vault "<vault>"
node cli.js serve --vault "<vault>" --port 4173

527 tests passing. AGPL-3.0-only. Author: aicoder.
```

## Release body — 简体中文

```markdown
InterestSeed 不再依赖 Obsidian 插件运行时。

它把 vault 当成一个普通 Markdown 文件夹：

capture → scan → 一条 AI 连接 → 3 天实验 → 证据

三种形态：

- CLI：capture / scan / suggest / connect / experiment / serve
- 本地 Web：图谱、单条建议、撤销、实验条
- Skill：standalone/skill/SKILL.md

只发送节点 id、标题、标签、已有关系 id 对。
不发送笔记正文、来源路径、完整观察或 vault 内容。

下载 `interestseed-standalone-v4.0.0.zip`，然后：

node cli.js init --vault "<vault>"
node cli.js serve --vault "<vault>" --port 4173

527 个测试通过。AGPL-3.0-only. Author: aicoder.
```

## Pinned issue / security notice

```text
Please do not post real vault contents, API keys, cookies, personal paths or
unredacted discovery data. Report vulnerabilities privately; see SECURITY.md.
```
