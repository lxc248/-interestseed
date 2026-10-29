# InterestSeed 2.4.0 — 上下文搜索

这一版只学一个高星项目已经验证过的行为：**搜索应该找到“你想的那条”，而不是只匹配标题。**

## 新增

搜索范围从：

```text
标题
标签
摘要
```

扩展到：

```text
标题
标签
摘要
为什么留下
原始内容
来源路径
上下文来源
观察时间线
```

支持多词 AND：

```text
观察 今天
```

两个词都存在才命中。

搜索框提示：

```text
搜索标题、标签、来源、观察…
```

## 为什么不是更多入口

同赛道高星项目给出的信号：

- Smart Second Brain：搜索和图谱无 AI 也能用；
- Mem0：semantic + keyword + entity 多信号；
- Graphiti：时间化上下文；
- Waypoint：自动 MOC；
- Claudian：Agent 项目记忆；
- Bases：原生 table / kanban。

InterestSeed 已有：

```text
图谱
收件箱
时间线
任务状态
兴趣路线
MCP v2
```

缺的是“已经写下来的上下文能不能被找到”。

所以这一版不加按钮，只把搜索打通。

## 验证

```text
56 test files
471 tests passing
typecheck / lint / build passing
```

新增测试：

```text
搜索来源、为什么和观察时间线
```

## 边界

- 不做 embedding；
- 不调用 AI；
- 不改变写入规则；
- 不自动生成路线；
- 不镜像节点到 Markdown。

AGPL-3.0-only.
