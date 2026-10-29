# InterestSeed 1.0 发布与增长计划

## 目标

不是“做一个功能很多的插件”，而是让用户在一分钟内理解并想亲手试一次：

> 从 0 到一张会生长的兴趣星图。

北极星指标：

```text
首次 90 秒完成 5 个种子
首次 3 分钟确认 1 条关系
首次 5 分钟开始 1 个 7 天实验
```

10k 收藏/star 是结果指标，不直接作为产品目标。

## 发布包

- GitHub Release：`interestseed-v1.0.0.zip`
- 演示视频：`assets/interestseed-launch.mp4`
- 封面：`assets/interestseed-launch-cover.png`
- 截图：`assets/screenshot-1..3.png`、`assets/onboarding.png`
- 安装说明：README 手动安装
- Demo Vault：可选，后续单独发布（不包含个人数据）

## 首发渠道

### GitHub

- README 首屏：一句话 + 40 秒视频 + 3 分钟流程；
- Topics：`obsidian-plugin`、`knowledge-graph`、`interest-graph`、`personal-knowledge-management`、`ai-agent`；
- Release 说明包含“3 分钟冷启动问卷”和“火花捕获”。

### Obsidian 社区

- 论坛 Showcase 帖；
- Reddit：r/ObsidianMD / r/PKMS；
- 避免“AI 自动整理你的笔记”这种同质化表述，强调 **confirm-first interest graph**。

### 中文平台

- 小红书：视觉卡片 + “四个选择”；
- B 站：40 秒主片 + 3 分钟演示；
- 即刻 / V2EX：产品机制拆解；
- 公众号：长文《为什么 AI 不该替你决定兴趣》。

## 内容矩阵

| 内容 | 目的 | 入口 |
| --- | --- | --- |
| 40 秒主片 | 让人停下来 | 抖音 / 小红书 / GitHub |
| 3 分钟完整演示 | 让人理解流程 | B 站 / YouTube |
| “收藏夹困境”切片 | 引发共鸣 | 短视频 |
| “意外连接”切片 | 展示创新 | 短视频 |
| “7 天实验”挑战 | 促活 | 小红书 / 社群 |
| 架构与状态机长文 | 建立技术信任 | 公众号 / Dev.to |

## 首周动作

```text
Day 0  Release + 40 秒主片 + 3 张截图
Day 1  “收藏夹困境”切片
Day 2  “四个选择 → 星图”切片
Day 3  “意外连接”切片
Day 4  技术长文：confirm-first graph
Day 5  7 天实验挑战
Day 7  第一批用户反馈汇总
```

## 质量门槛

发布前必须全部通过：

```text
npm run verify
真实 Obsidian 安装
从 0 开始完成一次冷启动问卷
火花捕获 → 图谱节点
缺口教练 → suggested 关系
7 天实验 Day 1 → Day 2
撤销 / 重做
清空图谱后恢复
无 Key 时 Agent 不静默失败
```

## 诚实边界

- 不承诺“AI 自动替你建立完美图谱”；
- 不抓取短视频内容；
- 不上传用户笔记正文；
- 不伪造用户数量或排行榜；
- 10k star 取决于分发与产品价值，不能由代码保证；本计划只负责把产品、演示和入口做到足够好。
