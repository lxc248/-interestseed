# InterestSeed Standalone 4.0.1

Small but useful follow-up to 4.0.0. No data migration is required; keep your
existing `.interestseed/` directory.

## What changed

- **Graph search.** Search nodes by title or tag, stack it with the stage filter,
  and see the result count in the graph subtitle.
- **Keyboard shortcuts.** Press `/` to focus search and `Esc` to clear it.
- **Friendly AI errors.** When the local model is offline, the AI panel now shows
  a readable error card with `重试` and `打开设置` instead of a raw fetch error.
- **Settings connection test.** A new `测试连接` button checks the current model,
  endpoint and key. It tries `/models` first, then a one-token chat completion,
  and reports latency and model count.
- **Regression coverage.** Discovery feedback lifecycle and experiment extension
  now have tests. 531 tests passing.

## Upgrade

```bash
unzip interestseed-standalone-v4.0.1.zip
node interestseed-standalone-v4.0.1/cli.js init --vault "<vault>"
node interestseed-standalone-v4.0.1/cli.js serve --vault "<vault>" --port 4173
```

Open `http://127.0.0.1:4173`.

## Verify the download

```bash
sha256sum -c SHA256SUMS.txt
gh attestation verify interestseed-standalone-v4.0.1.zip --repo lxc248/-interestseed
```

## License

AGPL-3.0-only. See `LICENSE`, `NOTICE`, `TRADEMARKS.md` and
`COMMERCIAL_LICENSE.md` in the repository.
