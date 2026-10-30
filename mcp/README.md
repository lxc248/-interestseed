# InterestSeed MCP Server（只读）

这是 InterestSeed 的本地只读 MCP Server。它只读取图谱快照，不写入 Vault，也不访问抖音/小红书。

## 启动

```bash
node mcp/server.mjs --graph "/path/to/vault/.obsidian/plugins/interestseed/graphs/default.json"
```

或：

```bash
INTERESTSEED_GRAPH="/path/to/.../graphs/default.json" node mcp/server.mjs
```

## Claude Desktop / Cursor / DSH 配置

```json
{
  "mcpServers": {
    "interestseed": {
      "command": "node",
      "args": ["C:\\path\\to\\interestseed\\mcp\\server.mjs"],
      "env": {
        "INTERESTSEED_GRAPH": "C:\\path\\to\\vault\\.obsidian\\plugins\\interestseed\\graphs\\default.json"
      }
    }
  }
}
```

不要填 API Key。不要填抖音 Cookie。

## 工具

```text
interestseed_get_graph
interestseed_next_step
interestseed_search_interest
interestseed_get_experiment
interestseed_get_context
```

## Resources

```text
interestseed://graph
interestseed://experiment
interestseed://next
interestseed://context
```

## Prompts

```text
review-interest
plan-next-experiment
```

## 协议

```text
MCP 2026-07-28
```

保留 tools，同时提供 resources 和 prompts；仍然是只读。

## 示例问题

```text
我现在最值得处理的兴趣是什么？
我的图谱里哪些主题还没有连接？
把美妆相关的节点找出来。
7 天实验现在进行到哪一天？
把当前兴趣的上下文包给我。
```

## 安全边界

- 只读，没有写入工具；
- 不读取 Vault 其他笔记；
- 只返回用户显式导入的 `sourceRef`，不遍历文件系统；
- 不访问网络；
- 不抓取抖音；
- 用户必须自己启动这个本地进程。

## 版本

随插件版本发布；当前 `2.7.x`。
