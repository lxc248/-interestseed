# InterestSeed Cosmic Viewer

一个**不需要 Obsidian**的单文件星图查看器。

## 直接打开

```text
viewer/index.html
```

文件会读取 `viewer/graph-data.js`，并渲染：

- 行星节点；
- 主题轨道；
- 星云背景；
- 能量连线与粒子流；
- 悬停/点击详情；
- 搜索与类型筛选；
- 缩放、平移、适应窗口；
- PNG 导出。

## 替换成真实图谱

把 `graph-data.js` 替换为：

```js
window.__INTERESTSEED_GRAPH__ = {
  schemaVersion: 2,
  nodes: [],
  edges: []
};
```

Skill 生成的 `star-map.html` 会将数据、CSS、JS 全部内联，用户不需要安装任何东西。

## 生成单文件

```bash
node skill/render.mjs --graph graph.json --out star-map.html
```

## 设计目标

- 不是“图表导出”，而是可分享的宇宙星图；
- Obsidian 不是前置条件；
- 同一套视觉可以进入 Obsidian 适配器；
- 无 CDN、无后端、无跟踪。

## 数据契约

```json
{
  "schemaVersion": 2,
  "nodes": [
    {
      "id": "seed-project",
      "type": "project",
      "title": "正在做的项目",
      "tags": ["项目"],
      "metadata": {
        "evidence": "来自你的选择",
        "confidence": 0.9
      }
    }
  ],
  "edges": [
    {
      "id": "e1",
      "source": "seed-project",
      "target": "seed-ai",
      "relation": "可能连接",
      "status": "confirmed",
      "confidence": 0.7
    }
  ]
}
```
