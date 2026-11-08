# InterestSeed Standalone 4.0.5

Quality, accessibility and release-pipeline follow-up.

## Highlights

- Request bodies are capped at 1 MiB; oversized bodies return `413`.
- API responses now use `no-store`, `nosniff`, `no-referrer` and
  `Cross-Origin-Resource-Policy: same-origin`.
- Public site, app flow and axe WCAG 2A/2AA checks run in CI; the accessibility
  gate requires zero violations.
- CodeQL security-and-quality analysis runs on push, PR and a weekly schedule.
- Standalone packaging is deterministic: local Windows and CI Ubuntu produce
  the same SHA-256.
- The release workflow verifies the published asset, site digest and Sigstore
  attestation signature.
- A public security and privacy page documents the local trust boundary and
  the honest limits.

## Verification

```text
Vitest        570 passed
MCP smoke      11 passed
Playwright     20 passed
Total         601 passed
Coverage      82.96% statements / 72.15% branches / 85.16% functions / 85.71% lines
npm audit     0 vulnerabilities
```

## Install

```bash
unzip interestseed-standalone-v4.0.5.zip
node interestseed-standalone-v4.0.5/cli.js init --vault "<vault>"
node interestseed-standalone-v4.0.5/cli.js serve --vault "<vault>" --port 4173
```

Open `http://127.0.0.1:4173`.

## Notes

- The SHA-256 digest is published with the release asset and on the download
  page.
- The plugin and standalone runtime remain separate version lines.
- AGPL-3.0-only.
