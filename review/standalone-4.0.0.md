# Standalone 4.0.0 — live verification

## Environment

```text
Windows
Node 22
Vault: standalone/demo-vault (8 Markdown notes)
Local model: cn:deepseek-v4.1-flash
Endpoint: http://localhost:7863/v1
```

## Scan

```text
init → 8 nodes / 10 edges / 8 files
```

The graph was built by the standalone scanner, not the Obsidian plugin.

## AI

```text
focus: AI 工具
suggestions: 5
first: AI 工具 → 知识管理
reason: AI 工具可用于知识采集、自动整理、检索与综合，增强知识管理流程。
```

## Web

```text
http://127.0.0.1:4173
cosmic graph renders 8 planets / 150 stars
AI suggestion: 1 / 5
connect → 200
undo → 200
experiment strip: DAY 2 / 3
lower panels: discoveries / share inbox / experiment history
chain strip: 收藏 → 连接 → 实验 → 复盘
```

## Discovery

```text
temp vault with P1/ and P2/, shared #focus / #ai
refresh → 4 active discoveries
apply → edge status confirmed
```

## Share inbox

```text
inbox add → pending, graph unchanged
inbox keep → InterestSeed/Inbox/<date>-<title>.md
rescan → 1 node
```

## CLI

```text
experiment start → exp_17eae137
experiment log → day 1, interest 4, energy 4
second log on the same day → rejected: 今天已经记录过了，明天再来。
```

## Package

```text
release/interestseed-standalone-v4.0.0.zip
sha256: 8f8a89b97e502d063a163945b69b4a35451086899b020070307cbcf2d167e22f
packaged cli.js status → 8 nodes / 10 edges
packaged web / → 200
```

## Tests

```text
74 test files / 530 tests passing
typecheck:standalone passing
lint passing
plugin build passing
```
