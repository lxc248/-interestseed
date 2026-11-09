# InterestSeed Standalone 4.0.8

Security and release-pipeline follow-up.

## Highlights

- Local API keys are redacted from upstream error details.
- The release workflow checks package/page digest consistency before publish.
- CodeQL is scoped to source; generated bundles and archived code are excluded.
- All open CodeQL alerts are cleared through source fixes, scope changes and
  documented design triage.
- Troubleshooting docs cover 429 Retry-After, port errors, missing keys and
  local-server boundaries.
- Deterministic packaging keeps local and CI hashes identical.

## Verification

```text
Vitest        574 passed
MCP smoke      11 passed
Playwright     21 passed
Total         606 passed
Coverage      82.96% statements / 72.15% branches / 85.16% functions / 85.71% lines
npm audit     0 vulnerabilities
CodeQL        open alerts: 0
```

## Install

```bash
unzip interestseed-standalone-v4.0.8.zip
node interestseed-standalone-v4.0.8/cli.js init --vault "<vault>"
node interestseed-standalone-v4.0.8/cli.js serve --vault "<vault>" --port 4173
```

Open `http://127.0.0.1:4173`.

## Notes

- The server binds to `127.0.0.1`; do not expose it to a network.
- The SHA-256 digest is published with the asset and on the download page.
- AGPL-3.0-only.
