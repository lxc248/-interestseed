# InterestSeed Standalone 4.0.4

Security, quality and release-pipeline follow-up.

## Highlights

- Request bodies are capped at 1 MiB; oversized bodies return `413` without
  buffering the whole payload.
- Standalone AI, server route, GraphCanvas and ShareCardRenderer tests were
  added.
- Public-site and app-flow Playwright checks now run in CI.
- axe WCAG 2A/2AA checks cover public pages, the app shell and the settings and
  capture modals. Missing form labels were fixed.
- Version consistency is checked across README, site, MCP and release docs.
- This release is the first one intended to be built by the automated
  `release-standalone` workflow.

## Verification

```text
Vitest        564 passed
MCP smoke      11 passed
Playwright     18 passed
Total         593 passed
Coverage      82.74% statements / 71.83% branches / 85.07% functions / 85.50% lines
npm audit     0 vulnerabilities
```

## Install

```bash
unzip interestseed-standalone-v4.0.4.zip
node interestseed-standalone-v4.0.4/cli.js init --vault "<vault>"
node interestseed-standalone-v4.0.4/cli.js serve --vault "<vault>" --port 4173
```

Open `http://127.0.0.1:4173`.

## Notes

- The SHA-256 digest is published with the release asset and on the download
  page.
- The plugin and standalone runtime remain separate version lines.
- AGPL-3.0-only.
