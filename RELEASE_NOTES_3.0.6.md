# InterestSeed 3.0.6 — 95 路径收口

## 本轮完成

```text
- Canvas 纯模型拆分：src/ui/cosmicGraphModel.ts
- 1000 节点布局基准
- 动态安全审计：外链 noopener/noreferrer 实测
- axe：graph / inbox / share-card 0 violations
- 对比度修复：更多 / 收件箱日期 / 主按钮
- 双角色端到端：3 场景全部 ok
- 评分：92 / 100
```

## 验证

```text
64 files / 502 tests passing
总行覆盖 74.46%
UI 行覆盖 43.45%
core 行覆盖 92.3%
semgrep 0 findings
gitleaks no leaks
npm audit --omit=dev 0 vulnerabilities
```

## 报告

```text
review/3.0.6-scorecard.md
review/3.0.5-dynamic-security.md
review/3.0.5-accessibility-audit.md
review/3.0.5-persona-tests.md
docs/community-plugin-submission.md
```

## 95 的剩余外部项

```text
社区 PR 合并：被 obsidianmd/obsidian-releases 的 collaborators_only 策略阻断
真实读屏器实测：需要 NVDA / VoiceOver 人工走查
```

AGPL-3.0-only. Author: aicoder.
