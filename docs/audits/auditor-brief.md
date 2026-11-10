# Auditor brief

For a human security reviewer. This is a handoff document, not an audit claim.

How to approach an auditor, engagement options and email templates: [audit-invitation.md](audit-invitation.md).

## What to review

```text
Repo:      https://github.com/lxc248/-interestseed
Commit:    8d92b29
Release:   standalone-v4.0.10
Plugin:    3.7.0 (Obsidian, tag 3.7.0)
ZIP SHA-256:
c511fee47d2efe5d895540c06a62c576255a87fdb5819282f3d016a7b804a4bb
```

## Scope

```text
standalone/src/server.ts      local API, Host/Origin/token guards
standalone/src/ai.ts          key handling and consent
mcp/server.mjs                read-only MCP server
scripts/package-standalone.mjs
scripts/check-release.mjs     digest + Sigstore identity
.github/workflows/release-standalone.yml
src/main.ts + standalone/web  plugin/web boundary
```

## Commands

```bash
npm ci
npm run typecheck
npm run typecheck:standalone
npm run test
npm run lint
npm run test:e2e
npm run check:release
```

## Claims to verify

```text
loopback-only bind
Host allowlist tied to actual port
Origin + Sec-Fetch-Site checks
per-process session token
key file mode 0600
AI disabled by default + explicit consent
body limit 1 MiB
no path traversal
no internal exception text leak
digest matches download page, release index and asset
Sigstore SAN is release workflow + tag
```

## What we need back

```text
Findings with severity + file:line
Reproduction commands
Fix verification
Explicit list of what was NOT tested
A dated signature from the reviewer
```

## Status

```text
Independent human audit: NOT YET DONE.
Do not cite this brief as evidence of an audit.
```
