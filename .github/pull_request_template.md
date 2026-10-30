## What changed

<!-- One paragraph. Explain the user-visible effect, not only the code change. -->

## Why

<!-- The problem, reproduction, or measurement. -->

## Verification

- [ ] `npm run verify`
- [ ] `npm run coverage`
- [ ] `node --test mcp/smoke.test.mjs` (if MCP changed)
- [ ] tested in a disposable Obsidian vault

## Risk

<!-- Data migration, persistence, accessibility, performance, or none. -->

## Privacy

- [ ] no real vault contents, personal paths, keys, cookies, or unredacted data
- [ ] screenshots come from a disposable vault

## Checklist

- [ ] new behavior has a regression test
- [ ] docs/README updated when user-facing
- [ ] no automatic graph writes or hidden network calls
- [ ] no new runtime dependency without a clear reason
