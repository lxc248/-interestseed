# InterestSeed 3.7.1

这一版只做一件事：**让插件能装到 Obsidian 移动端**，同时不牺牲桌面端能力。

## 移动端可安装

之前 `manifest.json` 标的是 `isDesktopOnly: true`，原因是 Agent 功能会直接 `require('child_process')`，而移动端没有 Node 运行时。代价是手机和平板上根本搜不到这个插件。

现在改为 `isDesktopOnly: false`：

```text
图谱 / 收件箱 / 实验 / 分享卡     只依赖 vault 文件，移动端完全可用
Agent 功能                       仍在，但仅桌面端可用
```

## Agent 在移动端会明确告知，而不是崩溃

新增平台守卫 `src/plugin/platform.ts`，在三处把 Agent 挡在 Node 之前：

```text
ribbon / 命令激活   → 先判平台，只弹提示
AgentView           → 同上
DshAcpClient.start  → 在 require('child_process') 之前抛错
```

移动端点 Agent 会看到：

```text
InterestSeed：Agent 需要本地进程，目前只在桌面端可用。
```

而不是 `ReferenceError: process is not defined`。

## 数据兼容

- 无 schema 变化，3.7.0 的图谱与发现文件可直接读取
- `minAppVersion` 仍为 1.5.0

## 证据

```text
测试   794 passed（740 Vitest + 19 MCP + 35 Playwright）
覆盖率 行 87.68% / 分支 74.99% / 函数 86.81%
CI     verify / e2e / size / CodeQL 全绿，npm audit 0
```

## 仍未完成的

- 没有独立第三方安全审计
- Agent 的桌面守卫目前只有源码级约束测试，没有行为级测试（它会 spawn 真实子进程）
