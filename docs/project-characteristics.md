# InterestSeed 项目特点与学习落点

## 一、项目特点

```text
1. 本地优先
   不上传、不假写；图谱保存在 vault，用户拥有全部数据。

2. 决策驱动
   分享收件箱一次处理一条：留下并连接，或只是路过。

3. 证据驱动
   3 天兴趣实验，用真实记录决定保留、升级还是放弃。

4. 视觉表达
   宇宙星图、分享卡、稀疏/密集自适应、焦点高亮。

5. 开放格式
   Markdown MOC、JSON Canvas、只读 MCP，全部可导出、可迁移。
```

## 二、已学习并落实的内容

| 学习对象 | 学到什么 | 落在项目哪里 | 版本 |
| --- | --- | --- | --- |
| cloudflare/security-audit-skill | 边界建模、只修 confirmed | 外链加固、MCP 边界、env 白名单、SHA256SUMS | 2.7.5 |
| kepano/obsidian-skills | Obsidian 开放格式 | JSON Canvas 导出 | 2.7.7 |
| antvis/G6 · sigma.js · d3 | 焦点高亮、视觉层次 | 选中节点时弱化无关节点/边/标签 | 2.7.8 |
| solidjs/solid · fastify/fastify | 派生值缓存、减少重复 I/O | stats 缓存、MCP 读图缓存 | 2.7.10 |
| dequelabs/axe-core · radix-ui/primitives | WCAG 扫描、焦点可见、状态播报 | focus-visible、aria-live | 2.7.12 |
| goldbergyoni/nodebestpractices | 集中错误处理、优雅退出 | MCP fail/toolFail、SIGINT/SIGTERM、uncaught 兜底 | 2.7.13 |

## 三、特点与学习内容的关系

```text
本地优先   → 安全审计：最小权限、不泄露路径
决策驱动   → 无障碍：每一步都有可读、可播报的下一步
证据驱动   → 工程化：失败不污染内存状态，保存失败可恢复
视觉表达   → 可视化：焦点高亮 + 帧预算
开放格式   → 开放标准：Markdown / Canvas / MCP
```

## 四、当前状态

```text
版本：2.7.13
测试：57 文件 / 472 通过
release：SHA256SUMS + pinned actions
```

## 结论

> InterestSeed 不是“笔记整理器”，而是本地优先、决策驱动、证据驱动的兴趣验证器。所有从高星项目学来的东西，都围绕这五个特点落地，而不是为了堆功能。
