# InterestSeed 安全与项目审计 — 4.0.1

Date: 2026-11-02
Scope: repository `lxc248/-interestseed` at `797c483` + local standalone web/MCP surfaces.

## Verdict

The project is in good shape for a local-first tool. One **critical** issue was
found in the new settings connection test and has been fixed. Production
dependencies have no known vulnerabilities. The main residual risk is the MCP
surface: it is read-only, but it can expose note summaries and experiment logs to
the MCP client you connect.

## Findings

### C1 — API-key exfiltration via `/api/config/test` (critical, fixed)

The new endpoint accepted an arbitrary `baseUrl` and fell back to the stored API
key. `readJson` did not require `application/json`, and there was no Origin
check. A cross-origin `text/plain` POST could therefore make the local server
send `Authorization: Bearer <stored key>` to an attacker-controlled URL.

Fix:

- state-changing routes now require `Content-Type: application/json`;
- cross-origin browser requests are rejected;
- `Origin: null` and `Sec-Fetch-Site: cross-site` are rejected;
- the base URL must be `http(s)`.

Verified:

```text
normal JSON                  -> 200
text/plain                   -> 415
Origin: https://evil.example -> 403
Origin: http://127.0.0.1     -> 200
```

### H1 — MCP exposes summaries, source refs and experiment logs (high, documented)

`mcp/server.mjs` is read-only, but `publicNode` includes `summary`,
`source`/`sourceRef`, and the `interestseed://experiments` resource returns raw
experiment logs. A cloud MCP client receives that data.

Status: documented in `SECURITY.md`. Recommendation: add a `--minimal` mode or
default to a redacted projection for cloud clients.

### M1 — Static file prefix check (medium, fixed)

The old check used `filePath.startsWith(webRoot)`, which is a prefix check rather
than a path-boundary check. Replaced with `relative(webRoot, filePath)` and a
`..` rejection. Added `X-Content-Type-Options`, `X-Frame-Options`,
`Referrer-Policy` and a restrictive CSP.

### M2 — SECURITY.md was stale (medium, fixed)

It said the project does not store provider keys, while the standalone runtime
stores `.interestseed/key`. It also omitted standalone 4.0.x and the MCP data
surface. Updated.

### M3 — MCP and AI boundaries differ (medium, documented)

The Explore AI request sends only node id, title, tags and existing edge id
pairs. The MCP server is broader by design. Do not describe them as the same
privacy boundary.

### L1 — Dev-only dependency advisories (low)

```text
production dependencies: 0 vulnerabilities
all dependencies:        11 moderate (eslint / minimatch chain)
```

These are development-only and not shipped in the standalone zip. Upgrade when
the ESLint 9 / typescript-eslint 8 migration is scheduled.

### L2 — No automated HTTP security regression test (low)

The content-type/Origin guards were verified manually with curl. A future test
should start the server on an ephemeral port and assert 415/403/200.

## What is already strong

- Standalone server binds to `127.0.0.1` only.
- AI request boundary: id/title/tags/edge pairs only; no note body or source path.
- AI output is parsed as strict JSON and node ids are checked.
- MCP server does not write to the vault.
- Release artifacts have SHA-256 checksums and build provenance.
- Branch protection, tag ruleset, Dependabot, secret scanning and push protection.
- 531 tests passing; coverage 75.42% lines / 73.46% statements.

## Commands run

```bash
npm run verify
npm run coverage
npm audit --omit=dev
npm audit
```

## Residual risks

- Local processes can still call the localhost API. The threat model is a
  single-user machine, not a multi-tenant server.
- MCP clients should be treated as trusted recipients of graph summaries.
- The standalone UI has no authentication because it is loopback-only.
