# Releases

The latest release is **InterestSeed Standalone 4.0.10**:

- https://github.com/lxc248/-interestseed/releases/tag/standalone-v4.0.10
- `interestseed-standalone-v4.0.10.zip`
- SHA-256: `25549c415191830da0cb03f0f453c1794c5affac7080604becf76824013d0971`

Old release notes are in [`../../archive/releases/`](../../archive/releases/).

## Release rules

- `standalone-v*` tags are immutable; create a new patch tag instead of moving
  an existing one.
- `standalone-v*` releases are built by `.github/workflows/release-standalone.yml`.
- `standalone/package.json` version must equal the tag without `standalone-v`.
- `RELEASE_NOTES_STANDALONE_<version>.md` must exist before tagging.
- Every release asset is covered by `SHA256SUMS.txt` or a matching `.sha256`.
- Release workflows run from CI, not a maintainer machine.
- Run `GITHUB_TOKEN=... npm run check:release` to compare the published asset
  digest with the site and verify the Sigstore attestation signature.

