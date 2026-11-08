# Releases

The latest release is **InterestSeed Standalone 4.0.3**:

- https://github.com/lxc248/-interestseed/releases/tag/standalone-v4.0.3
- `interestseed-standalone-v4.0.3.zip`
- SHA-256: `d3bb3dad973345b8b1d420411d875c1349bd482858d28c584b12117cbcbbc9ff`

Old release notes are in [`../../archive/releases/`](../../archive/releases/).

## Release rules

- `standalone-v*` tags are immutable; create a new patch tag instead of moving
  an existing one.
- `standalone-v*` releases are built by `.github/workflows/release-standalone.yml`.
- `standalone/package.json` version must equal the tag without `standalone-v`.
- `RELEASE_NOTES_STANDALONE_<version>.md` must exist before tagging.
- Every release asset is covered by `SHA256SUMS.txt` or a matching `.sha256`.
- Release workflows run from CI, not a maintainer machine.

