# C 路线：把严格评分从 6.0–6.7 提到 8.5

> 这不是“改分计划”，而是一份以证据为门槛的工程与外部验证计划。
> 目标分数是 8.5，但任何一项没有证据，就不能写进报告。

## 0. 当前基线

三份独立上下文审计的结果：

```text
安全 / 隐私        6.0
发布 / 供应链      7.0
产品价值           6.5
完整度 / UX        6.0
代码质量           6.5
测试 / QA          6.5
文档 / 仓库卫生    5.5–6.0
采用 / 分发        1.0–1.5

综合约             6.0–6.7
```

现有强项：

```text
617 tests / 574 Vitest + 11 MCP + 32 Playwright
11 个 Linux 视觉基线
CodeQL 0 open alerts
4.0.8 确定性打包、digest、Sigstore attestation
strict TS、0 any、typecheck/lint 全绿
本地 loopback、CSP、路径穿越防护、1 MiB body 上限
```

现有硬缺口：

```text
High   Host 未校验，DNS rebinding 可读图谱
Medium Origin 不校验端口
Medium API key 明文 0666
Medium AI consent 默认 true
Medium /api/suggest 无超时
Medium 独立版缺 Key 时连接断路
Medium capture 同名静默覆盖
Medium 实验结束后没有真正的决定产物
Medium 本地发布链与远端 tag 不一致
Medium 文档数字 530 / 606 / 617 互相矛盾
High   采用为零
```

## 1. 8.5 的分数结构

按当前报告权重：

| 维度 | 权重 | 8.5 目标 | 需要的证据 |
| --- | ---: | ---: | --- |
| 产品价值 | 15% | 8.0–8.5 | 真实用户证明闭环有效 |
| 完整度 / UX | 15% | 8.5 | 独立版无 Key 也能完成连接与决定 |
| 代码质量 | 15% | 8.5 | `main.ts` / `app.js` 拆分，全仓 lint/typecheck |
| 测试 / QA | 15% | 8.5 | E2E 进门禁，视觉基线缺失即失败，全仓覆盖率口径 |
| 安全 / 隐私 | 15% | 8.5–9.0 | Host/Origin 全路由防护、Key 0600、独立审计 |
| 文档 / 仓库卫生 | 5% | 8.5 | 数字单一来源，媒体/历史清理 |
| 发布 / 供应链 | 10% | 9.0 | 确定性打包和验签在远端可复现 |
| 采用 / 分发 | 10% | 5.0–6.0 | 真实下载、外部用户、访谈、引用 |

算术上，采用只有 1.0 时，其他维度全部满分也只到约 9.1；但“全部满分”不现实。采用必须从 1.0 提到至少 5.0，8.5 才有可信基础。

## 2. 工作流 A：安全加固（最高优先级）

### A1. Host 白名单

目标：关闭 DNS rebinding。

实现：

```text
从 request.socket.localPort 取实际端口
允许 Host 仅匹配：
  127.0.0.1:<port>
  localhost:<port>
  [::1]:<port>
拒绝缺失或未知 Host
```

验收：

```text
Host: evil.example GET /api/state -> 403
Host: 127.0.0.1:<port> GET /api/state -> 200
CLI 无 Origin 调用仍可用
```

### A2. 所有路由的来源守卫 + 本地会话 token

目标：不再只保护 POST/PUT/PATCH/DELETE，也不再只靠“来源 hostname 是 localhost”当身份。

实现：

```text
API 路由统一前置：
  - Host 白名单
  - Origin 若存在，必须匹配 127.0.0.1/localhost/[::1] + 实际端口
  - Sec-Fetch-Site: cross-site 直接拒绝
  - 无 Origin 的 CLI 请求允许，但必须通过 Host 校验
  - 写路由和 /api/config 额外要求 per-process token
```

重点：

```text
PUT /api/config 能改 baseUrl/keyEnv 并写 key
POST /api/config/test 会用请求体的 baseUrl 发出 key
单靠 localhost Origin 不足以保护，因为任意本地端口都算“可信”
```

所以 token 必须覆盖：

```text
PUT /api/config
POST /api/config/test
POST /api/suggest
POST /api/connect
所有会写 vault 或发 key 的 API
```

验收：

```text
Origin: https://evil.example GET /api/state -> 403
Origin: http://127.0.0.1:59999 POST /api/scan -> 403
Origin: http://127.0.0.1:59999 PUT /api/config -> 403
正常同源 GET/POST -> 200
CLI 无 Origin + token -> 200
```

### A3. Key、consent、超时

```text
.interestseed/key 写入 0o600
keyEnv 只允许 INTERESTSEED_* 白名单，默认只认 INTERESTSEED_AI_API_KEY
aiConsentGranted 默认 false；enableAI 默认 false
/api/suggest 加 AbortController + 30s 超时
响应体加上限
坏 JSON 返回 400，不返回 500
非 loopback 的 baseUrl 强制 https，或要求用户二次确认
```

补充审计结论：

```text
PUT /api/config 在本地任意端口 Origin 下可改写 baseUrl/keyEnv
POST /api/config/test 可把 key 发往请求体指定的地址
这是已实证的 High 级链路，必须先于任何“功能优化”修掉
```

### A4. 其他安全项

```text
Windows DshAcpClient 去掉 shell:true，或严格引用参数
/api/graph 限制 GET
MCP search 去掉 O(n²) degreeMap 重建
```

安全验收目标：独立审计从 6.0 提到 **8.5–9.0**。

## 3. 工作流 B：发布与供应链恢复

### B1. 远端与本地对齐

当前本机工作树与 `origin/main` 已分叉，必须先把远端作为唯一发布源：

```text
git fetch origin
git status
git diff origin/main
```

不要在本机脏树上直接打包发布。

### B2. 恢复确定性发布链

```text
node scripts/package-standalone.mjs
npm run check:package-digest
发布后下载 asset 并 sha256 复核
npm run check:release（含 Sigstore 验签）
```

禁止用 `Compress-Archive` 作为发布打包器。

### B3. 门禁补齐

```text
npm run verify 加入 check:size、typecheck:standalone、E2E
release workflow 先跑 E2E + visual
CodeQL 恢复 @v4 + config-file
所有 action 用 SHA pin
npm audit 真正进 CI，或删除“npm audit gate”声明
```

### B4. 验签必须绑定签名者身份

`check-release` 不能只验证“某个 Sigstore 信任根签了这段内容”，还要绑定：

```text
签名者 SAN = https://github.com/lxc248/-interestseed/.github/workflows/release-standalone.yml@refs/tags/standalone-v*
issuer = https://token.actions.githubusercontent.com
resolvedDependencies.gitCommit = tag 指向的 commit
```

并且：

```text
无 GITHUB_TOKEN 时 fail，不再静默 pass
把 check:release 接进 PR/main 可运行的检查
```

验收：

```text
同源码两次打包 SHA-256 相同
release workflow 从 tag 到 publish 全绿
CodeQL paths-ignore 生效
伪造的 attestation/错误身份被拒绝
```

发布维度目标：**9.0**。

## 4. 工作流 C：产品闭环

### C1. 无 Key 也能连接

独立版增加：

```text
规则建议 / suggested edges 列表
可确认、可拒绝
“待确认 N” 可点击
AI 只作为增强，不是唯一入口
```

验收：

```text
空 Key 新用户也能完成 捕获 → 连接 → 实验
```

### C2. 证据驱动下一步

```text
renderInterestRoute 的 ## 下一步
读取最近日志的 next 字段
没有 next 时明确提示，而不是硬编码一句
```

### C3. 实验终点

```text
完成后记录 keep / change / drop
生成 Markdown 决定
进入兴趣路线或历史
```

### C4. Capture 不覆盖

```text
同名文件加 -2 后缀，或返回 duplicate
写入前检查 exists
```

### C5. 排除自产目录

```text
默认 excludeFolders 增加 InterestSeed/
避免路线报告再次进入图谱
```

产品完整度目标：**8.5**。

## 5. 工作流 D：代码质量

```text
拆 src/main.ts（目标 <600 行）
拆 standalone/web/app.js（模块化，纳入 lint + typecheck）
GraphCanvas 真正接入产品，或删除
覆盖率统计包含未测文件，不用 85.8% 选择性口径
视觉测试缺基线改为 fail，不是 skip
```

代码质量目标：**8.5**。

## 6. 工作流 E：文档真相

单一事实源：

```text
scripts/report-metrics.mjs
→ 生成 README badges
→ 生成 audit evidence
→ 生成 release notes 测试块
```

必须修正：

```text
README 正文 530 → 当前真实值
RELEASE_NOTES 606/21 → 当前真实值
覆盖率 75.4% vs 85.8% 的口径说明
axe 覆盖范围不要写未测页面
semgrep/gitleaks 要么真跑，要么删声明
```

文档/卫生目标：**8.5**；清理 `review/`、`promo/` 历史媒体后，clone 体积下降。

## 7. 工作流 F：真实采用

没有这一项，8.5 不成立。

最低证据门槛：

```text
外部下载 >= 100
真实外部用户 >= 10
完成 3 天实验的用户 >= 3
用户访谈 >= 3
外部引用/推荐 >= 1
GitHub stars/forks 有自然增长
```

执行：

```text
发布 4.0.9（包含 A–E）
在 Obsidian / PKM / local-first 社区分发
记录来源、下载、反馈
做 3 次访谈并写进报告
```

采用目标：**5.0–6.0**。

## 8. 独立人类审计

自动化审计不能替代人类第三方审计。需要：

```text
审计范围：本地 server、MCP、发布链、key 处理
交付物：findings + severity + fix verification
审计者：非项目作者
公开方式：报告或摘要，经审计者同意
```

审计通过后，安全与发布维度才能稳定在 8.5–9.0。

## 9. 里程碑

### M1：安全与发布（1 周）

```text
A1–A3 + B1–B4
安全 >= 7.5
发布 >= 8.5
```

### M2：产品闭环（1 周）

```text
C1–C5
完整度 >= 7.5
产品价值 >= 7.0
```

### M3：代码与文档（1–2 周）

```text
D + E
代码 >= 8.0
测试 >= 8.0
文档 >= 8.0
```

### M4：外部验证（2–4 周）

```text
F + 独立审计
采用 >= 5.0
安全/发布 >= 8.5–9.0
```

只有 M4 完成后，报告才可能诚实地写 **8.5**。

## 10. 不做什么

```text
不改权重凑分
不把自动化审计写成人类第三方
不把 0 下载写成真实用户
不把本地未复现的构建写成已复现
不先写 8.5 再补证据
```

## 11. 第一刀

先做 A1/A2：

```text
Host 白名单
全路由 Origin/Sec-Fetch-Site 守卫
对应安全测试
```

这是当前唯一能立刻把 High 风险降下来的改动，也是 8.5 路线的入口。
