# Distribution kit

Use this file when submitting InterestSeed to directories, newsletters, awesome
lists, or communities. Keep the claims narrow and verifiable.

## One-liner

**中文**

> InterestSeed 是一个本地优先的兴趣验证器：把一条收藏变成 3 天真实实验，再用证据决定继续还是放下。

**English**

> InterestSeed is a local-first interest validator: it turns a saved note into
> one testable connection and a 3-day experiment.

## Short description

**50 words**

InterestSeed is a local-first interest validator for any Markdown vault. Local
AI suggests one testable connection at a time; a 3-day experiment records real
observations and decides continue / change / drop. CLI, local web, agent skill
and read-only MCP share one graph. No auto-writes.

**100 words**

InterestSeed is for people who save a lot but rarely test what they saved. It
reads any Markdown vault and asks for one defensible connection at a time. The
AI request contains only node ids, titles, tags and existing edge pairs — never
note bodies or source paths. You connect, skip or change the relation, then run
a 3-day experiment with one observation per day. Evidence decides whether to
continue, change direction, or drop it. It ships as a CLI, local web dashboard,
agent skill and read-only MCP. Obsidian is optional. AGPL-3.0-only.

## Long description

InterestSeed is a local-first interest validator, not another read-it-later
app. It starts after capture: you already have a vault full of saved notes,
links and ideas, but saving is not the same as testing.

The loop is deliberately small:

```text
capture → connect → 3-day experiment → evidence → next action
```

The local AI suggests one connection at a time. The request is limited to node
ids, titles, tags and existing edge pairs; it does not send note bodies, source
paths or vault contents. You decide whether to connect, skip or change the
relation. Then you run a 3-day experiment and log one real observation per day.

The standalone runtime includes:

- a CLI;
- a local web dashboard with a cosmic graph;
- an agent skill that waits for confirmation;
- a read-only MCP server.

Obsidian is optional; the Markdown vault is the data layer.

## Facts

```text
Latest release: 4.0.8
License: AGPL-3.0-only
Platform: macOS / Windows / Linux
Runtime: Node.js
AI: OpenAI-compatible endpoint, local by default
Obsidian: optional
Tests: 617 passing (574 Vitest + 11 MCP smoke + 32 Playwright E2E)
Repository: https://github.com/lxc248/-interestseed
Website: https://lxc248.github.io/-interestseed/
```

## Assets

```text
site/og.png                         1280x640 social preview
assets/standalone-ai.png            standalone AI panel
assets/interestseed-launch.mp4      40s demo
assets/onboarding.png               3-minute cold start
assets/experiment.png               3-day experiment
assets/plugin-cosmic.png            cosmic graph
```

## Submission angles

| Target | Angle | Notes |
| --- | --- | --- |
| HelloGitHub | “把收藏变成 3 天实验”的本地优先工具 | Submit the repo and a short Chinese description |
| GitHubDaily | Local-first interest validator with a 3-day loop | Use the 50-word description and demo |
| OpenSauced | Local-first AI / PKM tool | Add repository lists and highlights |
| OSS Insight | Data/discovery | No invented metrics; let the data speak |
| Star History | Growth chart | Add the repo; no submission copy needed |
| Gorse | Recommendation | Submit repository metadata |
| Awesome Obsidian | Obsidian plugin + standalone Markdown tool | Follow the list's PR format |
| Awesome Local AI | Local OpenAI-compatible workflow | Emphasize the metadata-only boundary |
| Awesome MCP | Read-only MCP server | Link `mcp/README.md` |
| Hacker News | Show HN: I built a validator for saved interests | Be present for questions; no astroturfing |
| r/ObsidianMD | Optional plugin + standalone | Read the self-promotion rules first |
| r/PKMS | A decision loop for saved notes | Do not claim it replaces PKM tools |
| 小红书 / B站 / 知乎 | 收藏不等于学会；3 天实验 | Use the Chinese one-liner and real screenshots |

## UTM links

Use one link per channel so traffic is attributable:

```text
https://lxc248.github.io/-interestseed/?utm_source=hellogithub&utm_medium=referral&utm_campaign=launch
https://lxc248.github.io/-interestseed/?utm_source=githubdaily&utm_medium=referral&utm_campaign=launch
https://lxc248.github.io/-interestseed/?utm_source=opensauced&utm_medium=referral&utm_campaign=launch
https://lxc248.github.io/-interestseed/?utm_source=xiaohongshu&utm_medium=referral&utm_campaign=launch
```

## Claim guardrails

Do not say:

- “100% local” when the user can configure a remote OpenAI-compatible endpoint.
- “The AI reads your notes.” It reads node ids, titles, tags and edge pairs.
- “Replaces Obsidian / Readwise.” It is a validation layer, not a replacement.
- “Proven to cure procrastination.” It is a small personal experiment, not
  clinical evidence.
- Any star count, user count or benchmark that is not measured.

Do say:

- “Local-first by default.”
- “The AI request is limited to metadata.”
- “One suggestion at a time.”
- “3-day experiment with evidence.”
- “AGPL-3.0-only.”

## Checklist

```text
[ ] Website URL works
[ ] Latest release URL works
[ ] OG image renders
[ ] Demo video plays
[ ] README first screen explains the product in 10 seconds
[ ] License and trademark links are visible
[ ] Submission copy fits the target's length limit
[ ] UTM link is used
[ ] No unverifiable claims
[ ] Reply to comments for 48 hours after posting
```

## Current status

```text
Website: live
Latest release: 4.0.8
External citations: not yet established
Next action: submit to one directory, then measure referral traffic
```

