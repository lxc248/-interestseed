# InterestSeed 1.5.0 — 收件箱、主题优先、分享工作台与只读 MCP

这一版把四个方向合成了一条完整链路：

```text
刷到内容
→ Share Inbox 收件箱
→ 一次处理一条
→ 主题优先看图谱
→ 社交分享工作台
→ Agent 只读 MCP 查询
```

## 新增

### 以用户为中心的减法

- 工具栏从 12 个入口收敛为 `记录 / 收件箱 / 更多`；
- 「记录」成为唯一主行动；
- 扫描、节点、撤销、发现、导出等移入「更多」；
- Share Inbox 显示待判断数量；
- 火花弹窗隐藏目标选择与“为什么”输入，默认只保留“留下 / 只是路过”；
- 支持 `Ctrl/Cmd + Enter` 直接留下；
- 收件箱一次只展示一条，处理完自动轮到下一条；
- 主题轨默认聚焦，完整星图不消失。

### Share Inbox

- 分享先入队，不立即打断；
- 同一 URL 去重；
- 一次只处理一个候选；
- 支持「留下并连接」与「只是路过」；
- 关闭 Obsidian 后队列保留；
- NEXT 显示待判断数量；
- 移动端 URI 进入同一队列。

### Theme-first 星图

- 默认聚焦最大主题；
- 主题轨展示数量；
- 点「全部」展开完整宇宙；
- 主题切换不修改图谱数据。

### Social Share Studio

- 平台尺寸 PNG；
- 隐藏不想公开的节点；
- 自动文案；
- 复制图片 / 复制文案 / 系统分享；
- 标签避让；
- 深色弹窗。

### 只读 MCP

```text
mcp/server.mjs
```

工具：

```text
interestseed_get_graph
interestseed_next_step
interestseed_search_interest
interestseed_get_experiment
```

只读，不写 Vault，不访问网络，不读取 Vault 其他笔记。

### Trust / 大图

- 收件箱最多 200 条，避免无限增长；
- 分享卡片最多显示关键标签，密集图不变成标签墙；
- 隐藏节点筛选，避免公开私人项目；
- 后台窗口隐藏时暂停 Canvas；
- 保留图谱备份、导出和只读 MCP。

## 验证

```text
52 test files
460 tests passing
typecheck / lint / build passing
```

MCP 实际调用已验证：

```text
initialize
tools/list
interestseed_next_step
```

## 设计边界

- 不抓取抖音/小红书；
- 不调用私有接口；
- 不存 Cookie；
- 不自动写入图谱；
- 不自动发布社交内容；
- MCP 只读。

AGPL-3.0-only.
