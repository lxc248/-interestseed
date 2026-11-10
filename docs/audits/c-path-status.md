# C-path status — 2026-11-10

Internal milestones complete. Honest score: **7.1 / 10**.

## Done (verifiable)

```text
main.ts           1548 → 1073 lines
plugin modules    17 → 19
standalone app.js 1397 → 589 lines
tests             648 → 953 passed (829 vitest + 85 mcp + 39 e2e)
coverage          lines 87.86% / branches 75.39% / functions 87.28% (gates 83 / 72.5 / 85.5 / 85.5)
CodeQL            open alerts 0
npm audit         0 vulnerabilities
release           4.0.10 published, digest published
loopback guard    Host/Origin/token/key hardened
audit handoff     auditor brief + external audit packet ready
launch materials  launch kit + honest adoption tracker ready
```

## Not done — external inputs only

```text
1. Independent human security audit   (materials ready, reviewer missing)
2. Real adoption                      (zip 1 download / 1 star / 0 fork)
3. Git history cleanup                (needs authorization + backup confirmation)
```

## Score table

```text
Code quality   7.5 / 10   (23 modules, main.ts 1073)
Tests / QA     8.1 / 10   (953 tests, green thresholds)
Overall        7.1 / 10
```

## Rule

Do not claim 8.5, users, downloads, stars, or an independent audit that do not exist.

## Obsidian 社区目录（2026-11-10）

```text
release tag 3.7.2  -> e700792
assets         main.js 667,841 / manifest.json 287 / styles.css 216,552
manifest       version 3.7.2, isDesktopOnly false（移动端可安装，Agent 入口已按平台裁剪）
workflow       run 42819715233 success（CI 构建）
```

尚未提交 community-plugins.json PR；提交入口与条目见 docs/distribution/obsidian-submission-checklist.md。
