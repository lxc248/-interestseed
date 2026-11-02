# InterestSeed Standalone 4.0.2

Security patch. Upgrade from 4.0.1 is recommended. Keep your existing
`.interestseed/` directory; no data migration is required.

## Security

- Fixed a critical API-key exfiltration path in `/api/config/test`.
  The endpoint now requires `application/json`, rejects cross-origin browser
  requests, rejects `Origin: null` and `Sec-Fetch-Site: cross-site`, and only
  accepts `http(s)` base URLs.
- Hardened static file serving with a real path-boundary check.
- Added `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` and a
  restrictive Content-Security-Policy.
- Updated `SECURITY.md` for standalone key storage and the MCP data surface.

## Audits

- `review/security-audit-4.0.1.md` — security and project audit.
- `review/geo-audit-2026-11-02.md` — GEO / AI visibility audit using NiubiGEO.

## Verification

```text
74 test files
531 tests passing
normal JSON                  -> 200
text/plain                   -> 415
Origin: https://evil.example -> 403
Origin: http://127.0.0.1     -> 200
```

## Upgrade

```bash
unzip interestseed-standalone-v4.0.2.zip
node interestseed-standalone-v4.0.2/cli.js init --vault "<vault>"
node interestseed-standalone-v4.0.2/cli.js serve --vault "<vault>" --port 4173
```

## Verify the download

```bash
sha256sum -c SHA256SUMS.txt
gh attestation verify interestseed-standalone-v4.0.2.zip --repo lxc248/-interestseed
```

## License

AGPL-3.0-only. See `LICENSE`, `NOTICE`, `TRADEMARKS.md` and
`COMMERCIAL_LICENSE.md` in the repository.
