# InterestSeed Skill

把用户保存的短视频、文章和碎片，变成一个可确认、可行动的宇宙兴趣星图。

## 安装到 Agent

把整个 `interestseed-skill/` 目录放进 Agent 的 skills 目录，或在 Agent 中打开本目录的 `SKILL.md`。

不要求安装 Obsidian。

## 生成星图

```bash
node skill/render.mjs \
  --graph graph.json \
  --out star-map.html \
  --title "我的兴趣星图"
```

打开 `star-map.html`：

- 行星节点；
- 轨道与星云；
- 能量连线；
- 搜索、筛选、缩放；
- 点击查看证据；
- 导出 PNG。

## 文件结构

```text
skill/
├── SKILL.md
├── render.mjs
├── schema/graph.schema.json
└── ../viewer/
    ├── index.html
    ├── cosmic.css
    ├── cosmic.js
    └── graph-data.js
```

`render.mjs` 会把 CSS、JS 和 JSON 全部内联成单文件，用户可以独立保存、发送、打开。

## Agent 使用原则

1. 只读用户主动分享的链接或文本；
2. 不抓取私密收藏；
3. 不保存 Cookie；
4. AI 只提出候选，用户确认后才写入；
5. 每条关系保留证据与置信度；
6. 7 天实验必须有每日真实观察。
