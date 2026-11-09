# CodeQL triage — 2026-11-09

Scope: the CodeQL alerts left after the 4.0.7 release and the source-scoped scan
configuration.

This is a triage record, not an independent audit.

## Dismissed as accepted design

| Alert | Rule | Decision |
| --- | --- | --- |
| `standalone/src/server.ts` | `js/file-access-to-http` | Local-only server. `baseUrl` is user-configured; the API key is intentionally sent only to that endpoint. |
| `src/services/ModelProvider.ts` | `js/file-access-to-http` | Same local AI boundary. |
| `scripts/check-release.mjs` | `js/file-access-to-http` | Requests the fixed `api.github.com` host; the tag comes from the package version. |
| `scripts/monitor-copies.mjs` | `js/http-to-file-access` | Local maintenance script; not shipped in the standalone runtime. |

The server is loopback-only, uses Origin/Sec-Fetch-Site checks and has no
authentication layer by design. Do not expose it to a network.

## Fixed in source

The Inbox URL normalizer no longer uses backtracking regexes for query/hash or
trailing-slash stripping. It uses linear string operations.

## Remaining

After the next CodeQL scan, the two Inbox alerts should close automatically.
If they do not, re-check the exact line and the scan commit before dismissing.

## Not covered

```text
independent human security audit
public-network deployment threat model
third-party model endpoint behavior
```
