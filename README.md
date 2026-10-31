<div align="center">

<a href="assets/interestseed-launch.mp4"><img src="assets/interestseed-demo.gif" alt="InterestSeed 40 秒演示" width="360" /></a>

<h1>InterestSeed</h1>

<p><strong>Obsidian 里的兴趣验证器</strong></p>

<p>把一条收藏，变成 3 天真实行动；<br/>再用证据决定：继续，还是放下。</p>

<p>
  <a href="assets/interestseed-launch.mp4"><img alt="Demo" src="https://img.shields.io/badge/%E2%96%B6%2040%20%E7%A7%92%E6%BC%94%E7%A4%BA-111827?style=for-the-badge" /></a>
  <img alt="CI" src="https://github.com/lxc248/-interestseed/actions/workflows/ci.yml/badge.svg?branch=main" />
  <img alt="Release" src="https://img.shields.io/github/v/release/lxc248/-interestseed?style=for-the-badge" />
  <img alt="Tests" src="https://img.shields.io/badge/tests-520%20passing-22c55e?style=for-the-badge" />
  <img alt="Coverage" src="https://img.shields.io/badge/coverage-74.7%25-14b8a6?style=for-the-badge" />
  <img alt="License" src="https://img.shields.io/badge/license-AGPL--3.0-f59e0b?style=for-the-badge" />
</p>

<p>
  <a href="README.en.md">English</a> ·
  <a href="assets/interestseed-launch.mp4">40 秒演示</a> ·
  <a href="docs/tutorial.md">完整教程</a> ·
  <a href="docs/positioning.md">产品定位</a> ·
  <a href="https://github.com/lxc248/-interestseed/releases">下载</a>
</p>

</div>

---

> 大多数工具帮你**存下来**。  
> InterestSeed 帮你**验一下**。

我们并不缺收藏。缺的是收藏之后，真的做一次，然后诚实地说一句：还行，或者算了。

## 它和收藏夹到底差在哪

| | 收藏夹 | 双向链接笔记 | **InterestSeed** |
| --- | --- | --- | --- |
| 回答的问题 | 存在哪 | 和什么相关 | **值不值得做** |
| 成功标准 | 收集数量 | 连接数量 | **完成一次真实验证** |
| 结束状态 | 待读 | 一张网 | **继续 / 放下 + 下一步** |
| 默认动作 | 保存 | 链接 | **做一个小实验** |

收藏夹解决“别丢”，InterestSeed 想解决“别假装自己会做”。

它不优化“节点数”，它优化**决策完成率**。

## 它是怎么跑起来的

一条内容进来，只走一条路。

```text
Capture → Decide → Connect → Verify → Review → Next action
```

| 阶段 | 发生什么 |
| --- | --- |
| **Capture** | 分享收件箱接收短视频链接、文章摘录或笔记，一次只处理一条 |
| **Decide** | 留下并连接，或路过；路过也是有效决定 |
| **Connect** | 留下的小火花连接到已有兴趣，或长成新的兴趣 |
| **Verify** | 3 天 starter experiment，每天记录一次真实行动 |
| **Review** | 追加式观察时间线，记录证据与信念方向 |
| **Next action** | 显式生成 Markdown 兴趣路线，写清状态、证据和下一步 |

图谱不是产品，它是让每个决定可复查的**证据层**。

## 它长这样

先看四张图，基本就知道它在干什么。

<table>
  <tr>
    <td width="50%">
      <img src="assets/onboarding.png" alt="3 分钟冷启动" /><br/>
      <sub><b>3 分钟冷启动</b>：不需要先知道自己喜欢什么。</sub>
    </td>
    <td width="50%">
      <img src="assets/experiment.png" alt="3 天兴趣实验" /><br/>
      <sub><b>3 天实验</b>：每天一条真实证据，不自动编进度。</sub>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <img src="assets/plugin-cosmic.png" alt="宇宙图谱与下一步" /><br/>
      <sub><b>宇宙图谱</b>：节点、轨道、桥接与下一步。</sub>
    </td>
    <td width="50%">
      <img src="assets/share-card-xiaohongshu.png" alt="小红书分享卡" /><br/>
      <sub><b>本地分享卡</b>：五种平台规格，Canvas 本地渲染。</sub>
    </td>
  </tr>
</table>

## 你实际会用到什么

下面不是功能清单，是我每天真的会碰到的几个动作。

| 能力 | 说明 |
| --- | --- |
| **一次一条** | 分享收件箱支持列表与专注模式；`←` 路过，`→` 留下，不做批量处理 |
| **来源溯源** | 每条记录保留 source / sourceRef / capturedAt / status，可回到原笔记或外链 |
| **兴趣任务状态** | `captured → judged → connected → experimenting → reviewed`，由元数据与连接确定性推导 |
| **观察时间线** | 追加式证据，记录 `stronger / weaker / changed` 与日期，最多 40 条 |
| **3 天验证** | 时间盒实验，只记录真实发生的事，没有自动完成 |
| **上下文搜索** | 标题、标签、摘要、为什么、原文、来源路径、观察证据，多字段确定性搜索，无需 embedding |
| **兴趣路线** | 显式命令生成 Markdown MOC，从不自动写笔记 |
| **五种分享卡** | 小红书、Instagram、X、微信、Story，全部本地 Canvas 渲染 |
| **AI 关系建议** | 默认开启；引导窗口接入自己的 Key；只发节点 id、标题、标签，返回理由与置信度；候选关系确认后才写入 |
| **MCP 接口** | 零依赖只读 MCP server，协议 `2026-07-28` |
| **自适应布局** | 桌面、窄栏、极窄栏三档，图标优先，不横向溢出 |

## 装起来

三分钟能跑起来。

1. 从 [Releases](https://github.com/lxc248/-interestseed/releases) 下载 `interestseed-v3.3.0.zip`。
2. 解压到：

```text
<your-vault>/.obsidian/plugins/interestseed/
```

3. 确认目录里有 `main.js`、`manifest.json`、`styles.css`。
4. Obsidian → 设置 → 第三方插件 → 启用 **InterestSeed**。
5. 运行冷启动问卷，或记录第一条火花。
6. 处理分享收件箱，然后开始 3 天实验。

完整走查：[docs/tutorial.md](docs/tutorial.md)

## MCP

```bash
node mcp/server.mjs --graph "<vault>/.obsidian/plugins/interestseed/graphs/default.json"
```

```text
tools:      interestseed_get_graph / next_step / search_interest / get_experiment / get_context
resources:  interestseed://graph / experiment / next / context
prompts:    review-interest / plan-next-experiment
```

MCP 是只读的。核心功能不需要账号或模型凭据。  
AI 关系建议默认开启，只在你点击 AI 时请求所选模型；接入引导窗口可以填写自己的本地服务 Key，密钥存进 Obsidian 安全存储，不进入 data.json。不可用时会自动保留本地规则发现。

## 我把它做得多稳

这些数字不是装饰。每次改完，我都会重新跑一遍。

```text
520 tests passing
74.74% line coverage
92.25% core coverage
43.81% UI coverage
axe: graph / inbox / share-card 0 violations
semgrep: 0 findings
gitleaks: no leaks
CI + Release: green
```

```bash
npm install
npm run verify      # typecheck + tests + lint + build
npm run coverage
node --test mcp/smoke.test.mjs
```

要求 Node.js 22+。

## 几条不肯让步的原则

```text
Human-in-the-loop
Local-first
Explicit over automatic
Evidence over volume
Deterministic retrieval
```

InterestSeed 不抓取平台、不保存 cookie、不自动发布、不自动写图谱、不自动生成路线。  
决定权始终在用户手里。

## 文档

| 文档 | 内容 |
| --- | --- |
| [docs/architecture.md](docs/architecture.md) | 模块地图、数据流、不变量与扩展点 |
| [docs/tutorial.md](docs/tutorial.md) | 端到端使用教程 |
| [docs/positioning.md](docs/positioning.md) | 产品定位与竞品分析 |
| [docs/seed-sprint.md](docs/seed-sprint.md) | 冷启动设计 |
| [docs/view-modes.md](docs/view-modes.md) | 图谱 / 收件箱 / 发现三种视图的不变量 |
| [docs/context-packet.md](docs/context-packet.md) | 数据模型与任务状态 |
| [docs/share-cards.md](docs/share-cards.md) | 分享卡导出行为 |
| [docs/commands.md](docs/commands.md) | 命令面板参考 |
| [SECURITY.md](SECURITY.md) | 安全模型与漏洞披露 |

## License

AGPL-3.0-only. Author: [aicoder](https://github.com/lxc248).

如果你也有过“收藏了就等于学了”的错觉，欢迎试试它。  
觉得有用就 star；发现问题就提 issue；想一起改，先读 [CONTRIBUTING.md](CONTRIBUTING.md) 和 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。


