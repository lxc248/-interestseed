# InterestSeed 2.7.5 — Security hardening

根据 Cloudflare `security-audit-skill` 流程完成一次 scoped 安全审计，并修复确认问题。

## Confirmed fixes

### 客户端

- 分享来源外链改走 `window.open(noopener,noreferrer)`。

### MCP 后端

- prompt 先声明本地数据边界，防提示注入；
- stdin 单行上限 1 MiB，超限退出；
- 工具/资源错误只回显通用信息，详情写 stderr。

### Agent 与 AI

- DSH 子进程环境变量改为白名单，不再继承全部父环境；
- 本地 AI 服务不再回退使用云 `DEEPSEEK_API_KEY`；
- Claudian 探索请求先做最小字段清洗再入 prompt。

### 供应链与发布

- GitHub Actions 固定到完整 commit SHA；
- 发布资产生成 SHA256SUMS.txt；
- `gh release upload` 移除 `--clobber`；
- `scripts/deploy.ps1` 从 manifest 读取版本；
- `vite.config.ts` banner 版本从 package.json 读取。

## Report

```text
review/2.7.5-security-audit.md
```

## Verification

```text
56 test files
471 tests passing
typecheck / lint / build passing
```

AGPL-3.0-only.
