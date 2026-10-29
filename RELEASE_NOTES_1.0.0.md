# InterestSeed 1.0.0 — 你的第一张兴趣星图

**你不需要先知道自己喜欢什么。做四个选择，长出第一张会生长的兴趣星图。**

## 新体验

- **兴趣起跑**：4 个选择 → 5 个种子、4–6 条带证据的候选连接、1 个意外连接、1 个 7 天实验；
- **兴趣火花**：粘贴短视频链接或一句话，把一次短暂好奇变成图谱种子；
- **图谱缺口教练**：从孤立节点和桥接节点出发，补一条真实连接；
- **严谨的 7 天兴趣实验**：每日真实观察、兴趣强度/精力评分、一天一条记录，7 条完成才复盘；
- **Agent 单入口**：通过 DSH ACP 连接你自己的 Agent、工具、沙箱和权限；
- **宇宙星图（插件内默认）**：Obsidian 打开即见行星、轨道、星云、粒子流和动态 HUD；
- **Agent Skill 便携星图**：Skill 仍可生成单文件 `star-map.html`，供没有 Obsidian 的用户使用。

## Agent Skill（无 Obsidian 时的便携输出）

下载 `interestseed-skill-v1.0.0.zip`，把目录放进用户 Agent 的 skills 目录，阅读 `SKILL.md`，即可生成 `star-map.html`。

## 核心原则

> **AI 提案，不替你决定。**

每条关系都保留 `origin`、`status`、`confidence`、`evidence`；草稿默认不写回，写入可撤销。

## 演示

- [40 秒产品片](https://github.com/lxc248/-interestseed/releases/download/v1.0.0/interestseed-launch.mp4)
- [视频封面](https://github.com/lxc248/-interestseed/releases/download/v1.0.0/interestseed-launch-cover.png)
- [README](https://github.com/lxc248/-interestseed#readme)
- [Agent Skill 包](https://github.com/lxc248/-interestseed/releases/download/v1.0.0/interestseed-skill-v1.0.0.zip)

## 安装

把 `main.js`、`manifest.json`、`styles.css` 放入：

```text
<your-vault>/.obsidian/plugins/interestseed/
```

然后在 Obsidian → 第三方插件中启用。

## 验证

```text
49 test files
447 tests passing
typecheck / lint / build passing
```

## English

InterestSeed 1.0.0 is a 3-minute interest constellation builder for Obsidian. Four choices produce a confirmable draft graph with evidence-backed edges, a surprise connection, a mystery direction and a seven-day experiment. Capture sparks from short-video links, fill graph gaps, and grow the map through real action.

AI proposes; you confirm. Every edge keeps provenance, confidence and evidence, and the draft is never silently written back.

AGPL-3.0-only.
