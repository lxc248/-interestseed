# InterestSeed 1.1.0 — 从“看到内容”到“下一步做什么”

**你不需要先知道自己喜欢什么。把刷到的内容留下，判断它和哪个兴趣有关，然后做一个小实验。**

## 这版解决的问题

1.1.0 是一次全局审计后的版本。学生和上班族两条真实仿真都暴露了同一个问题：

> 图谱很好看，但用户不知道自己下一步该做什么。

这次把“下一步”做成产品结构，而不是一句提示。

## 新体验

- **抖音 / 小红书分享分析**：识别平台、清理分享噪音、生成短标题、推断主题；
- **为什么留下**：分享卡片可选填真实理由，写入节点，下一次判断能看见；
- **一次只处理一个火花**：右侧给出“留下并连接 / 只是路过”，不让收件箱变成新的收藏夹；
- **NEXT 行动条**：任何打开插件的时候，只显示一个最重要的下一步；
- **实验行动归一**：实验条成为唯一“记录今天”的入口，NEXT 不再重复催促；
- **短标题图谱**：图上使用短标签，右侧详情保留完整标题和原始内容；
- **实验节点不再被误判为孤立节点**：它是系统生成的行动，不是待整理内容；
- **统一深色宇宙表面**：onboarding、火花、实验和工具栏都使用同一套玻璃表面。

## 视觉

- 中心星核 + 主题行星系统；
- 金色星座关系线；
- 气态行星、环行星、冷色小行星；
- 星云、星尘、粒子流；
- 深色玻璃 HUD；
- 移动端窄屏适配。

## 严格 7 天实验

- 一个自然日只能记录一次；
- 兴趣强度 1–5；
- 精力 1–5；
- 至少 4 个字的真实观察；
- 7 条有效记录才完成；
- 完成后展示平均值和复盘。

同日再次记录会被明确拒绝，不会伪造进度。

## 真实回归

```text
学生仿真：14 个节点 / 11 条关系 / Day 1 已记录
上班族仿真：13 个节点 / 12 条关系 / Day 1 已记录
同日再次记录：拒绝
```

证据：

```text
review/student-simulation.md
review/office-worker-simulation.md
review/sim-artifacts/
review/office-sim-artifacts/
```

## 验证

```text
50 test files
451 tests passing
typecheck / lint / build passing
```

## 安装

把 `main.js`、`manifest.json`、`styles.css` 放入：

```text
<your-vault>/.obsidian/plugins/interestseed/
```

然后在 Obsidian → 第三方插件中启用。

## Agent Skill

下载 `interestseed-skill-v1.1.0.zip`，放入用户 Agent 的 skills 目录，阅读 `SKILL.md`，即可生成单文件 `star-map.html`。

AI 提案，你确认。每条关系保留 `origin`、`status`、`confidence`、`evidence`，写入可撤销。

AGPL-3.0-only.
