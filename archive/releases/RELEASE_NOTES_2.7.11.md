# InterestSeed 2.7.11 — 按钮对比度修复

修复 Obsidian 亮色主题下，自定义按钮被 `.theme-light button` 覆盖的问题。

## 问题

```text
Agent 与 补一条连接 按钮：
白底 + 近白文字，几乎不可读
```

## 原因

```text
Obsidian 的 `.theme-light button` 特异性高于单 class 规则，
把 background/color 强制成白色
```

## 修复

```text
用 .interestseed-root 提高特异性，重新声明自定义按钮配色
```

## 修复后

```text
Agent：紫色文字 + 紫色半透明底
补一条连接：金色文字 + 金色半透明底
```

## 证据

```text
review/button-contrast-fixed.png
```

## Verification

```text
57 test files
472 tests passing
typecheck / lint / build passing
```

AGPL-3.0-only.
