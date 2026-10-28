# InterestSeed 第三阶段：兴趣探索层实现与验收报告

> 日期：2026-10-27
> 范围：个人知识探索层（只读 + 可选 AI 解读）
> 原则：不改发现 Schema、不自动写图谱、不读取正文、不上传 Vault

## 1. 目标

第三阶段不把插件变成大平台，而是把已存在的发现数据组织成可探索的个人知识层：

- 从主题进入；
- 看主题 × 项目的分布；
- 看反馈时间趋势；
- 从主题回到发现面板筛选；
- 可选 AI 解读聚合数据，不替代证据。

## 2. 已实现

### 2.1 主题探索

新增 `buildExploration()`：

- 每个 `subjectKeys` 作为独立主题识别，多标签发现进入多个主题；
- 按 `projectKeys` 聚合项目，区分真实项目与“未归类项目”；
- 建立主题×项目计数矩阵；
- 统计 active / accepted / rejected / corrected / low-value；
- 计算跨项目扩散、接受率与信号强度；
- 不读取正文、路径或证据文本。

### 2.2 探索工作台

新增：

```text
src/ui/DiscoveryExplorerModal.ts
src/discovery/insights.ts
```

包含：

- 本地洞察卡：跨项目连接、势能、质量边界、覆盖缺口；
- “依据 → 判断 → 下一步”卡内结构；
- 主题入口卡片与跨项目/接受/低价值标签；
- 主题×项目热力矩阵、图例与主题筛选；
- 近 7 天反馈节奏图（0 值不画假柱）；
- 可选 AI 可解释解读；
- 键盘焦点、aria-live、图表摘要与窄屏适配。

### 2.3 主题联动

点击主题后：

```text
关闭探索面板
→ 打开发现面板
→ 只显示该主题的发现
→ 顶部显示主题筛选胶囊
→ 可一键清除
```

### 2.4 AI 解读

新增 `ModelProvider.explore()`：

- 仅在 `enableAI` + `aiConsentGranted` 时为可用；
- 请求只包含：
  - 匿名化主题别名；
  - 匿名化项目别名；
  - active/total、跨项目数、接受率、信号强度；
  - 日期与反馈数量；
- 不发送正文、路径、节点内容或原始证据；
- 返回严格 JSON：
  - summary；
  - reasoning（观察 → 推断 → 行动）；
  - confidence（模型自评）；
  - opportunities（title / why / nextStep / themes / evidence / confidence）；
- 严格校验，不使用解释文本中猜测的 JSON；
- AI 主题按请求白名单过滤，未知主题丢弃；
- 失败时回退到本地探索数据，不写任何状态。

### 2.5 命令与入口

```text
兴趣探索（只读/AI 可选）
```

快捷键操作条新增：

```text
探索
```

## 3. 合成设计实验

已运行 1,200 persona × 4 任务 × 6 设计 = 28,800 次合成试验。

结果摘要：

```text
纯列表成功 39.0%
主题卡片 52.4%
主题 + 矩阵 57.2%
主题 + 矩阵 + 趋势 58.7%
主题 + 矩阵 + AI 59.6%
完整探索层 61.0%
```

结论：

- 主题入口是最大收益；
- 矩阵适合独立探索页；
- 趋势是低风险增强；
- AI 是可选辅助，不是主路径。

完整方法、假设边界和结果：

```text
research/第三阶段_合成用户实验报告.md
research/phase3_simulation.py
research/phase3_simulation_results.json
```

第二轮独立实验：

```text
2,000 personas × 5 任务 × 6 设计 = 60,000 次试验
完整探索层成功率 58.3%（纯列表 27.2%）
边界组成功率 60.9%
```

报告：

```text
research/第三阶段_独立仿真实验V2.md
research/phase3_simulation_v2.py
research/phase3_simulation_v2_results.json
```

## 4. 测试与质量

```text
typecheck       通过
test            44 文件 / 434 用例通过

main.js         476,417 bytes / 140A94CC3D3B8C016188F447BA743193EB4543373401C817BB975BE87C2071E7
styles.css       70,053 bytes / 3374EB64AE51204EAFA32163C67007D075FDE9B5763CA4C4CC537BEF6A15AEEA
lint            通过
build           通过
```

新增测试：

```text
tests/Exploration.test.ts
tests/ExplorationInsight.test.ts
tests/ExplorationProperty.test.ts
tests/ExplorationRecognition.test.ts
```

## 5. 安全边界

- 无自动图谱写入；
- 无自动反馈修改；
- 无正文读取；
- 无 Vault 上传；
- AI 默认关闭；
- AI 只发送聚合数据；
- AI 返回不直接改变发现或图谱。

## 6. 当前状态

```text
第三阶段：探索层实现完成
AI：可选，受设置与授权控制
图谱：12 节点 / 18 边
```

## 7. 后续可选增强

- 保存探索视图；
- 主题趋势按月聚合；
- 项目画像；
- 从矩阵单元格直接打开对应发现/节点；
- 屏幕阅读器完整审计。

### 2.6 DSH Agent 工作台（桌面）

新增独立视图：

```text
src/ui/AgentView.ts
src/agent/DshAcpClient.ts
```

通过：

```text
InterestSeed UI
→ dsh --profile acp
→ ACP v1 JSON-RPC / stdio
→ DSH 的模型、工具、沙箱与权限
```

能力：

- 流式助手消息；
- 思考过程折叠；
- 工具调用状态卡；
- DSH 权限请求卡；
- 停止 / 新建会话；
- 当前 Vault 作为工作目录；
- DSH 自己持有模型与凭据，InterestSeed 不保存模型密钥。

设置项：

```text
DSH Agent 工作台（桌面）
启用 DSH Agent
DSH 命令（默认 dsh，可填本机绝对路径）
DSH profile（默认 acp）
```

未配置 DSH 模型 key 时，ACP 会返回明确的 provider/key 错误；本地探索与图谱不受影响。