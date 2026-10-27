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

- 按 `subjectKeys` 聚合主题；
- 按 `projectKeys` 聚合项目；
- 建立主题×项目计数矩阵；
- 统计 active/accepted/corrected/low-value；
- 不读取正文、路径或证据文本。

### 2.2 探索面板

新增：

```text
src/ui/DiscoveryExplorerModal.ts
```

包含：

- 主题入口卡片；
- 主题×项目矩阵；
- 近 7 天反馈活动；
- 反馈分布；
- 可选 AI 探索解读。

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
  - 主题键；
  - 项目名称；
  - active/total 计数；
  - 日期与反馈数量；
- 不发送正文、路径、节点内容或原始证据；
- 返回严格 JSON：
  - summary；
  - opportunities（title / why / nextStep / themes）；
- 严格校验，不使用解释文本中猜测的 JSON；
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

## 4. 测试与质量

```text
typecheck       通过
test            41 文件 / 424 用例通过\n\nmain.js         408,677 bytes / D9CC9AF8BF1F27B03C8F0C7FA493D36F95E3922CFABBAB0EA967D61AAD739941\nstyles.css       44,187 bytes / 7EF7454D2139D8F806CAEBB587509FC4926A0DF1DDF3554C654AEDEEA163E727
lint            通过
build           通过
```

新增测试：

```text
tests/Exploration.test.ts
tests/ExplorationInsight.test.ts
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
