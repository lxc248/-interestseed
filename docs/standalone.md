# Standalone

InterestSeed 可以脱离 Obsidian 插件运行。  
Obsidian vault 只作为 Markdown 数据层：读取 `.md`、frontmatter、标签、链接，不调用 Obsidian API。

## 交付形态

```text
CLI         interestseed scan / suggest / connect / serve
Local Web   http://127.0.0.1:4173
Agent Skill standalone/skill/SKILL.md
Storage     <vault>/.interestseed/
```

## 快速开始

```bash
npm run build:standalone

node standalone/dist/cli.js init --vault "<vault>"
node standalone/dist/cli.js scan --vault "<vault>"
node standalone/dist/cli.js serve --vault "<vault>" --port 4173
```

打开：

```text
http://127.0.0.1:4173
```

## 命令

```bash
# 初始化并扫描
node standalone/dist/cli.js init --vault "<vault>"

# 只扫描
node standalone/dist/cli.js scan --vault "<vault>"

# 把一条收藏写入 vault 收件箱
node standalone/dist/cli.js capture --vault "<vault>" \
  --title "一条收藏" --url "https://example.com" --text "为什么想保存它"

# 收件箱：先排队，再决定留下还是放回
node standalone/dist/cli.js inbox add --vault "<vault>" --text "一条想验证的收藏"
node standalone/dist/cli.js inbox keep --vault "<vault>" --id "<inbox-id>"

# 跨目录发现
node standalone/dist/cli.js discoveries refresh --vault "<vault>"
node standalone/dist/cli.js discoveries apply --vault "<vault>" --id "<discovery-id>"

# 查看状态
node standalone/dist/cli.js status --vault "<vault>"

# 以某个节点为焦点，让 AI 给一条建议
node standalone/dist/cli.js suggest --vault "<vault>" --node "<node-id>"

# 用户确认后写入
node standalone/dist/cli.js connect --vault "<vault>" \
  --source "<id>" --target "<id>" --relation "共享方法" \
  --reason "两者都在讨论如何让人愿意开始。"

# 开始 3 天实验
node standalone/dist/cli.js experiment start --vault "<vault>" \
  --title "AI 工具 × 习惯" --node "<id>" --days 3

# 记录今天的真实观察
node standalone/dist/cli.js experiment log --vault "<vault>" \
  --id "<experiment-id>" --interest 4 --energy 4 \
  --evidence "今天用 AI 整理了三篇旧笔记。"
```

## AI 配置

```text
.interestseed/config.json
  model      默认 cn:deepseek-v4.1-flash
  baseUrl    默认 http://localhost:7863/v1
  keyEnv     INTERESTSEED_AI_API_KEY
```

Key 来源：

```text
1. 环境变量 INTERESTSEED_AI_API_KEY
2. .interestseed/key（本地便捷方式，不要提交）
```

只发送：

```text
节点 id
标题
标签
已有关系 id 对
```

不发送：

```text
笔记正文
来源路径
完整观察
Vault 内容
```

## 状态

```text
<vault>/.interestseed/config.json
<vault>/.interestseed/state.json
<vault>/.interestseed/experiments.json
<vault>/.interestseed/key
```

`state.json` 是图谱状态，不写回用户笔记。  
实验和观察后续会以 append-only Markdown 形式写入 vault。

## Skill

Agent 使用：

```text
standalone/skill/SKILL.md
```

Skill 的行为契约：

```text
一次只展示一条建议
必须等用户选择：连上 / 换一个 / 先不用
只有用户确认后才写入
不自动改笔记
```

## 与插件的关系

插件保留为 Obsidian 原生兼容壳：

```text
侧边栏
命令面板
文件右键
Obsidian 安全存储
```

独立版是产品主体：CLI + Web + Skill。  
插件和独立版共享同一套图谱/AI 核心，不重复实现规则。
