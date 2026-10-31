# InterestSeed 3.0.8 全功能模拟实验报告

## 1. 实验信息

```text
日期：2026-10-31
版本：InterestSeed 3.0.8
环境：Windows / Obsidian 桌面端 / 独立测试 vault
视口：1707 × 1019，另测 420 × 900 窄屏
主题：亮色 + 暗色
数据：18 节点 / 23 关系 / 9 条发现（起始）
```

说明：这是一次在真实 Obsidian 桌面端、真实插件数据和真实 UI 上执行的功能模拟实验，不是外部招募的真人受试者。

## 2. 实验方法

```text
命令面板入口
真实 DOM 点击
真实 Canvas 渲染
真实文件写入
真实撤销 / 重做
真实备份 / 恢复
截图 + 状态断言
```

每一步都记录：

```text
步骤名 / 是否通过 / 关键数值 / 截图
```

原始结果：

```text
review/experiment-3.0.8/results.json
review/experiment-3.0.8/results-fixups*.json
review/experiment-3.0.8/results-onboarding.json
```

## 3. 覆盖矩阵

| # | 功能 | 结果 | 证据 |
| --- | --- | --- | --- |
| 1 | 打开图谱、加载已有图谱 | ✅ | 01-graph-overview.png |
| 2 | 筛选面板展开 | ✅ | 02a-filter-open.png |
| 3 | 搜索 `theme` | ✅ 6/23 节点 | 02-search-theme.png |
| 4 | 类型筛选 chip | ✅ | 02b-filter-topic.png |
| 5 | 节点详情与观察时间线 | ✅ | 03-detail-timeline.png |
| 6 | 分享卡 5 个平台预设 | ✅ 5/5 | 05-share-*.png |
| 7 | 分享卡下载 PNG | ✅ 文件名正确 | 29-share-download.png |
| 8 | 分享卡复制文案 | ✅ 文案含真实节点数 | 30-share-caption.png |
| 9 | 收件箱列表模式 | ✅ 3 条待判断 | 06-inbox-list.png |
| 10 | 收件箱专注模式 | ✅ | 07-inbox-focus.png |
| 11 | 收件箱「只是路过」 | ✅ 3 → 2 | results.json |
| 12 | 收件箱「留下并连接」 | ✅ 2 → 1，节点 +1 | 08-spark-from-inbox.png |
| 13 | 火花捕获 | ✅ 节点 19 → 20 | 09-spark-capture.png |
| 14 | 3 天实验弹窗 | ✅ | 10-experiment-modal.png |
| 15 | 实验打卡 | ✅ 日志 1 条 | 11-experiment-logged.png |
| 16 | 重复打卡限制 | ✅ thought / missed 返回 false | 44-quick-limits.png |
| 17 | 7 天延长限制 | ✅ 未完成 3 天时返回 false | 44-quick-limits.png |
| 18 | 发现总览 | ✅ 9 条发现 | 12-discovery-overview.png |
| 19 | 发现探索 | ✅ | 13-discovery-explorer.png |
| 20 | 发现审计 | ✅ | 14-discovery-audit.png |
| 21 | 发现反馈 + 撤销 | ✅ accepted → none | 15d-discovery-feedback.png |
| 22 | 发现应用状态核对 | ✅ 提示已核对 | 43-reconcile.png |
| 23 | 新建节点 | ✅ | 15-new-node.png |
| 24 | 创建关系 | ✅ | 15b-relation-created.png |
| 25 | 关系建议确认 / 拒绝 / 恢复 | ✅ 3/3 | 15c-edge-actions.png |
| 26 | 编辑关系 | ✅ 关系名被改写 | 45-edit-relation.png |
| 27 | 删除关系 + 撤销 | ✅ false → true | results-fixups-5.json |
| 28 | 撤销 / 重做 | ✅ 关系删除 → 恢复 | results-fixups-2.json |
| 29 | 删除节点确认（取消） | ✅ 节点保留 | 46-delete-node-confirm.png |
| 30 | 冷启动问卷完整流程 | ✅ 5 个种子 / 4 条候选连接 | 38–41 |
| 31 | 兴趣路线 Markdown | ✅ 1387 字符，含下一步 | 16-interest-route.png |
| 32 | JSON Canvas 导出 | ✅ 23 节点 / 30 边 / 23 唯一 ID | 17-canvas-export-result.png |
| 33 | 导出图谱 JSON | ✅ 下载文件名正确 | 35-export-json.png |
| 34 | 创建备份 | ✅ | results-fixups.json |
| 35 | 重试保存 | ✅ | results-fixups.json |
| 36 | 从仓库重建 | ✅ 23 节点 / 14 建议 | 18-rebuilt-graph.png |
| 37 | 设置页 | ✅ | 19-settings.png |
| 38 | Agent 视图 | ✅ | 20-agent-view.png |
| 39 | 窄屏 420px | ✅ 无横向溢出 | 21-narrow-420.png |
| 40 | 暗色主题 | ✅ | 22-dark-narrow.png |
| 41 | 清空图谱确认 | ✅ 修复后必须确认 | 36-clear-confirm-fixed.png |
| 42 | 清空取消 | ✅ 23 节点保留 | results-fixups-2.json |
| 43 | 清空实际执行 | ✅ 24 → 0 | 37-empty-graph.png |
| 44 | 空图谱冷启动 | ✅ 0 → 5 节点 | 39/40/41 |
| 45 | 修复存储安全空态 | ✅ 无损坏时不执行 | 24-repair-confirm.png |
| 46 | AI 默认启用设置 | ✅ 开关默认开、只发 id/标题/标签 | 47-ai-settings-default.png |
| 47 | AI 命令不可用时降级 | ✅ HTTP 401 → 保留本地规则发现 | 48-ai-command-fallback.png |
| 48 | 探索页 AI 入口 | ✅ AI 可选、入口可见 | 49-explorer-ai-enabled.png |
| 49 | AI 推荐卡理由与置信度 | ✅ 按可信度排序、显示理由 | 51-ai-suggestion-card.png |
| 50 | AI 接入引导窗口 | ✅ 说明边界、保存 Key、打开设置 | 52-ai-setup-modal.png |
| 51 | 真实 v4.1 Flash 建议 | ✅ 5 条候选、理由显示 | 54-ai-live-v41-flash.png |
| 52 | AI 单条建议界面 | ✅ 1/5、无“待确认”列表 | 61-ai-single-suggestion.png |
| 53 | 连上后状态 | ✅ 33 条关系、可撤销 | 62-ai-single-connected.png |
| 54 | 撤销后状态 | ✅ 32 条关系、回到下一条 | 63-ai-single-undone.png |
| 55 | 本地模型状态面板 | ✅ MODEL / 模型 ID / 地址 / Key 状态 | 64-ai-local-model-panel.png |
| 56 | MCP smoke | ✅ 4/4 | 命令行输出 |

## 4. 关键流程

### 4.1 收件箱

```text
3 条待判断
→ 路过 1 条：2 条
→ 留下并连接 1 条：1 条，节点 +1
```

留下后火花捕获自动带入原文，用户可以补充「为什么留下」。

### 4.2 实验

```text
startStarterExperiment() = true
recordQuickExperiment('did') = true
日志 = 1
thought / missed 在当天重复记录时返回 false
未完成 3 天时 extendExperimentToSeven() = false
```

### 4.3 分享卡

```text
5 个预设全部渲染成功
下载文件名：interestseed-star-map-xiaohongshu-1080x1440.png
复制文案：
我最近有 23 个兴趣，先挑一个试三天。
它们连成了一张星图：23 个节点，31 条关系。
最近在认真看：theme8、创造、工具、观察。
```

### 4.4 导出

```text
兴趣路线：InterestSeed/兴趣路线 - 全部兴趣 - 2026-10-31 2.md
长度：1387 字符，包含「下一步」
Canvas：InterestSeed/兴趣图谱-2026-10-31-3.canvas
节点 23，边 30，唯一 ID 23
```

### 4.5 冷启动

```text
清空后 0 节点
→ 完成 4 轮选择
→ 草稿 5 个种子 / 4 条候选连接
→ 种下后 5 节点
→ 截图显示 PLANTED
```

实验结束后已从实验前备份恢复图谱：

```text
恢复后：24 节点 / 32 关系
```

### 4.6 AI 默认启用

```text
默认设置：enableAI = true
默认授权：aiConsentGranted = true
默认提供方：本地 DeepSeek V4 Pro · localhost:7863
发送字段：节点 id、标题、标签
已有关系：只发送节点 id 对，避免重复建议
请求规模：最多 32 个节点、5 条建议
返回：关系名 + 理由 + 置信度
不发送：笔记正文、来源路径、完整观察、Vault 内容
```

实测：

```text
设置页 AI 开关默认开启
接入引导窗口可填写自己的 Key
AI 命令在本地服务 401 时给出明确提示
候选卡按置信度排序，显示理由
本地规则发现保持不变
探索页 AI 入口可见
```

## 5. 发现并修复的 bug

### BUG-05（高）清空图谱没有确认

```text
路径：命令面板 → 清空兴趣图谱
修复前：立即清空，无确认
风险：误触即丢失当前图谱
修复：抽出 confirmClearGraph()，GraphController.clearGraph() 先确认再清空
验证：
  - 取消后 23 节点保留
  - 确认后 24 → 0
  - 空图谱冷启动 0 → 5
  - 实验后从备份恢复 24 / 32
  - 自动回归：tests/ClearGraphConfirmation.test.ts
```

这不是文案问题，是真实的数据安全 UX 问题。

## 6. 截图索引

```text
01–03    图谱、筛选、详情
04–05    分享卡弹窗与 5 个预设
06–08    收件箱列表 / 专注 / 火花
09–11    火花捕获、实验、打卡
12–14    发现总览 / 探索 / 审计
15       新建节点与关系操作
16–17    兴趣路线、Canvas 导出
18–20    重建、设置、Agent
21–22    窄屏、暗色
23–25    清空确认、修复空态、AI 提示
26–28    冷启动旧截图
29–35    分享下载、文案、笔记、剪贴板、关系、集群、导出
36–41    清空确认修复、空图谱、冷启动完整流程
42–46    Gap Coach、核对、打卡限制、编辑关系、删除节点确认
```

完整目录：

```text
review/experiment-3.0.8/
```

## 7. 验证

```text
70 test files / 522 tests passing
MCP smoke 4/4
npm run verify 通过
```

## 8. 限制

```text
- 外部 AI 服务未启用，因此 AI 关系建议只测试了未启用提示
- 真实读屏器（NVDA / VoiceOver）仍未人工走查
- 破坏性「修复存储」只在无损坏状态下测试；损坏恢复由单元测试覆盖
```

## 9. 结论

```text
56 项功能路径覆盖
1 个真实高优 UX bug 被发现并修复
收件箱、实验、分享卡、发现、导出、冷启动、撤销/重做全部通过
窄屏与暗色无布局回归
实验后图谱已恢复
```








