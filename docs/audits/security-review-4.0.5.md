# Security review — InterestSeed Standalone 4.0.5

Status: **internal self-review, not an independent audit.** No third-party
security firm reviewed this release. Do not present this document as an
independent audit.

## Scope

```text
standalone server
MCP server (full and --minimal)
release packaging and verification
CI supply-chain controls
```

## Evidence reviewed

```text
standalone/src/server.ts
mcp/server.mjs
scripts/check-release.mjs
scripts/package-standalone.mjs
.github/workflows/release-standalone.yml
.github/workflows/codeql.yml
tests/standaloneServerSecurity.test.ts
tests/standaloneServerRoutes.test.ts
tests/e2e/a11y.spec.ts
```

## Findings

### Critical / high

None found in the reviewed scope.

### Medium

1. **Local trust boundary.** The local server is designed for the local
   machine. Any local process that can reach loopback is inside that boundary.
   This is documented on the public security page and must not be treated as
   multi-user authentication.
2. **Full MCP mode exposes more metadata.** The full server can expose graph
   summaries and `sourceRef`. `--minimal` is available but is not the default.
3. **No independent audit.** Automated tests and CodeQL are not a substitute
   for a third-party review.

### Low

1. `GET /api/state` includes the local `vaultPath` in its response. This is
   useful to the local dashboard but should not be exposed beyond loopback.
2. `POST /api/config/test` can make an outbound request to a user-selected
   `http(s)` base URL. Origin checks reduce browser abuse, but a local process
   can still point it at another local service.
3. There is no authentication layer by design. Rely on loopback binding and
   the origin checks; do not reverse-proxy the server publicly.

## Controls verified

```text
JSON-only state-changing routes
Origin and Sec-Fetch-Site checks
Static path boundary and encoded traversal tests
CSP / nosniff / DENY / no-referrer
1 MiB request body limit
Generic 500 without internal exception text
API no-store / nosniff / no-referrer / same-origin resource policy
MCP read-only mode and --minimal surface
SHA-256 + Sigstore release verification
CodeQL security-and-quality
npm audit: 0 vulnerabilities
```

## Recommended next steps

1. Commission an independent review of `standalone/src/server.ts` and
   `mcp/server.mjs`.
2. Add a small threat-model note to the release checklist.
3. Revisit whether the default MCP mode should be `--minimal`.
4. Add an explicit UI warning that the local server must not be exposed to a
   network.
