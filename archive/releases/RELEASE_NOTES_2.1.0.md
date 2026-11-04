# InterestSeed 2.1.0 — 来源感知的上下文收件箱

这一版学习 Buddy One 的“上下文连续性”，但不做中心化账号、不做积分、不做平台锁定。

## 新增：Context Packet 的第一层

收件箱现在不仅保存文字，还保存来源：

```text
分享
剪贴板
Obsidian 笔记
```

每条待判断内容会显示来源标签。

## 新增命令

```text
把当前笔记加入分享收件箱
```

使用方式：

```text
打开一篇 Markdown 笔记
→ Ctrl/Cmd + P
→ 搜索 InterestSeed
→ 把当前笔记加入分享收件箱
```

内容会进入同一个判断队列，并标记来源为：

```text
Obsidian 笔记
```

不会自动写图谱。

## 为什么不是“接更多平台”

Buddy One 的核心不是接更多 App，而是：

- 同一身份；
- 共享上下文；
- 任务连续；
- 来源可追溯；
- 权限明确。

InterestSeed 只取其中适合本地工具的部分：

```text
同一份内容
→ 同一个收件箱
→ 同一个判断
→ 同一条图谱路径
```

不引入腾讯账号、积分、会员或云端锁定。

## 数据兼容

- 旧收件箱数据自动视为 `share` 来源；
- 新来源字段随收件箱一起持久化；
- 关闭 Obsidian 后仍然保留；
- 去重逻辑不变。

## 验证

```text
52 test files
461 tests passing
typecheck / lint / build passing
```

实际验证：

```text
打开 P2/theme-b-two.md
执行“把当前笔记加入分享收件箱”
收件箱出现 1 条
来源显示：Obsidian 笔记
清理后 pending: 0
```

截图：

```text
review/2.1.0-note-inbox.png
```

## 文件

```text
src/inbox/ShareInbox.ts
src/ui/ShareInboxModal.ts
src/main.ts
src/plugin/commands.ts
tests/ShareInbox.test.ts
```

AGPL-3.0-only.
