# 截图清单与新鲜度（2026-11-10）

README 引用的图片，以及它们相对当前代码的新鲜度。数据来自仓库历史，不是估计。

## 一、README 实际引用的图

| 文件 | 最后改动 | 出现在 |
| --- | --- | --- |
| `assets/onboarding.png` | 2026-10-28（1.0.0 冷启动） | README.md / README.en.md |
| `assets/experiment.png` | 2026-10-29（工作区改为图谱优先） | README.md / README.en.md |
| `assets/plugin-cosmic.png` | 2026-10-29（同上） | README.md / README.en.md |
| `assets/standalone-ai.png` | 2026-10-31（链路说明调整） | README.md / README.en.md |
| `assets/share-card-xiaohongshu.png` | 2026-10-31（分享卡文案调整） | README.md / README.en.md |

## 二、与代码变更的对比

| 界面相关文件 | 最后改动 |
| --- | --- |
| `src/ui/AgentView.ts` | 2026-11-10（移动端提示） |
| `src/plugin/surfaces.ts` | 2026-11-10（移动端隐藏 Agent ribbon） |

**结论：不需要重拍。** 11-10 的两处改动只影响**移动端**：

```text
移动端不注册 Agent ribbon
移动端 AgentView 显示说明而不是输入框
```

以上截图全部是桌面端界面，桌面端行为没有变化（仍是三个 ribbon、Agent 面板正常）。所以这五张图依然准确。

## 三、真正的缺口：没有任何移动端截图

README 现在写了「移动端可安装」，但配图里**一张手机界面都没有**。这有两层代价：

```text
1. 用户无法在安装前判断手机上长什么样
2. 我无法自证移动端行为——只有真机截图能证明
```

这项我做不了：需要一台装了 Obsidian 的手机，装 3.7.2，截两张图：

```text
S1  手机上的图谱主页（证明能装、能打开）
S2  手机上点 Agent 后的说明页（证明不是白屏、不是死输入框）
```

建议命名 `assets/mobile-graph.png`、`assets/mobile-agent-notice.png`，放进 README「移动端可安装」那段。

## 四、其余未被 README 引用的图

`assets/` 下还有若干历史图（`social-card.png`、`screenshot-1..3.png`、`ai-*.png` 等），它们不被 README 或站点引用，属于历史素材。

不建议删除：其中几张被 `archive/` 里的历史报告引用，删除会造成死链。它们只占体积，不影响正确性。
