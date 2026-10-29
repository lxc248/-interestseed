# InterestSeed 2.1.1 — 来源可追溯，菜单可读

这不是功能扩张，而是把 2.1.0 的上下文收件箱做完整。

## 1. 来源现在有具体路径

之前：

```text
Obsidian 笔记
```

现在内部保留：

```text
source: note
sourceRef: P2/theme-b-two.md
```

来源标签会带路径提示，后续可以继续做“打开来源”。

## 2. 笔记导入会清洗内容

从当前笔记加入收件箱时，会去掉：

```text
YAML frontmatter
Markdown 标题井号
多余空白
```

只保留标题和正文摘要。

## 3. “更多”菜单分组

原来 13 项平铺，现在分成：

```text
图谱
  重新扫描 / 新建节点 / 适应画布

关系
  刷新建议 / 待确认关系 / 撤销 / 重做

发现
  发现 / 兴趣总览 / 兴趣探索

导出
  导出 JSON / 导出分享星图
```

并修复了菜单被 quickbar 横向滚动裁切的问题。

## 4. 发布链路加固

Release workflow 改为：

```text
gh release create/edit
gh release upload --clobber
```

以后重复发布、补传资产、重跑 workflow 不会因为旧 asset id 失败。

## 5. 验证

```text
52 test files
461 tests passing
typecheck / lint / build passing
```

实际验证：

```text
打开 P2/theme-b-two.md
执行“把当前笔记加入分享收件箱”
text: theme-b-two Theme B Two ...
source: note
sourceRef: P2/theme-b-two.md
清理后 pending: 0
```

截图：

```text
review/2.1.1-note-source.png
review/2.1.1-more-groups-final.png
```

AGPL-3.0-only.
