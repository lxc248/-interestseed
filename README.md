# InterestSeed

**把散落在 Vault 里的笔记，长成一张可确认、可追溯、可行动的兴趣图谱。**

[简体中文](README.md) · [English](README.en.md)

![InterestSeed 兴趣图谱](assets/screenshot-1.png)

<p>
  <img alt="Obsidian" src="https://img.shields.io/badge/Obsidian-1.5%2B-7c3aed" />
  <img alt="Version" src="https://img.shields.io/badge/version-0.1.1-0ea5e9" />
  <img alt="Tests" src="https://img.shields.io/badge/tests-437%20passing-22c55e" />
  <img alt="License" src="https://img.shields.io/badge/license-AGPL--3.0-f59e0b" />
</p>

---

## 1. InterestSeed 是什么

InterestSeed 不是一个“把 AI 塞进侧边栏”的聊天壳，也不是又一个关系图视图。

它是一套面向 **Obsidian 本地知识库** 的兴趣工作台：

```text
Markdown 笔记
    ↓ 扫描 / 解析 / 类型识别
可追溯的节点与关系
    ↓ 规则发现 / 证据 / 人工确认
发现收件箱
    ↓ 接受 / 拒绝 / 修正 / 低价值 / 待验证
图谱变更 + 反馈记忆
    ↓ 本地聚合 / 匿名化 / 可选 AI
主题、项目矩阵、节奏与下一步
    ↓ 千问 / 可选 DSH Agent
读 Vault、调用工具、执行下一步
```

它解决的核心问题不是“笔记不够多”，而是：

> 你写了很多，但不知道什么正在重复出现、什么值得继续、什么只是噪音。

InterestSeed 把这些信号变成可确认的结构，而不是让模型直接替你改图谱。

---

## 2. 为什么它和普通“AI 笔记插件”不同

| 常见做法 | InterestSeed 的选择 |
| --- | --- |
| 让模型直接生成关系并写回 | 关系默认是 `suggested`，必须人工确认 |
| 只给一个聊天气泡 | 图谱、发现、探索、Agent 是同一套工作流 |
| 拒绝一次后下次继续推荐 | `rejected` 被持久记录，后续不再反复打扰 |
| AI 读取整篇笔记 | 默认只发送匿名化主题/项目聚合，正文不出 Vault |
| 只展示“相关” | 每条关系都有 `origin`、`status`、`confidence`、`evidence` |
| 一键应用，失败后状态不明 | `applying / applied / existing / failed / stale / recovery-required` 全状态机 |
| 只能靠模型回答 | 本地规则洞察永远可用，AI 只是增强层 |
| Agent 是另一个插件 | DSH Agent 通过 ACP 接入同一套 Vault 上下文 |

---

## 3. 核心能力

### 3.1 图谱基础：可解释，而不是“看起来相关”

- 通过 `Vault.getMarkdownFiles()` 与 `MetadataCache` 扫描 Markdown；
- 按 frontmatter `type`、`project`、`activity` 与文件扩展名识别节点类型；
- 解析双链、共享标签、用户定义主题，生成候选关系；
- 每条边保留：
  - `origin`: `user` / `rule` / `ai`
  - `status`: `confirmed` / `suggested` / `rejected`
  - `confidence`
  - `evidence`
- 扫描产生的边默认是建议，只有确认后才进入正式图谱；
- 拒绝会留下抑制记录，避免反复推荐；
- 关系名称可编辑，但 ID、来源、状态保持稳定；
- 图谱与视口持久化，支持撤销 / 重做；
- 自定义 Canvas 画布，无运行时图形库依赖。

### 3.2 发现：带反馈记忆的候选引擎

发现不是“随机推荐”，而是一个有生命周期的对象：

```text
active → accepted / rejected / corrected / low-value / needs-verification
                         ↓
                    feedbackHistory
                         ↓
                   soft undo
```

- 跨项目共享标签、主题与已确认关系生成“共同主题”；
- 支持接受、拒绝、修正、低价值、待验证；
- 反馈可软撤销，历史不会被抹掉；
- 发现身份、去重与抑制键独立于展示文案；
- 发现独立于图谱保存，应用图谱需要明确确认；
- 应用失败不会把发现错误标成已应用；
- 支持 `existing`、`stale`、`recovery-required` 等恢复语义。

### 3.3 Explore Studio：从“数据”到“下一步”

探索面板不是统计报表，而是一个决策界面：

- **01 / Signals**：先看本地结论；
- **02 / Themes**：主题入口，按活动与跨项目扩散排序；
- **03 / Matrix**：主题 × 项目热力矩阵；
- **04 / Rhythm**：近 7 天反馈节奏；
- **05 / Explain**：可选 AI 解释。

每一张洞察卡都遵循：

```text
依据 → 判断 → 下一步
```

不是只告诉你“你有很多主题”，而是告诉你：

> 哪个主题正在跨项目扩散，哪条证据支持它，下一步可以做什么。

### 3.4 AI 后端：千问（DashScope）优先，DSH 可选

InterestSeed 的默认 AI 后端是 **千问 / DashScope OpenAI-compatible**：

```text
InterestSeed
    → https://dashscope.aliyuncs.com/compatible-mode/v1
    → qwen-turbo（可换成账户可用的千问模型）
```

- API Base URL、模型 ID 和用户自己的 Token 可在设置中配置；Token 写入 Obsidian SecretStorage，不写进 data.json；也支持 `DASHSCOPE_API_KEY` / `QWEN_API_KEY` 环境变量；
- Explore AI 只发送匿名化主题 / 项目别名、聚合计数和活动数据；
- Agent 的千问模式是直接对话，不读取 Vault、不持有本地工具权限；
- 没有密钥时会明确提示“未配置千问密钥”，不会偷偷回退或重试；
- 千问免费额度、模型可用性和限流由平台账户决定。

### 3.5 DSH Agent（可选）：把 Agent 放进 Vault

如果需要工具调用、沙箱和权限审批，可以额外启用 DSH Agent：

```text
InterestSeed UI
    → dsh --profile acp
    → ACP v1
    → DSH 的模型、工具、沙箱、权限
```

支持流式消息、思考过程、工具卡、权限卡、停止、新建会话和当前 Vault 工作目录。DSH 完全可选，不启用时千问对话、图谱和探索仍可用；DSH 自己管理模型与密钥。

### 3.6 本地优先与隐私边界

- 默认关闭 AI；
- 开启前需要明确同意；
- 探索 AI 只接收匿名化的主题 / 项目别名、聚合计数与活动数据；
- 不发送笔记正文、路径、摘要或完整 Vault；
- 本地规则洞察永远可用；
- 审计层只接受最小投影，不读取正文；
- 发现与图谱写入经过队列、备份、恢复与一致性检查；
- 所有高风险操作都有失败路径，而不是“静默成功”。

---

## 4. 产品壁垒：为什么不是“换个皮就能抄”

### 壁垒一：领域模型，不是一组页面

InterestSeed 的核心资产是数据契约与状态机：

- 发现身份 / 去重 / 抑制键；
- 五类反馈语义；
- 应用状态机；
- 边来源 / 状态 / 置信度 / 证据；
- 迁移与向后兼容；
- 失败恢复与一致性检查。

这些不是 UI 组件，不能通过复制一个卡片样式得到。

### 壁垒二：Human-in-the-loop 的安全闭环

大多数 AI 图谱产品把“生成”当成终点。InterestSeed 把“确认”当成起点：

```text
建议 → 证据 → 人工确认 → 应用 → 可撤销 → 可恢复
```

这条链路需要同时解决：

- 反馈记忆；
- 软撤销；
- 幂等写入；
- 应用失败回滚；
- 过期发现；
- 关系冲突；
- 队列失败；
- 迁移兼容。

### 壁垒三：图谱交互是产品，不是库调用

InterestSeed 使用自研 Canvas 交互层：

- 拖拽、平移、缩放、悬停高亮、邻居高亮；
- 实线 / 虚线 / 点线表达关系状态；
- 视口持久化；
- 大图性能与选择状态；
- 窄屏 / 侧边栏 / 移动端布局；
- 键盘与可访问性。

这类交互细节很难靠一个现成图库“配置”出来。

### 壁垒四：ACP Agent 的工程边界

Agent 工作台不是把终端输出贴进侧边栏：

- ACP 生命周期；
- NDJSON 流式解析；
- 工具调用状态；
- 权限请求；
- 会话取消；
- 子进程退出；
- 模型选择；
- Vault 工作目录；
- 桌面 / 移动端加载边界。

### 壁垒五：隐私与审计从第一天就是约束

不是“先收集，再补隐私政策”。InterestSeed 的默认值是：

- 不发送正文；
- 不保存模型密钥；
- 不自动改图谱；
- 不静默重试；
- 不把失败伪装成成功。

### 壁垒六：测试与部署门禁

当前质量基线：

```text
46 个 test 文件 / 437 个用例通过
typecheck / lint / build 全部通过
部署脚本先 verify，失败即中止
```

测试覆盖图谱、持久化、迁移、发现、反馈、审计、应用、撤销、性能、AI 展示与 Claudian 适配等关键路径。

---

## 5. 架构

```text
src/
├── core/              GraphStore / GraphSession / UndoManager / InsightEngine
├── discovery/         发现、反馈、主题、聚合、总览、探索
├── plugin/            GraphController / PersistenceService / commands
├── services/          ModelProvider / ClaudianProvider / AI 展示
├── storage/           GraphRepository / MigrationManager / PluginDataStorage
├── ui/                Canvas / DetailPanel / FilterBar / Explore Studio / Agent
├── agent/             DSH ACP client
└── types/             图谱与设置类型
```

关键数据流：

```text
Vault → GraphBuilder → GraphStore
                         ├─ GraphSession → Canvas
                         ├─ PersistenceService → storage
                         └─ DiscoveryEngine → DiscoveryRepository
                                                   ├─ feedback
                                                   ├─ application
                                                   └─ Explore Studio
```

---

## 6. 安装

### 手动安装

1. 下载 `release/interestseed-0.1.1.zip`；
2. 解压到：

```text
<Vault>/.obsidian/plugins/interestseed/
```

3. 确认包含：

```text
main.js
manifest.json
styles.css
```

4. 打开 Obsidian → 设置 → 第三方插件 → 启用 `InterestSeed`；
5. 打开 `兴趣图谱` 视图。

### 从源码构建

```bash
npm install
npm run verify
npm run deploy
```

`npm run deploy` 会先跑完整质量门禁，通过后才复制到隔离 Vault 并重建 release zip。运行前把 `INTERESTSEED_VAULT` 指向隔离 Vault；脚本不会把本机路径写进仓库。

---

## 7. 快速开始

1. 在设置中选择要包含 / 排除的文件夹；
2. 点击顶部 `扫描`；
3. 点击画布中的节点；
4. 在详情面板确认或拒绝建议；
5. 打开 `发现` 处理反馈；
6. 打开 `兴趣探索` 查看主题 × 项目矩阵；
7. 需要时打开 `Agent`，让 DSH 读取当前 Vault 并推进下一步。

首页提供四个可视化入口：

```text
Agent        兴趣探索        发现        总览
```

---

## 8. 命令与入口

| 入口 | 作用 |
| --- | --- |
| `打开兴趣图谱` | 打开主视图 |
| `打开 InterestSeed Agent（DSH）` | 打开 Agent 工作台 |
| `扫描` / `重新扫描` | 重建图谱 |
| `新建节点` | 从当前文件或手动创建节点 |
| `建议收件箱` | 查看全部待确认关系 |
| `发现` | 打开发现建议 |
| `兴趣总览` | 查看只读聚合总览 |
| `兴趣探索` | 打开 Explore Studio |
| `导出` | 导出当前图谱 JSON |
| `撤销` / `重做` | 回退 / 恢复图谱操作 |

---

## 9. 设置

### AI（实验，默认关闭）

- 千问 DashScope（默认）：`qwen-turbo`，密钥从 `DASHSCOPE_API_KEY` / `QWEN_API_KEY` 读取；
- 本地 OpenAI-compatible；
- 可选 Claudian 插件 API；
- 默认只发送匿名化主题 / 项目别名、聚合计数与活动数据；
- 失败不自动重试、不自动切换模型；
- 本地规则发现始终可用。

在 InterestSeed 设置的 **平台 API Key** 填写即可；也可以在 Windows 设置环境变量（不要把 Key 提交到仓库）：

```powershell
[Environment]::SetEnvironmentVariable("DASHSCOPE_API_KEY", "<your-key>", "User")
```

设置后完全退出并重启 Obsidian，让桌面进程继承新的环境变量。

### DSH Agent（可选，桌面）

```text
启用 DSH Agent
DSH 命令：dsh 或本机绝对路径
DSH profile：默认 acp
DSH 模型：provider/model；默认优先 `wodebody/cn:deepseek-v4.1-flash`（workbuddy2pi 本地入口）
```

DSH 自己负责模型与凭据；InterestSeed 不保存密钥。

### Obsidian CLI

设置页提供官方 Obsidian CLI 启用入口，便于使用 `obsidian-cli` skill 与自动化验收。

---

## 10. 安全与隐私承诺

- 不上传完整 Vault；
- 不把笔记正文发送给 Explore AI；
- 不自动修改发现或图谱；
- 不把 AI 建议当成事实；
- 不隐藏失败；
- 不在没有确认的情况下覆盖已有关系；
- 导出是显式操作；
- 所有写入经过应用路径与恢复机制。

详见 [SECURITY.md](SECURITY.md)。

---

## 11. 许可证、署名与品牌保护

InterestSeed 的代码、界面文案、交互设计、发现模型、测试夹具与文档是原创成果。

- 代码许可：[GNU AGPL-3.0](LICENSE)；
- 署名与再分发要求：[NOTICE](NOTICE)；
- 名称、图标与品牌使用边界：[TRADEMARKS.md](TRADEMARKS.md)；
- 引用信息：[CITATION.cff](CITATION.cff)。

AGPL-3.0 允许在相同许可证下学习、修改与再分发，但不允许把本项目改成闭源产品后对外提供网络服务而不公开修改。`InterestSeed` 名称与图标不随代码许可证授权；衍生项目必须使用不同名称与图标，并保留原始署名。

如果你希望在商业闭源产品中使用 InterestSeed，需要单独获得书面许可。

---

## 12. 贡献

欢迎问题、复现、测试用例与安全报告。提交前请先读 [CONTRIBUTING.md](CONTRIBUTING.md)。

请不要提交：

- 真实 Vault 内容；
- API Key、Cookie、token；
- 个人路径；
- 未脱敏的发现 / 图谱数据。

---

## 13. 状态

```text
Version: 0.1.1
Tests:   46 files / 437 cases
License: AGPL-3.0
```

InterestSeed 仍在快速演进。当前重点是：

1. 更稳定的跨项目发现；
2. 更强的 Explore Studio 可读性；
3. 更完整的 DSH Agent 权限体验；
4. 更清晰的迁移与恢复路径。

---

**InterestSeed 的目标不是替你思考，而是让你的兴趣结构变得可见、可验证、可行动。**
