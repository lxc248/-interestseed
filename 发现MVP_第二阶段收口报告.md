# InterestSeed 发现 MVP 第二阶段收口报告

> 日期：2026-10-27
> 性质：第二阶段收口；不启动第三阶段
> 构建：`390,495 bytes / 69530F47...`
> 测试：39 文件 / 420 用例

## 1. 第二阶段完成范围

第二阶段的目标是让 InterestSeed 从“展示已有图谱”进入“基于证据发现关系，并由用户完成反馈与应用”的闭环。

已完成：

- 跨目录 / 跨项目共同主题发现；
- 发现稳定 ID、去重键、抑制键、Schema v3；
- 发现持久化、写入队列、`.bak` 保护；
- 接受、拒绝、修正、低价值、待验证五种反馈；
- 反馈历史追加与软撤销；
- 修正内容独立保存，不覆盖原始 ID/证据；
- 低价值仅抑制当前发现，不扩大为全局屏蔽；
- 发现排序、审计、证据可解释展示；
- 应用到图谱的预览、关系修改、方向交换、冲突提示、existing 幂等、stale/调和；
- 兴趣总览：反馈分布、主题分布、应用关系、最近变化、近 7 天活动；
- 发现卡片键盘浏览（上下键 / Home / End）与焦点环；
- Obsidian Modal 输入与确认框替代不可靠的 `window.prompt` / `window.confirm`。

## 2. 文件级证据

目标发现：

```text
discovery_12333mp1h8nm91
feedbackStatus: low-value
status: dismissed
application: none
correction: 保留
feedbackHistory: undo → accepted → corrected → low-value
```

应用闭环目标：

```text
discovery_0hg9idd0ah462p
application: stale
测试关系 test-related-20261027 已清理
```

当前图谱：

```text
12 节点 / 18 边
related-to 12 / references 6
```

## 3. 质量门禁

```text
typecheck       通过
test            39 文件 / 420 用例通过
lint            通过
build           通过
check-team      通过
quality-gate code/release exit 0
```

## 4. 当前明确未完成

以下不属于第二阶段“发现功能闭环”的完成条件：

- 真实用户质量评估（需要授权样本）；
- 完整屏幕阅读器审计；
- 大规模图谱性能验证；
- 真实 AI 建议（默认关闭）；
- 跨进程文件锁。

## 5. 裁决

```text
第二阶段发现 MVP：完成并通过本阶段验收
第三阶段：不自动启动
```

后续进入插件发布维护与真实使用反馈阶段；不得因本报告自动重开已关闭的 T2-B / DISC-012 / 4B 阶段。
