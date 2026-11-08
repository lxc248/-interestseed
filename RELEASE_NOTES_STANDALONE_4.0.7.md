# InterestSeed Standalone 4.0.7

Accessibility, rate-limit handling and runtime hardening.

## Highlights

- Accessible modals: Escape to close, Tab focus trap, focus restoration,
  `role="dialog"`, `aria-modal` and labels.
- Skip-to-content link and `aria-busy` on the app shell.
- `aria-pressed` on graph filter chips and a polite toast live region.
- Friendly HTTP 429 messages using `Retry-After` for AI suggestions and the
  connection test.
- Clear EADDRINUSE and port-range errors for `serve`.
- MCP graph and JSON reads no longer use `existsSync` before `readFileSync`.
- CodeQL scans are scoped to source; generated bundles and archived code are
  excluded.
- Deterministic packaging keeps local and CI hashes identical.

## Verification

```text
Vitest        574 passed
MCP smoke      11 passed
Playwright     21 passed
Total         606 passed
Coverage      82.96% statements / 72.15% branches / 85.16% functions / 85.71% lines
npm audit     0 vulnerabilities
```

## Install

```bash
unzip interestseed-standalone-v4.0.7.zip
node interestseed-standalone-v4.0.7/cli.js init --vault "<vault>"
node interestseed-standalone-v4.0.7/cli.js serve --vault "<vault>" --port 4173
```

Open `http://127.0.0.1:4173`.

## Notes

- The server binds to `127.0.0.1`; do not expose it to a network.
- The SHA-256 digest is published with the asset and on the download page.
- AGPL-3.0-only.
