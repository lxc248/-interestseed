# 接入平台清单（本地识别，不联网）

`src/services/ingest.ts` 负责「这条内容从哪来」，全部是纯文本处理：不抓页面、不调平台接口、不需要授权。

## 一、支持的平台

| 平台 | 域名 | 类型 | 短链 |
| --- | --- | --- | --- |
| 抖音 | `douyin.com` | 视频 | `v.douyin.com` |
| TikTok | `tiktok.com` | 视频 | `vm.tiktok.com` |
| 快手 | `kuaishou.com` | 视频 | `v.kuaishou.com` |
| 小红书 | `xiaohongshu.com` `rednote.com` | 图文 | `xhslink.com` |
| B 站 | `bilibili.com` | 视频 | `b23.tv` |
| 微博 | `weibo.com` `weibo.cn` | 帖子 | `t.cn` |
| 微信公众号 | `mp.weixin.qq.com` | 长文 | — |
| 知乎 | `zhihu.com` | 长文 | — |
| 豆瓣 | `douban.com` | 帖子 | — |
| V2EX | `v2ex.com` | 帖子 | — |
| YouTube | `youtube.com` | 视频 | `youtu.be`（自动改写为 watch 链接） |
| Vimeo | `vimeo.com` | 视频 | — |
| X | `x.com` `twitter.com` | 帖子 | `t.co` |
| Instagram | `instagram.com` | 图片 | — |
| Threads | `threads.net` | 帖子 | — |
| Bluesky | `bsky.app` | 帖子 | — |
| Mastodon | `mastodon.social` 等 | 帖子 | — |
| Reddit | `reddit.com` | 帖子 | `redd.it` |
| Pinterest | `pinterest.com` | 图片 | `pin.it` |
| LinkedIn | `linkedin.com` | 帖子 | `lnkd.in` |
| Medium | `medium.com` | 长文 | — |
| Substack | `*.substack.com` | 长文 | — |
| GitHub | `github.com` | 项目 | — |
| 其他网页 | 任意 `http(s)` | 网页 | — |
| 纯文本 | 无链接 | 文字 | — |

## 二、链接规范化做什么

```text
去掉追踪参数   utm_* / spm_* / fbclid / gclid / share_* / xsec_* / ref / si / feature …
去掉片段       #reply 之类
去掉末尾斜杠
参数排序       同一内容永远产生同一个 key（去重依赖它）
短链改写       youtu.be/ID → youtube.com/watch?v=ID
短链标记       b23.tv / xhslink / v.douyin.com 等无法离线展开的，标记 shortLink=true
```

规范化后同一个视频的不同分享链接会被识别为**同一条收件箱条目**，不会重复堆积。

## 三、明确不做的事

```text
不抓取平台页面
不调用平台私有接口
不读取你的账号收藏 / 点赞 / 观看历史
不保存任何 cookie 或登录态
```

原因：抖音、小红书、B 站都没有面向个人开发者的「读取收藏」接口。任何声称能自动同步你收藏的工具，要么有企业资质，要么在用非公开接口——后者会带来账号风险。

## 四、真正的接入方式是系统分享面板

```text
抖音里点分享 → 更多 → InterestSeed
→ obsidian://interestseed-share?text=...
→ 收件箱出现一条带平台标签的条目
```

一次配置，覆盖上表所有 App，且不需要任何平台授权。

## 五、后续可选增强（默认关闭，需用户同意）

```text
抓公开 OG 标签拿标题 / 封面 / 作者
展开短链
```

只在用户点击时执行，只读公开页面，不登录、不带 cookie。
## 六、在 Obsidian 里怎么用

命令面板 → **批量导入收藏（书签 HTML / JSON / CSV）**

```text
1. 在平台或浏览器里导出收藏
     Chrome / Edge / Safari → 导出书签（HTML）
     B 站收藏 → 用第三方导出工具得到 JSON
     Reddit saved / 表格整理 → CSV（需要 title 与 url 两列）
     任何纯链接清单 → 直接粘贴
2. 把文件内容粘进弹窗，先看识别结果和条数
3. 点「导入到收件箱」→ 逐条判断保留或放弃

导入只进收件箱，不会直接改写星图——几百条旧收藏不该在你不看的情况下变成节点。
```

上限与去重：

```text
单次最多 500 条
文件内重复链接只取第一条
收件箱本身有容量上限，超出会挤掉最旧的待处理项（已导入计数不受影响）
```

同一套解析逻辑在 MCP 侧也有（`interestseed_import_favorites`），由
`tests/importersParity.test.ts` 保证两份实现结果完全一致。
## 七、独立版（CLI / HTTP）

同一条解析逻辑也在独立版里，命令行：

```bash
interestseed inbox import --file ~/Downloads/bookmarks.html --vault "/path/to/vault"
# 或直接给内容
interestseed inbox import --text "title,url`n陶艺,https://..." --vault "/path/to/vault"
```

HTTP：

```http
POST /api/inbox/import
{ "text": "<导出文件全文>" }
```

返回：

```json
{ "ok": true, "format": "csv", "parsed": 2, "added": 2, "duplicates": 0,
  "duplicatesInFile": 0, "truncated": false }
```

与插件一致：只进收件箱、单次上限 500 条、重复链接跳过、输入无法识别返回 400。
