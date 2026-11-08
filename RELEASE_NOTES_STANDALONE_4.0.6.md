# InterestSeed Standalone 4.0.6

Hardening and observability follow-up.

## Highlights

- Removed the local vault path from `/api/state`.
- Added CSP `frame-ancestors`, `base-uri` and `form-action`, plus
  `Permissions-Policy`, COOP and `X-Permitted-Cross-Domain-Policies`.
- Added a visible “仅本机” badge warning users not to expose the local server.
- Added `interestseed version` / `--version`.
- Added `GET /api/health` with service version and local-only status.
- Added an E2E check for experiment evidence and DAY 1 → DAY 2.
- Reduced the tracked tree from 171.8 MB to 29.6 MB and added a 40 MB CI budget.
- Kept deterministic packaging: local Windows and CI Ubuntu produce the same
  SHA-256.

## Verification

```text
Vitest        570 passed
MCP smoke      11 passed
Playwright     21 passed
Total         602 passed
Coverage      82.96% statements / 72.15% branches / 85.16% functions / 85.71% lines
npm audit     0 vulnerabilities
```

## Install

```bash
unzip interestseed-standalone-v4.0.6.zip
node interestseed-standalone-v4.0.6/cli.js init --vault "<vault>"
node interestseed-standalone-v4.0.6/cli.js serve --vault "<vault>" --port 4173
```

Open `http://127.0.0.1:4173`.

## Notes

- The server binds to `127.0.0.1` and is not designed for public exposure.
- The SHA-256 digest is published with the asset and on the download page.
- AGPL-3.0-only.
