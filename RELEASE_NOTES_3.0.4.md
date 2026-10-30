# InterestSeed 3.0.4 — 全局逐文件审计

## 审计范围

```text
src/ 57 个 TS 文件
mcp/ 2 个 mjs
scripts/ 3 个 ps1
tests/ 57 个测试
.github/ 2 个 workflow
```

## 修复

```text
KEYDOWN-01
src/ui/CosmicGraphCanvas.ts
destroy() 漏移除 keydown 监听
→ 已补 removeEventListener('keydown', this.handleKeyDown)
```

## 验证

```text
npm run verify：62 files / 486 tests passing
tsc --noUnusedLocals/Parameters：通过
eslint：通过
mcp smoke：2/2
semgrep：0 findings
gitleaks：no leaks
npm audit --omit=dev：0 vulnerabilities
覆盖率：总行 73.17%，core 92.3%，ui 30.24%
```

## 报告

```text
review/3.0.4-full-code-audit.md
```

AGPL-3.0-only. Author: aicoder.
