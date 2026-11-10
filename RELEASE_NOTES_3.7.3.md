# InterestSeed 3.7.3

这一版把「从各个平台收集兴趣」做成了普通用户能用的功能。

## 新增：批量导入收藏

命令面板 → **批量导入收藏（书签 HTML / JSON / CSV）**

```text
支持格式
  浏览器书签 HTML      Chrome / Edge / Safari / Firefox 导出
  JSON                 含 B 站收藏结构 {data:{medias:[{title, bvid}]}}
  CSV                  需要 title 与 url 两列
  纯链接列表            一行一个 URL，行内可带标题
```

粘贴后先告诉你识别成什么格式、能导入多少条、文件内重复几条，确认后才写入。

**导入只进收件箱，不会直接改写星图。** 几百条旧收藏不该在你不看的情况下变成节点——你仍然一条条判断保留或放弃。

```text
单次上限 500 条
重复链接自动跳过
整批只落盘一次（不是 500 次写文件）
```

## 新增：23 个平台的来源识别

分享或粘贴链接时，现在能认出：

```text
国内   抖音 / TikTok / 快手 / 小红书 / B 站 / 微博 / 微信公众号 / 知乎 / 豆瓣 / V2EX
国外   YouTube / Vimeo / X / Instagram / Threads / Bluesky / Mastodon / Reddit /
       Pinterest / LinkedIn / Medium / Substack / GitHub
其他   任意网页与纯文本
```

识别后还会做链接规范化：

```text
去掉追踪参数（utm_* / spm_* / fbclid / share_* …）
去掉片段与末尾斜杠
参数排序，保证同一内容产生同一个 key
youtu.be/ID 自动改写为 youtube.com/watch?v=ID
短链（b23.tv / xhslink / v.douyin.com …）标记为待展开
```

**实际效果**：同一个视频的不同分享链接，在收件箱里只会出现一条，不再重复堆积。

## 改进：MCP 接口（给 AI 客户端用）

如果你用 Claude Desktop、Cursor、Cline 等工具读你的兴趣图谱：

```text
新增  HTTP 传输            --http 端口 + Bearer token，云端平台也能连
新增  写入工具（需 --write） 记兴趣 / 开实验 / 记日志 / 撤销 / 批量导入
```

写工具默认**关闭**，必须显式 `--write` 才出现。开启后也有限制：

```text
同名或同链接不重复创建
写前自动生成 .bak 备份
临时文件 + rename 原子写
一次只允许一个进行中的实验
每天只能记一条实验日志
误操作可撤销（节点与日志都可以）
```

## 修复

```text
安装说明里的包名错误   之前写 interestseed-v3.7.0.zip，实际资产名不同，第一步就下不到
官网 how-it-works 页   仍指向 4.0.9 的旧包名
教程文档包名          同上
```

## 数据兼容

- 无 schema 变化，3.7.2 的图谱、收件箱、实验可直接读取
- `minAppVersion` 仍为 1.5.0，`isDesktopOnly` 仍为 false

## 证据

```text
测试   928 passed（808 Vitest + 85 MCP + 35 Playwright）
覆盖率 行 88.09% / 分支 75.48% / 函数 87.38%
CodeQL 开放告警 0
CI     verify / e2e / size / mcp / CodeQL 全绿
```

## 仍未完成的

- 没有独立第三方安全审计
- 移动端行为目前只有静态与单元级验证，没有真机截图
- 抖音、小红书没有面向个人的读取收藏接口，导入依赖你自己导出的文件
