# InterestSeed Standalone 4.0.9

Local trust-boundary and closed-loop hardening.

## Highlights

- Local API host allowlist bound to the actual loopback port.
- Origin and `Sec-Fetch-Site` checks on every API route.
- Per-process session token for browser-origin API calls.
- API keys are written with mode `0600`; `keyEnv` is restricted.
- AI is opt-in by default; `suggestRelations` has a 30s abort timeout.
- Suggested rule edges can be confirmed or rejected without an AI key.
- Captures with duplicate titles no longer overwrite existing notes.
- Completed experiments record keep / change / drop decisions.
- Interest routes use the latest experiment `next` action.

## Verification

```text
Vitest        579 passed
MCP smoke      11 passed
Playwright     32 passed
Total         622 passed
npm audit     0 vulnerabilities
CodeQL        open alerts: 0
```

## Install

```bash
unzip interestseed-standalone-v4.0.9.zip
node interestseed-standalone-v4.0.9/cli.js init --vault "<vault>"
node interestseed-standalone-v4.0.9/cli.js serve --vault "<vault>" --port 4173
```

Open `http://127.0.0.1:4173`.

## Notes

- The server binds to `127.0.0.1`; do not expose it to a network.
- The SHA-256 digest is published with the asset and on the download page.
- AGPL-3.0-only.
