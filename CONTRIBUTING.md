# Contributing to InterestSeed

Thanks for helping improve InterestSeed.

## Before you start

- Read `README.md`, `SECURITY.md` and `NOTICE`.
- Search existing issues before opening a new one.
- For security issues, follow `SECURITY.md`; do not open a public issue.
- Use synthetic vaults and fixtures. Never submit real personal notes.

## Development

```bash
npm install
npm run verify
npm run deploy
```

`npm run verify` runs typecheck, tests, lint and build. `npm run deploy`
refuses to copy a failing build into an Obsidian vault.

## Pull requests

A good PR includes:

- a focused problem statement;
- the smallest safe change;
- tests for behavior changes;
- a note on data migration or recovery impact;
- no secrets, personal paths or vault contents;
- preserved copyright, NOTICE and attribution notices.

## Design rules

- Do not let AI silently mutate discoveries or graph data.
- Preserve provenance, evidence and feedback history.
- Prefer explicit failure over silent success.
- Keep local-only insight available when AI is disabled.
- Treat the vault as private data by default.
- Keep desktop/mobile loading boundaries explicit.

## License

By contributing, you agree that your contribution is licensed under the
project's AGPL-3.0 license and that you have the right to submit it.

## Attribution

Contributors are credited through git history. Do not remove existing
copyright or NOTICE information.
