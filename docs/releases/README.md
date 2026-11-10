# Releases

The latest release is **InterestSeed Standalone 4.0.11**:

- https://github.com/lxc248/-interestseed/releases/tag/standalone-v4.0.11
- `interestseed-standalone-v4.0.11.zip`
- SHA-256: `ef61aa4c53b4b8000ee40e66e77916e40be34d290ca73bbd212b5e7d01a34bcf`

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

