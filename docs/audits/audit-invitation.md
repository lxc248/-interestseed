# 独立安全审计邀请材料

这份文件给你直接发给外部审计方用。**它本身不是审计结论**，也不代表已经有人审过。

## 一、先决条件（缺一项就别发）

```text
[ ] 仓库公开：https://github.com/lxc248/-interestseed
[ ] 审计对象 commit 已固定（见下方“目标”）
[ ] SECURITY.md 存在，含报告渠道与响应时限
[ ] 已知问题清单已整理（不藏问题，否则审计方不会信任材料）
[ ] 你能承诺的唯一“报酬”已经想清楚（署名？小额付费？都没有？）
```

## 二、目标（发给对方时填最新值）

```text
Repo:      https://github.com/lxc248/-interestseed
Commit:    8d92b29（审计范围以此 commit 为准）
Plugin:    3.7.0（Obsidian 插件，release tag 3.7.0）
Standalone: 4.0.10（CLI + 本地 Web）
License:   AGPL-3.0-only
```

## 三、范围（Scope of Work）

**范围内**

| 文件 | 为什么审 |
| --- | --- |
| `standalone/src/server.ts` | 本地 HTTP 服务的 Host / Origin / token / body limit 守卫 |
| `standalone/src/ai.ts` | API Key 处理、AI 同意开关、外部请求边界 |
| `mcp/server.mjs` | 只读 MCP server，是否有越权读取 |
| `scripts/package-standalone.mjs` | 打包是否会把不该带的文件带进 zip |
| `scripts/check-release.mjs` | 摘要与 Sigstore 身份绑定是否可绕过 |
| `.github/workflows/release-standalone.yml` | 供应链：构建产物是否可被替换 |
| `src/main.ts` + `standalone/web/` | 插件/Web 与 vault 数据的边界 |

**范围外（明确声明，避免误判“审计通过”）**

```text
Obsidian 本体与第三方依赖自身的漏洞
用户自建的反向代理 / 公网暴露配置
DeepSeek 等外部模型服务端的行为
社会工程与物理安全
密码学原语自研实现（本项目未自研）
```

## 四、希望交付什么

```text
1. 每条发现的严重级别 + file:line + 复现步骤
2. 修复验证结论（修完之后是否真的修好）
3. 明确列出“没有测什么”
4. 一份带日期的结论段落，允许公开引用原文
5. 可选：允许在 README 里署名致谢
```

## 五、我们提供什么

```text
- 完整的构建与测试命令（见 auditor-brief.md）
- 已知问题与已修复问题清单（不隐藏历史漏洞）
- 一个隔离的测试 vault，不需要你的真实笔记
- 响应承诺：收到发现后 7 天内给出修复计划
- 公开披露：修复发布后公开写入 SECURITY.md 致谢
```

**报酬**：本项目目前没有预算承诺。发信时必须如实说明这一点，不要暗示有赏金。可选方案见下节。

## 六、三条现实路径

| 路径 | 适合谁 | 你要准备什么 | 现实预期 |
| --- | --- | --- | --- |
| 公开漏洞赏金（huntr.dev / HackerOne 开源计划） | 想长期有入口 | SECURITY.md + 范围声明 + 响应流程 | 不保证有人看，周期长 |
| 个人安全研究者定向审计（2–3 天） | 想尽快拿到一份署名结论 | 一份清晰的 SoW + 明确报酬 | 需要你自己谈价，市面无统一价格 |
| 专业机构（Trail of Bits / Cure53 / NCC 等） | 要拿去对外背书 | 预算 + 采购流程 | 周期以周计，费用需自行询价 |

## 七、邀请信模板（英文）

```text
Subject: Request for a scoped security review — InterestSeed (AGPL, local-first Obsidian plugin + CLI)

Hi <name>,

I maintain InterestSeed, an AGPL-3.0 local-first tool that turns one saved item into a
3-day validation experiment. It ships as an Obsidian plugin (3.7.0) and a standalone
CLI/local web app (4.0.10).

I am looking for an independent human security review, not a penetration test of a
hosted service. The attack surface I care about most:

  - the local HTTP server (Host/Origin/session-token guards, body limits)
  - API key storage and the AI consent gate
  - the read-only MCP server
  - release integrity (SHA-256 + Sigstore identity binding)

Scope, out-of-scope items and the exact commit are documented here:
  docs/audits/auditor-brief.md
  docs/audits/audit-invitation.md

Practical notes:
  - Everything runs locally; no hosted account is needed to review it.
  - `npm ci && npm run test && npm run test:e2e` reproduces the suite.
  - I will give you an isolated test vault; you never need real notes.

Two things I want to be upfront about:
  - I have no bounty budget I can promise. If you need payment, tell me your rate and
    I will say yes or no rather than waste your time.
  - I will publish your findings (fixed) with attribution, unless you prefer otherwise.

If this is not a fit, a pointer to someone who does small scoped reviews would help.

Thanks for your time,
<your name>
```

## 八、邀请信模板（中文）

```text
主题：请求一次有范围限定的安全复核 —— InterestSeed（AGPL，本地优先 Obsidian 插件 + CLI）

你好 <称呼>，

我维护 InterestSeed，一个 AGPL-3.0 的本地优先工具：把一条收藏变成一个 3 天的验证实验。
它有两个形态：Obsidian 插件（3.7.0）和独立 CLI / 本地 Web（4.0.10）。

我想找的是**一次独立的人工安全复核**，不是对线上服务的渗透测试。我最在意四块：

  - 本地 HTTP 服务（Host / Origin / session token 守卫、请求体上限）
  - API Key 存储与 AI 同意开关
  - 只读 MCP server
  - 发布完整性（SHA-256 + Sigstore 身份绑定）

范围、明确排除项和固定 commit 都在：
  docs/audits/auditor-brief.md
  docs/audits/audit-invitation.md

几点实际情况：
  - 全部本地运行，不需要注册账号就能审。
  - `npm ci && npm run test && npm run test:e2e` 可复现整套测试。
  - 我会提供隔离测试 vault，你不需要接触任何真实笔记。

两件我想先说清楚：
  - 我没有可以承诺的赏金预算。如果你需要报酬，请直接报价，我会明确答复“可以/不行”，
    不占用你时间。
  - 修复完成后我会公开你的结论并署名致谢（除非你希望匿名）。

如果不合适，能指给我一个愿意做小范围复核的人也很好。

谢谢，
<你的名字>
```

## 九、发出去之后

```text
1. 收到回复后，把对方要求补的材料补进 docs/audits/
2. 对方给的发现，先修再谈公开
3. 修完在 SECURITY.md 里写：谁审的、审的哪个 commit、结论原文、修复版本
4. 不要在 README 写“已通过安全审计”，除非报告原文就是这个结论
```

## 十、诚实边界

```text
本文件是邀请材料，不是审计报告。
在拿到署名结论之前，任何地方都不得暗示“已经过独立审计”。
```
