# InterestSeed 1.7.1 — GitHub-grade command access

这一版不增加新概念，只把高频动作放到成熟开源工具都会放的位置：命令面板。

## 新增命令

```text
打开分享收件箱（Focus Deck）
打开 3/7 天验证行动
验证行动：今天做了
验证行动：只想过
验证行动：今天没做
```

可以在 Obsidian 里直接搜索：

```text
Ctrl/Cmd + P → InterestSeed
```

## 为什么

高星 Obsidian 插件通常不会逼用户记工具栏位置，而是：

- 命令面板优先；
- 快捷键由用户自己绑定；
- 不抢占默认快捷键；
- 高频动作有明确命令名；
- 危险动作有二次确认。

## 推荐快捷键

不设默认热键，避免和用户已有绑定冲突。

推荐手动绑定：

```text
记录一个兴趣火花      Ctrl/Cmd + Shift + S
打开分享收件箱        Ctrl/Cmd + Shift + I
验证行动：今天做了    Ctrl/Cmd + Shift + D
打开兴趣图谱          Ctrl/Cmd + Shift + G
```

完整说明：

```text
docs/commands.md
```

## 其他

- Focus Deck 底部增加呼吸空间；
- 收件箱保持一次一条；
- README 测试数量修正为 460；
- 文档补充命令面板入口。

## 验证

```text
52 test files
460 tests passing
typecheck / lint / build passing
```

实际命令验证：

```text
before: 0 条实验记录
执行“验证行动：今天做了”
after: 1 条实验记录
撤销后恢复: 0 条
```

AGPL-3.0-only.
