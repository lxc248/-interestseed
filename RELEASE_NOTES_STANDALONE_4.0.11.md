# InterestSeed Standalone 4.0.11

这一版把「批量导入收藏」带进独立版，并修掉一个会悄悄丢数据的缺陷。

## 新增：`inbox import`

```bash
interestseed inbox import --file ~/Downloads/bookmarks.html --vault "/path/to/vault"
interestseed inbox import --text "title,url
陶艺,https://www.xiaohongshu.com/explore/65abc" --vault "/path/to/vault"
```

支持四种导出格式：

```text
浏览器书签 HTML      Chrome / Edge / Safari / Firefox 导出
JSON                 含 B 站收藏结构 {data:{medias:[{title, bvid}]}}
CSV                  需要 title 与 url 两列
纯链接列表            一行一个 URL，行内可带标题
```

输出：

```json
{ "ok": true, "format": "csv", "parsed": 2, "added": 2,
  "duplicates": 0, "duplicatesInFile": 0, "truncated": false }
```

与插件共用同一份解析逻辑，所以两边接受的格式完全一致。

## 新增：`POST /api/inbox/import`

```http
POST /api/inbox/import
{ "text": "<导出文件全文>" }
```

非法输入返回 **400** 并带上可读原因，而不是 500。

## 新增：web 界面导入面板

`interestseed serve` 打开页面后，分享收件箱里有可折叠的「批量导入收藏」，
粘贴内容后点一次即可，结果用 toast 反馈导入条数与重复条数。

## 修复：收件箱重启后忘记来源

`ShareInbox` 保存时会写入 `sourcePlatform` 与 `canonicalUrl`，但读取时只还原了
`id / text / addedAt / status / source`。后果是**服务重启后，收件箱里所有条目
都忘了自己来自抖音还是小红书**——导入时识别正确，一落盘就丢。

现在这两个字段会正确恢复，并且对文件里的脏数据（例如 `sourcePlatform: 42`）
做类型校验后丢弃，而不是盲信。

## 数据兼容

- 无 schema 变化，4.0.10 的 state / inbox / 实验文件可直接读取
- 收件箱条目新增的两个字段是可选字段，旧条目没有也能正常工作

## 证据

```text
测试   944 passed（820 Vitest + 85 MCP + 39 Playwright）
覆盖率 行 88.00% / 分支 75.41% / 函数 87.40%
CodeQL 开放告警 0
CI     verify / e2e / size / mcp / CodeQL 全绿
```

## 仍未完成的

- 没有独立第三方安全审计
- 抖音、小红书没有面向个人的读取收藏接口，导入依赖你自己导出的文件
