# InterestSeed V0.1.0 发布说明

> 构建：`389,777 bytes / 0C8C017E...`
> 发布包：`release/interestseed-0.1.0.zip`
> 测试：39 文件 / 420 用例

## 本版能力

- Markdown 扫描与本地知识图谱；
- 双链、共享标签、主题关系建议；
- 关系确认、拒绝、恢复、编辑；
- 图谱撤销/重做、视口持久化、JSON 导出；
- 发现候选：跨目录共同主题与明确证据；
- 反馈：接受、拒绝、修正、低价值、待验证、软撤销；
- 发现应用：预览、修改关系、确认写入、existing 幂等、stale/调和；
- 发现审计、排序、反馈历史；
- 兴趣总览：反馈分布、主题分布、已应用关系、最近变化；
- Obsidian Modal 输入/确认，替代不可靠的 `window.prompt`/`window.confirm`；
- 发现与详情面板独立 DOM，关闭发现不残留。

## 安装

把压缩包解压到：

```text
<Vault>/.obsidian/plugins/interestseed/
```

确认包含：

```text
main.js
manifest.json
styles.css
```

然后在 Obsidian 第三方插件中启用 InterestSeed。

## 已知限制

- 未接入真实 AI；AI 入口默认关闭；
- 无跨进程文件锁，依赖单实例；
- 未做真实用户大规模质量评估；
- 键盘/屏幕阅读器只做了基础结构补强，未完成完整审计；
- 迁移与异常恢复仍需隔离 Vault 人工验收。

## 构建命令

```text
npm run typecheck
npm test
npm run lint
npm run build
scripts/check-team.ps1
scripts/quality-gate.ps1 -Scope code
scripts/quality-gate.ps1 -Scope release
```

## UI 更新

- 紫青品牌渐变头部与图标徽章；
- 带文字的快捷操作条：扫描、节点、建议、收件、撤销、重做、适应、发现、总览、导出；
- 筛选栏网格化，搜索/目录/标签输入不再横向溢出；
- 发现卡片按反馈状态使用强调色、悬浮层次和状态边框；
- 兴趣总览改为统计卡 + 分区面板；
- 修正/应用/确认弹窗统一 Obsidian 原生输入与按钮风格；
- 支持深色/浅色主题变量。
