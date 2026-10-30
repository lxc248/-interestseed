# Contributing to InterestSeed

Thanks for taking InterestSeed seriously. The project is intentionally small,
local-first, and conservative about automatic writes. Contributions should keep
that character.

## Before you start

- Read `README.md`, `SECURITY.md`, `NOTICE`, and [docs/architecture.md](docs/architecture.md).
- Search existing issues before opening a new one.
- For security issues, follow `SECURITY.md`; do not open a public issue.
- Use synthetic vaults and fixtures. Never submit real personal notes, personal
  paths, API keys, cookies, or unredacted discovery data.

## Development

```bash
git clone https://github.com/lxc248/-interestseed.git
cd interestseed
npm install
npm run verify
```

`npm run verify` runs typecheck, tests, lint, and build. Node.js 22+ is required.

Useful commands:

```bash
npm run test
npm run coverage
npm run build
node --test mcp/smoke.test.mjs
```

## Test in a disposable vault

Never test against a daily-use vault. Create a separate Obsidian vault and copy
the built plugin into:

```text
<disposable-vault>/.obsidian/plugins/interestseed/
```

Copy `dist/main.js`, `dist/styles.css`, and `manifest.json`, then enable the
plugin.

## What to work on

Good first contributions:

- documentation and tutorials;
- accessibility fixes with a reproducible axe or keyboard finding;
- deterministic tests for edge cases;
- performance improvements with a before/after measurement;
- bug fixes with a minimal reproduction.

Please open an issue before large refactors or new product surfaces.

## Architectural rules

```text
core/       domain model and invariants
services/   pure analysis and generation
storage/    persistence, migration, recovery
discovery/  discovery engine and audit
ui/         Obsidian views, canvas, modals
plugin/     orchestration and commands
```

Keep pure logic out of UI classes. Keep persistence behind repositories. Keep
user decisions explicit. Do not let AI silently mutate discoveries or graph
data. Prefer explicit failure over silent success.

## Pull request checklist

- [ ] `npm run verify` passes
- [ ] new behavior has a regression test
- [ ] user-facing changes are reflected in README or docs
- [ ] no new runtime dependency without a clear reason
- [ ] no automatic graph writes or hidden network calls
- [ ] screenshots are from a disposable vault and contain no personal data
- [ ] PR description explains the user-visible effect and the tradeoff

## License

By contributing, you agree that your contribution is licensed under
AGPL-3.0-only and that you have the right to submit it.

## Attribution

Contributors are credited through git history. Do not remove existing copyright
or NOTICE information.
