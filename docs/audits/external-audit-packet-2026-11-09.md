# External audit packet — 2026-11-09

This packet is for a human reviewer. It is not an audit result and does not claim
independence.

## Target

```text
Repository: https://github.com/lxc248/-interestseed
Standalone: 4.0.9
Archive:    interestseed-standalone-v4.0.9.zip
SHA-256:    5d00805958efaec9079e949ee2d83407c4bcc81f191e4e9bf451a5ac6dde1c8a
```

## Scope

1. `standalone/src/server.ts` — local HTTP API, Host/Origin/session-token guards.
2. `standalone/src/ai.ts` — key resolution and AI consent.
3. `src/services/ModelProvider.ts` — local model calls, timeout and sanitization.
4. `mcp/server.mjs` — read-only MCP server and input limits.
5. `scripts/package-standalone.mjs` — deterministic packaging.
6. `scripts/check-release.mjs` — digest and Sigstore identity verification.
7. `.github/workflows/release-standalone.yml` — release gates.
8. `src/main.ts`, `standalone/web/*` — plugin/web boundaries and XSS surface.

## Threat model

```text
Browser on another loopback port
DNS rebinding to 127.0.0.1
Malicious local Markdown content
Malicious model endpoint response
Tampered release asset or attestation
Untrusted MCP client
```

## Claims to verify

```text
Loopback-only bind
Host allowlist tied to actual port
Origin/Sec-Fetch-Site checks for every API route
Per-process session token for browser-origin API calls
Key file mode 0600
keyEnv restricted to INTERESTSEED_AI_API_KEY
AI disabled by default until enable + consent
Request body cap 1 MiB
Path traversal rejected
No internal exception text returned
Digest matches download page, release index and asset
Sigstore signer SAN is the release workflow/tag
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

## Evidence

```text
Vitest        666 passed
MCP smoke      11 passed
Playwright     31 passed
Total         708 passed
CodeQL open alerts: 0
npm audit: 0
Release workflow: success
```

## Known residual risks

```text
No human third-party audit yet
No real external adoption evidence
Git clone history still retains historical media
src/main.ts remains a large class
Canvas animation is not screenshot-diffed
Non-loopback model endpoints are not blocked by policy
```

## Out of scope

```text
Cloud deployment
Public-network reverse proxy
Third-party model correctness
AGPL legal review
```

## Expected output

```text
Findings with severity and file:line
Reproduction commands
Fix verification
Explicit statement of what was not tested
```
