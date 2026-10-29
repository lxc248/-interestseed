---
name: interestseed-cosmic-map
description: Turn saved short-video links, notes and fragments into a living cosmic interest map without requiring Obsidian. Use when the user shares a Xiaohongshu/Douyin/Bilibili/YouTube link, asks to organize saved content into interests, or wants a visual star map.
---

# InterestSeed Cosmic Map

InterestSeed turns **saved content** into a confirmable interest constellation.

It is not a generic “summarize this link” skill. It maintains a graph with:

- seeds (interests);
- evidence-backed edges;
- feedback memory;
- a seven-day interest experiment;
- a standalone cosmic viewer.

## When to use

Use this skill when the user says things like:

- “把这条小红书/抖音/B站视频整理进我的兴趣星图”
- “我收藏了很多内容，帮我看看我到底在关注什么”
- “给我一张我的兴趣星图”
- “这件事和我的哪个兴趣有关？”
- “给我一个 7 天兴趣实验”

## Core workflow

```text
saved content
  → normalize into SavedItem
  → propose 1–3 seeds + 1–3 edges
  → show evidence and confidence
  → user confirms
  → write graph.json
  → render star-map.html + star-map.png
```

Never auto-write proposals. Every edge starts as `suggested` or is explicitly confirmed by the user.

## Commands

Run the renderer:

```bash
node skill/render.mjs \
  --graph path/to/graph.json \
  --out path/to/star-map.html \
  --title "我的兴趣星图"
```

The generated HTML is self-contained:

- no Obsidian;
- no CDN;
- no server;
- no tracking;
- can be opened in any modern browser;
- can be exported as PNG from the viewer.

## Output

```text
.interestseed/
├── graph.json
├── inbox/
├── proposals/
├── experiments/
└── rendered/
    ├── star-map.html
    └── star-map.png
```

## Proposal contract

For every saved item return:

```json
{
  "source": "xiaohongshu",
  "url": "https://...",
  "title": "...",
  "seeds": [
    {
      "title": "一个具体的兴趣",
      "type": "topic",
      "evidence": ["标题", "公开描述"],
      "confidence": 0.82
    }
  ],
  "relations": [
    {
      "source": "seed-a",
      "target": "seed-b",
      "relation": "可能连接",
      "evidence": "为什么这两件事可能有关",
      "confidence": 0.64
    }
  ]
}
```

## Seven-day experiment

An experiment is valid only when:

- one check-in per calendar day;
- evidence is at least 4 characters;
- interest and energy are scored 1–5;
- seven valid logs exist before `complete`.

## Platform boundaries

Do not use private cookies, reverse-engineered APIs, or bulk scraping.

Prefer:

1. the user's shared link/share text;
2. official APIs where available;
3. a user-installed MCP/browser bridge;
4. manual text fallback.

If a platform blocks metadata extraction, ask the user to paste the title and a short description. Never invent the content.

## Visual direction

The viewer is a cosmic map, not a chart:

- planets for seeds;
- rings for projects;
- star systems for clusters;
- curved energy trails for relations;
- nebula, parallax and particles;
- glass HUD;
- responsive mobile layout.

## Completion

A good completion returns:

```text
你的星图已生成：
- 12 个行星
- 12 条轨道
- 3 个待确认兴趣
- 1 个 7 天实验

[打开星图] [保存 PNG] [查看待确认]
```

Do not claim the map is complete if there are unconfirmed proposals.
