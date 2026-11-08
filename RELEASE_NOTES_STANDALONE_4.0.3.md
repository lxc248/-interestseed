# InterestSeed Standalone 4.0.3

Security hardening follow-up. No graph or experiment schema changes.

## What changed

- The local server no longer returns internal exception text on a route error.
  It returns `{ "error": "Internal server error." }` and writes details to stderr.
- Added `createInterestSeedServer()` so the HTTP surface can be tested in-process.
- Added regression tests for content-type, null-origin, cross-origin and cross-site request guards.
- Added static-file CSP / nosniff / DENY / no-referrer header checks.
- Added encoded `..` path-boundary checks.
- MCP `--minimal` / `INTERESTSEED_MCP_MINIMAL=1` exposes only:
  - `interestseed_next_step`
  - `interestseed_get_experiment`
  - `interestseed://next`
  - no prompts
- MCP graph path errors (missing, directory, malformed, missing nodes/edges) return
  stable tool errors; filesystem details stay on stderr.

## Tests

```text
540 Vitest tests
11 MCP smoke tests
551 tests total
```

## Install

```bash
unzip interestseed-standalone-v4.0.3.zip
node interestseed-standalone-v4.0.3/cli.js init --vault "<vault>"
node interestseed-standalone-v4.0.3/cli.js serve --vault "<vault>" --port 4173
```

Open `http://127.0.0.1:4173`.

## MCP

Full read-only mode:

```bash
node mcp/server.mjs --graph "<vault>/.interestseed/state.json"
```

Minimal exposure:

```bash
node mcp/server.mjs --minimal --graph "<vault>/.interestseed/state.json"
```

## Verify

```bash
gh attestation verify interestseed-standalone-v4.0.3.zip --repo lxc248/-interestseed
sha256sum -c interestseed-standalone-v4.0.3.sha256
```

## Upgrade

No migration is required. Existing `.interestseed` state, experiments and
discoveries remain compatible with 4.0.2.
