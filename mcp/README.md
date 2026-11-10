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

最小暴露模式：

```bash
node mcp/server.mjs --minimal --graph "/path/to/vault/.interestseed/state.json"
# 或
INTERESTSEED_MCP_MINIMAL=1 INTERESTSEED_GRAPH="..." node mcp/server.mjs
```

minimal 模式只暴露：

```text
tools:     interestseed_next_step, interestseed_get_experiment
resources: interestseed://next
prompts:   无
```

适合只需要“下一步”和当前实验、不需要完整图谱上下文的 MCP 客户端。

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
interestseed://experiments
interestseed://discoveries
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

`--minimal` 会关闭完整图谱、context、实验列表、发现列表和 prompts，只保留下一步与当前实验。

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
- 图谱缺失、目录、坏 JSON 或缺字段时只返回通用工具错误，路径与异常细节只写 stderr；
- 不访问网络；
- 不抓取抖音；
- 用户必须自己启动这个本地进程。

## 版本

随插件版本发布；当前 `4.0.3`。
## HTTP 模式（接入云端智能体平台）

stdio 只能被本机程序启动；扣子、Dify、百炼这类**云端**平台连不到你本地的 stdio 进程。HTTP 模式就是为此而加。

```bash
node mcp/server.mjs --http 4174 --graph "/path/to/graphs/default.json" --token "<你的密钥>"
# 或
INTERESTSEED_MCP_TOKEN="<你的密钥>" node mcp/server.mjs --http 4174 --graph "..."
```

启动后输出一行：

```json
{"event":"listening","url":"http://127.0.0.1:4174","auth":"bearer"}
```

端点：

```text
GET  /health   存活检查，不需要 token，不含任何图谱数据
POST /mcp      JSON-RPC，必须带 Authorization: Bearer <token>
OPTIONS /mcp   CORS 预检
```

### 安全约束

```text
默认只绑定 127.0.0.1，不对外网开放
必须提供 token；不给就随机生成一个并打印到 stderr
token 用 timingSafeEqual 比较，避免计时侧信道
单请求体上限 1 MiB
/health 刻意不鉴权，但也刻意不返回任何图谱内容
```

要对外暴露必须显式 `--host 0.0.0.0`，此时请自行加反向代理与 TLS。

### 云端平台怎么填

以通用「自定义 MCP / HTTP 工具」配置为例：

```text
URL        http://<你的公网地址>:4174/mcp
Auth       Bearer <token>
Transport  Streamable HTTP（请求 - 响应，无 SSE）
```

如果云平台只支持 SSE 或要求 OAuth，需要在前面加一层网关做转换——本 server 只实现 JSON-RPC over HTTP。
## 写入模式（默认关闭）

默认只读。要允许 AI 把兴趣写进图谱，必须显式开启：

```bash
node mcp/server.mjs --write --graph "<vault>/.interestseed/state.json"
# 或
INTERESTSEED_MCP_WRITE=1 node mcp/server.mjs --graph "..."
```

开启后多出两个工具：

```text
interestseed_capture_interest     title（必填）/ url / note / tags
interestseed_start_experiment     interest（必填，标题或节点 id）/ hypothesis / days
interestseed_log_experiment       evidence（必填，至少 4 字）/ interest / energy / next / experiment
interestseed_undo_last_capture     id（可选，留空撤销最近一次 MCP 创建）
interestseed_undo_last_log         experiment（可选，留空取当前进行中的实验）
```

### 安全与边界

```text
同名或同链接的节点不会重复创建      幂等，返回 created:false 和已有节点
写入前先备份                       生成 <graph>.bak，写坏了能回滚
temp + rename 原子写                不会留下写了一半的 JSON
保留原有信封结构                    {schemaVersion, graph:{...}} 不会被打平
一次只允许一个进行中的实验          已有 active 实验时直接拒绝并告知其 id
每天只能记一条实验日志              重复记录直接拒绝；写满目标天数后自动置为 complete
误建可以撤销                        只能撤销 MCP 创建的节点；已有连接或实验时拒绝
写错的日志也能撤                      撤销最近一条并把状态回退，被删内容原样返回
只写独立版 state.json              插件图谱会明确拒绝：实验由插件自己管理
minimal 模式永不暴露写工具          --minimal + --write 只给只读工具
```

### 错误分两类

```text
校验错误（你自己写错）   原样返回，例如「找不到兴趣：陶艺」「已有进行中的实验（exp_x…）」
意外错误                 统一返回通用文案，细节只进 stderr，不泄露本机路径
```
