# 真实抖音 → 美妆 / 运动 / 游戏 → 7 天试跑：完整仿真报告

> 执行日期：2026-10-29  
> 设备：Windows 桌面 + Obsidian 1.14.5 + 桌面抖音  
> 测试 Vault：`InterestSeed-4C11-Disposable`  
> 模拟时钟：2026-11-01 至 2026-11-07  
> 结论：14 个节点、14 条关系、3 天试跑完成后延长为 7 天、7 条有效记录、同日重复记录被拒绝。
>
> **说明**：截图里的日期使用测试时钟推进，不是伪造日志；每次记录仍由真实 Obsidian UI 写入，且 `canRecordToday` 仍按自然日拦截同日重复。

![真实抖音推荐流](real-life-sim-artifacts/01-douyin-feed.png)

## 0. 先真实刷一次抖音

我打开桌面抖音，停在公开推荐页。实际第一屏不是我预设的美妆，而是：

```text
英雄联盟 LPL：IG vs HLE
```

这很重要。真实推荐流不会按“我想成为谁”来排列，它会先给你它认为你会停下来的东西。

我没有把这一屏硬解释成美妆/运动/游戏，而是把它当作真实输入：

```text
我确实会停下来看游戏赛事
但我日常也会看美妆、运动和玩家社群
```

这也是 InterestSeed 需要解决的问题：不是让用户只看一个标签，而是把**多个真实兴趣**放在同一张图里，再决定哪一个值得继续。

## 1. 填资料：四步画像

截图：

```text
02-onboarding-intro.png
03-onboarding-mode.png
04-onboarding-flow.png
05-onboarding-magnet.png
06-onboarding-shape.png
```

我填写的资料：

| 问题 | 我的选择 |
| --- | --- |
| 现在的你 | 在几个兴趣间摇摆 |
| 什么让你忘记时间 | 做出一个东西 |
| 最近什么内容最容易停下来 | 美妆、穿搭、个人风格 |
| 你希望这张图先长成 | 一条探索路径 |

这不是“知识管理人格测试”。它是在现实生活里能说出口的四句话。

## 2. 草稿星图

![草稿星图](real-life-sim-artifacts/07-draft-review.png)

系统生成了：

```text
探索路径
美妆与风格
动手创造
正在探索的方向
7 天兴趣实验
```

我确认后写入：

![第一张星图](real-life-sim-artifacts/08-first-map.png)

## 3. 六个真实生活火花

第一张卡从真实分享入口进入，并连接到「美妆与风格」：

![美妆火花](real-life-sim-artifacts/10-spark-card-beauty.png)

随后六个火花全部通过同一个可见 UI 输入：

| 截图 | 我留下的内容 | 主题 |
| --- | --- | --- |
| `10b-spark-card.png` | 跑步 5 公里：我听什么、想什么 | 运动与身体 |
| `10c-spark-card.png` | 《塞尔达》开放世界：为什么我愿意绕路 | 游戏与虚拟世界 |
| `10d-spark-card.png` | 游戏化健身：把深蹲变成每日任务 | 运动与游戏 |
| `10e-spark-card.png` | 美妆镜头感：为什么有的妆在镜头里更贵 | 美妆与风格 |
| `10f-spark-card.png` | 周末羽毛球：我不是不爱运动，是不爱无聊 | 运动与身体 |
| `10g-spark-card.png` | 玩家社群：为什么我愿意在一个世界里待很久 | 游戏与虚拟世界 |

每一步都有截图，不把“API 写入”包装成用户点击。

## 4. 主题优先，而不是一打开就是 14 个行星

![主题优先](real-life-sim-artifacts/11-graph-cluster-first.png)

顶部出现主题轨：

```text
全部 14
身体轨道 3
实验轨道 1
兴趣起跑 4
游戏轨道 4
风格轨道 2
```

默认聚焦最大主题，点击「全部」才展开完整星图：

![全部主题](real-life-sim-artifacts/12-graph-all.png)

图上的长标题被压成短标签：

```text
早八底妆…
跑步 5 公里…
塞尔达开放世界…
```

完整标题、原始分享和“为什么留下”保留在右侧详情里。

## 5. 3 天试跑

![实验开始](real-life-sim-artifacts/13-experiment-start.png)

实验一开始是 7 天。我点击：

```text
先做 3 天试跑
```

![3 天试跑](real-life-sim-artifacts/14-experiment-3day.png)

这不是“降低标准”，而是承认上班族/学生真实的时间成本：先证明这件事会不会自然发生。

### Day 1

![Day 1 填写](real-life-sim-artifacts/15-day1-filled.png)

日志：

```text
早八用了一个更薄的底妆，发现我不舒服的不是卡粉，是总在比较别人。
兴趣 4/5 · 精力 3/5
```

记录后：

![Day 1 记录](real-life-sim-artifacts/16-day1-recorded.png)

同日再次打开：

![同日重复被拒绝](real-life-sim-artifacts/29-day1-same-day-locked.png)

```text
今天已经记录过了，明天再来。
```

### Day 2

![Day 2 填写](real-life-sim-artifacts/17-day2-filled.png)

```text
跑步 5 公里时没有听播客，发现我在想游戏里的路线，身体反而不累。
兴趣 4/5 · 精力 4/5
```

![Day 2 记录](real-life-sim-artifacts/18-day2-recorded.png)

### Day 3

![Day 3 填写](real-life-sim-artifacts/19-day3-filled.png)

```text
把深蹲写成每日任务后，我真的做了 20 个；游戏化对我有用。
兴趣 5/5 · 精力 4/5
```

![Day 3 记录](real-life-sim-artifacts/20-day3-recorded.png)

## 6. 完成 3 天后，主动延长到 7 天

![3 天完成](real-life-sim-artifacts/30-three-day-complete.png)

3 天平均：

```text
兴趣 4.3/5
精力 3.7/5
```

我点击「继续到 7 天」：

![延长到 7 天](real-life-sim-artifacts/31-extended-to-seven.png)

这不是系统自动续命，而是用户在看到 3 天证据后做的第二次选择。

## 7. Day 4–7

| 天 | 证据 | 兴趣 | 精力 | 下一步 |
| --- | --- | --- | --- | --- |
| Day 4 | 看塞尔达的地图设计，发现自己喜欢的是“可以绕路”，不是通关。 | 4 | 3 | 记录一次主动绕路 |
| Day 5 | 羽毛球输了，但我想再来一局；我喜欢的可能是来回的节奏。 | 4 | 2 | 约朋友周末再打 |
| Day 6 | 美妆视频里让我停下来的不是产品，是博主怎么讲自己的不自信。 | 3 | 3 | 写下自己真正想表达的一句话 |
| Day 7 | 今天没有完成计划，但我还是打开了一个游戏世界；兴趣不是任务。 | 3 | 2 | 把实验结论写进图谱 |

截图：

```text
21-day4-filled.png
22-day4-recorded.png
23-day5-filled.png
24-day5-recorded.png
25-day6-filled.png
26-day6-recorded.png
27-day7-filled.png
28-day7-recorded.png
```

## 8. 7 天完成

![7 天完成](real-life-sim-artifacts/32-seven-day-complete.png)

```text
7 天平均兴趣 3.9/5
7 天平均精力 3.0/5
7 条有效记录
```

这是一个比“我完成了挑战”更真实的结论：

> 美妆让我在意“别人怎么看我”；  
> 运动让我确认“我不爱无聊，但爱来回的节奏”；  
> 游戏让我确认“我喜欢可以绕路的世界”。

三者不是三个标签，而是同一条线：

```text
我想要的不是更多内容
我想要一个可以自己选择路线的生活
```

## 9. 移动分享入口

![移动分享预填](real-life-sim-artifacts/33-mobile-share-prefilled.png)

新增两条入口：

```text
obsidian://interestseed-share?text=<encoded>
InterestSeed: 从剪贴板记录分享
```

手机快捷指令只需要把分享文本 URL 编码后打开 Obsidian URI。  
它仍然打开同一个判断卡，用户仍要自己点“留下这个火花”。

说明文档：

```text
docs/mobile-share.md
```

## 10. 最终图谱

![最终图谱](real-life-sim-artifacts/34-final-graph.png)

```text
14 个节点
14 条关系
0 个孤立节点
```

## 11. 这一轮暴露的问题

### 问题 1：真实抖音不会按你的兴趣画像出现

第一屏是 LPL，而不是美妆。  
这证明推荐流有价值，但不能直接把“刷到什么”当成“我是谁”。

产品应该继续保留：

```text
刷到 → 留下 → 判断 → 才是兴趣
```

### 问题 2：3 天完成后的按钮文案曾经是「继续 7 天」

这会让人以为要再跑 7 天。  
已改为：

```text
继续到 7 天
```

### 问题 3：主题轨刚出现时，视觉状态需要更明确

现在有：

```text
全部
身体轨道
游戏轨道
风格轨道
实验轨道
```

默认聚焦最大主题；点「全部」展开完整星图。  
仍需要在下一轮观察用户是否会忽略主题轨。

### 问题 4：实验弹窗的日志区需要滚动

7 天日志不会一次全部显示，需要滚动查看。  
这比把弹窗撑到很长更好，但需要明确提示“可滚动”。

### 问题 5：短视频内容仍然只有标题和分享文本

这轮没有抓取视频字幕，也没有伪造摘要。  
所以：

```text
“为什么留下”仍然需要用户自己写一句
```

这是有意的边界，不是缺陷。

## 12. 结论

这轮最重要的不是“完成了 7 天”，而是：

```text
3 天试跑 → 看到证据 → 用户主动延长 → 7 天完成
```

以及：

```text
美妆、运动、游戏不是三个孤岛
它们能在同一张图里形成一条真实的生活线
```

我会继续用，但前提是：

1. 默认先给我主题，不先给 14 个行星；
2. 3 天试跑后，延长必须是用户选择；
3. 短视频只能提供标题时，明确告诉我“这只是一条候选”，不要假装懂内容。

---

## 截图索引

```text
01-douyin-feed.png                 真实桌面抖音推荐流
02-onboarding-intro.png            onboarding 开场
03-onboarding-mode.png             资料：现在的你
04-onboarding-flow.png             资料：什么让你忘记时间
05-onboarding-magnet.png           资料：美妆/穿搭/风格
06-onboarding-shape.png            资料：一条探索路径
07-draft-review.png                草稿星图确认
08-first-map.png                   第一次写入
09-map-after-onboarding.png        图谱初始状态
10-spark-card-beauty.png           第一个美妆火花
10b–10g-spark-card.png             六个真实生活火花
11-graph-cluster-first.png         主题优先
12-graph-all.png                   展开全部主题
13-experiment-start.png            7 天实验开始
14-experiment-3day.png             切换到 3 天试跑
15–16-day1-*.png                   Day 1
29-day1-same-day-locked.png        同日重复被拒绝
17–18-day2-*.png                   Day 2
19–20-day3-*.png                   Day 3
30-three-day-complete.png          3 天复盘
31-extended-to-seven.png           延长到 7 天
21–28-day4-7-*.png                 Day 4–7
32-seven-day-complete.png          7 天复盘
33-mobile-share-prefilled.png      移动分享预填
34-final-graph.png                 最终图谱
```
