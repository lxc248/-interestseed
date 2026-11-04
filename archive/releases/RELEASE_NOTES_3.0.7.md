# InterestSeed 3.0.7 — Bug 测试与修复

## 修复

```text
BUG-04 高：Canvas 导出 ID 只有 16 种可能
  → 两路 FNV-1a 拼成 64 位 ID
  → 5000 节点唯一 ID = 5000

BUG-03 中：收件箱重复 id
  → load 时按 id 去重

BUG-02 中：BOM JSON 被当成损坏数据
  → 图谱 / 发现 / MCP 读取时剥离 \uFEFF

BUG-01 中：绝对路径被当成合法 vault 来源
  → 拒绝 /、\、盘符路径
```

## 验证

```text
67 test files / 507 tests passing
总行覆盖 74.48%
UI 43.56%
core 92.3%
services 84.7%
MCP 4/4
真实应用：10 个界面打开/关闭 0 异常
窄屏 420px：无横向溢出
XSS：0 注入
```

## 报告

```text
review/3.0.7-bug-hunt.md
```

AGPL-3.0-only. Author: aicoder.
