# InterestSeed Standalone 4.0.10

Modular web app and tightened AI endpoint policy.

## Highlights

- Local web app split into focused modules; `app.js` is now below 600 lines.
- AI base URL restricted to loopback by default; set `INTERESTSEED_ALLOW_REMOTE_AI=1` to allow remote endpoints.
- README test and coverage numbers are aligned with the actual suites.
- JSON Canvas and interest-route file writes moved out of `main.ts`.
- External audit packet added for a future human reviewer.

## Verification

```text
Vitest        591 passed
MCP smoke      11 passed
Playwright     31 passed
Total         633 passed
npm audit     0 vulnerabilities
CodeQL        open alerts: 0
```

SHA-256:

```text
c511fee47d2efe5d895540c06a62c576255a87fdb5819282f3d016a7b804a4bb
```

## Install

```bash
unzip interestseed-standalone-v4.0.10.zip
node interestseed-standalone-v4.0.10/cli.js init --vault "<vault>"
node interestseed-standalone-v4.0.10/cli.js serve --vault "<vault>" --port 4173
```

Open `http://127.0.0.1:4173`.

## Notes

- The server binds to `127.0.0.1`; do not expose it to a network.
- The SHA-256 digest is published with the asset and on the download page.
- AGPL-3.0-only.
