# GitHub Skills / AI Integration Research

> 日期：2026-10-27
> 目标：确认 Obsidian 是否有可调用的原生 AI，并筛选能帮助 InterestSeed 开发、验证和优化的 GitHub 资源。

## 1. 结论先行

### Obsidian 核心没有公开的原生生成式 AI API

截至当前公开的 Obsidian 1.15 文档与 API：

- `obsidian-api` 的 `obsidian.d.ts` 没有 AI / chat / completion / prompt API；
- 1.15 changelog 没有新增原生 AI 能力；
- 官方 roadmap 也没有“内置 AI”条目；
- Obsidian 的 AI 能力目前来自 **社区插件** 或 **外部模型服务**。

因此不能在本插件里直接调用一个不存在的 `app.ai`。可选接入方式是：

1. **Claudian 插件 API（实验 v1）**：把提示发送到已安装 Claudian 的当前会话，读取最终回复；
2. **本地 OpenAI-compatible 服务**：Ollama、LM Studio、自建网关等；
3. 保留本地规则洞察，不依赖任何 AI。

### 已实现的代码接入

新增：

```text
src/services/ClaudianProvider.ts
```

- 检测 `app.plugins.getPlugin('realclaudian')`；
- 校验 `api.version === 1`；
- 使用当前活动会话；
- 发送匿名化聚合提示；
- 监听 `claudian:turn-ended`；
- 读取最终回复并走严格 JSON 解析；
- 90 秒超时；
- 未安装、未启用、无活动会话时给出明确错误。

设置中新增“AI 运行后端”：

```text
本地 OpenAI-compatible
Claudian 插件 API（实验）
```

## 2. GitHub 资源筛选

| 仓库 | Stars（采样） | 定位 | 对 InterestSeed 的价值 | 决策 |
|---|---:|---|---|---|
| [kepano/obsidian-skills](https://github.com/kepano/obsidian-skills) | 50k+ | Obsidian CEO 维护的 Agent Skills 集合 | `obsidian-cli` 可直接用于 reload、截图、查控制台、DOM/CSS 检查；`obsidian-markdown` 帮助维护文档 | **已安装到 `~/.codex/skills`** |
| [YishenTu/claudian](https://github.com/YishenTu/claudian) | 15k+ | 在 Obsidian 内嵌 Claude Code / Codex / OpenCode 等代理 | 有公开 experimental Plugin API，可让 InterestSeed 复用用户已有的 AI 会话 | **已实现可选适配器** |
| [logancyang/obsidian-copilot](https://github.com/logancyang/obsidian-copilot) | 7.9k | 成熟的 Agent Chat / Quick Chat AI 插件 | 产品体验与 Agent 交互可借鉴；没有稳定的跨插件 API | 不作为硬依赖 |
| [brianpetro/obsidian-smart-connections](https://github.com/brianpetro/obsidian-smart-connections) | 5.5k | 本地 embedding 语义关联 | 可借鉴“相关笔记”识别；source-available 且有竞争限制 | 仅作识别基准，不嵌入 |
| [aaronsb/obsidian-mcp-plugin](https://github.com/aaronsb/obsidian-mcp-plugin) | 467 | MCP server | 适合把 Vault 暴露给外部 Agent | 非本阶段必需 |
| [MarkusPfundstein/mcp-obsidian](https://github.com/MarkusPfundstein/mcp-obsidian) | 4.5k | 外部 MCP 连接 Obsidian | 可用于未来 Agent 工具链 | 非本阶段必需 |
| [coddingtonbear/obsidian-local-rest-api](https://github.com/coddingtonbear/obsidian-local-rest-api) | 3k+ | 本地 REST API / MCP | 可作为未来无插件 API 的桥 | 非本阶段必需 |

## 3. 已安装的 Agent Skills

来自 `kepano/obsidian-skills`：

```text
~/.codex/skills/obsidian-cli
~/.codex/skills/obsidian-markdown
~/.codex/skills/json-canvas
~/.codex/skills/defuddle
```

最直接用于本项目的是 `obsidian-cli`：

```bash
obsidian plugin:reload id=interestseed
obsidian dev:errors
obsidian dev:screenshot path=screenshot.png
obsidian dev:dom selector=".workspace-leaf" text
obsidian dev:css selector=".interestseed-insight-modal" prop=width
```

注意：它要求 Obsidian 正在运行，并且 Obsidian 设置里启用 CLI。当前环境没有运行中的 Obsidian 进程，所以本轮无法执行真机 CLI 截图；构建、静态预览和测试仍已完成。

## 4. 推荐路线

```text
本地规则洞察（默认、永远可用）
→ 本地 OpenAI-compatible（可选）
→ Claudian 插件 API（可选，复用用户已有 AI 代理）
→ 未来 MCP / REST 适配（按需）
```

不把 Copilot 的内部实现当作公共 API，也不把 Smart Connections 的私有索引格式嵌入 InterestSeed。

## 5. 来源

- Obsidian API：https://github.com/obsidianmd/obsidian-api
- Obsidian 1.15 changelog：https://obsidian.md/changelog/2026-10-22-desktop-v1.15.0/
- Obsidian roadmap：https://obsidian.md/roadmap
- Obsidian Agent Skills：https://github.com/kepano/obsidian-skills
- Claudian：https://github.com/YishenTu/claudian
- Claudian Plugin API：https://github.com/YishenTu/claudian/blob/main/docs/plugin-api.md
- Copilot：https://github.com/logancyang/obsidian-copilot
- Smart Connections：https://github.com/brianpetro/obsidian-smart-connections

## 6. 本轮实际安装

- `kepano/obsidian-skills` 的 `obsidian-cli` / `obsidian-markdown` / `json-canvas` / `defuddle` 已复制到 `~/.codex/skills`。
- 隔离 Vault 已安装 **Claudian 2.3.35**：
  - 路径：`<Vault>/.obsidian/plugins/realclaudian/`
  - 已在 `community-plugins.json` 启用；
  - 仅作为可选后端，没有配置任何 Claude/Codex/OpenCode 凭据；
  - 首次使用需在 Claudian 内打开一个会话并完成其 provider 登录。

> 注意：Claudian 是第三方插件，不是 Obsidian 核心功能；启用它等同于允许它读取所选会话/vault 上下文。InterestSeed 只在用户点击“生成可解释解读”时调用其 API。