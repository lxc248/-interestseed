# InterestSeed Standalone

InterestSeed without the Obsidian plugin runtime.

It reads any Markdown folder, builds the same interest graph, and lets your own local
AI suggest one testable connection at a time. Obsidian is optional: it can still open
the same vault, but InterestSeed no longer depends on it.

## Shape

```text
standalone/
  src/
    cli.ts       command line
    vault.ts     Markdown scanner
    state.ts     .interestseed state/config
    graph.ts     graph build
    ai.ts        local model + edge writes
    server.ts    local web server
  web/           local dashboard
  skill/         agent skill
```

## Build

```bash
npm run build --prefix standalone
```

## Use

```bash
node standalone/dist/cli.js init --vault "C:\path\to\vault"
node standalone/dist/cli.js scan --vault "C:\path\to\vault"
node standalone/dist/cli.js suggest --vault "C:\path\to\vault" --node "node_..."
node standalone/dist/cli.js connect --vault "C:\path\to\vault" --source "node_..." --target "node_..." --relation "共享方法"
node standalone/dist/cli.js undo --vault "C:\path\to\vault"
node standalone/dist/cli.js experiment start --vault "C:\path\to\vault" --title "AI 工具 × 习惯"
node standalone/dist/cli.js experiment log --vault "C:\path\to\vault" --id "exp_..." --evidence "今天做了什么"
node standalone/dist/cli.js serve --vault "C:\path\to\vault" --port 4173
```

Web 里也有：

```text
保存一条       捕获弹窗
设置           本地模型 / Key / 扫描目录
AI 建议        一条建议
链路条         收藏 → 连接 → 实验 → 复盘
实验条         快速记录
发现 / 收件箱 / 实验历史
分享卡         收藏做成图
冷启动         3 分钟 Seed Sprint
头部状态       Key / 发现 / 待处理
```

## Demo vault

`standalone/demo-vault/` contains eight small notes you can scan:

```bash
node standalone/dist/cli.js init --vault "standalone/demo-vault"
node standalone/dist/cli.js serve --vault "standalone/demo-vault" --port 4173
```

## State

```text
<vault>/.interestseed/config.json
<vault>/.interestseed/state.json
<vault>/.interestseed/experiments.json
<vault>/.interestseed/key        optional, gitignored
```

## Verification

```text
74 test files / 530 tests passing
npm run typecheck:standalone
npm run build:standalone
```

## Skill

`skill/SKILL.md` is the agent-facing contract. It instructs the agent to show one
suggestion, wait for connect / next / not now, and never write without confirmation.

## MCP

```bash
node mcp/server.mjs --graph "<vault>/.interestseed/state.json"
```

Read-only. The same MCP server also accepts the plugin's graph snapshot.

## Relationship to the plugin

The plugin remains a compatibility shell for people who want Obsidian-native
commands and sidebars. The standalone core is the product: CLI, local web, and skill.
