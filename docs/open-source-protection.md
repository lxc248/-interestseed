# Open Source, Brand Protected

InterestSeed is open source. That is deliberate: the code, the data model, the
tests and the release process are public.

Open source does **not** mean "anyone may do anything with the name, the brand,
or a hosted derivative". This document explains the protection layers and what
to do when someone crosses the line.

## The honest boundary

No source-available or open-source project can prevent a determined person from
copying source code. Obfuscation, hidden telemetry, license traps and DRM are
not protection; they damage trust and are not used here.

What can be protected:

1. **Copyright and license compliance** — AGPL-3.0-only.
2. **Brand identity** — the InterestSeed name, logo and visual identity.
3. **Attribution** — NOTICE and copyright notices must travel with the code.
4. **Release integrity** — checksums and build provenance.
5. **Commercial use** — a separate commercial license for closed-source or
   non-compliant hosted use.

## Layer 1: AGPL-3.0-only

The code is licensed under `AGPL-3.0-only`. The network clause matters:

- If someone modifies InterestSeed and offers it as a network service, they
  must offer the corresponding source to those users.
- If someone distributes a modified version, it must remain under AGPL-3.0.
- Removing copyright or license notices is a license violation.

AGPL is a real open-source license. It is also the strongest practical copyleft
for a local-first tool that may be hosted as a service.

## Layer 2: trademark and brand

`TRADEMARKS.md` is not optional decoration. It states that the AGPL covers the
code, not the brand. Forks must:

- use a different product name and icon;
- preserve LICENSE, NOTICE and copyright notices;
- disclose modifications;
- link back to the original repository;
- avoid implying endorsement.

The name `InterestSeed`, the logo and the distinctive visual system are brand
assets. A fork can be open source and still must not present itself as the
official InterestSeed.

## Layer 3: attribution

`NOTICE` lists the original work and the attribution requirements. Redistributors
must preserve it. This is how a copy remains traceable even when the code is
embedded in a larger product.

## Layer 4: release integrity

Official releases should be verifiable:

- `SHA256SUMS.txt` for every release asset;
- GitHub build provenance attestations for release archives;
- release tags signed or protected in GitHub;
- build from a clean checkout in CI, not from a maintainer laptop.

Users can verify a download with:

```bash
sha256sum -c SHA256SUMS.txt
gh attestation verify interestseed-v4.0.4.zip --repo lxc248/-interestseed
```

## Layer 5: commercial license

`COMMERCIAL_LICENSE.md` explains the separate path for closed-source use,
hosted services that cannot comply with AGPL, and brand permission.

This is not a bait-and-switch: the open-source license remains valid for
everyone who complies with it. The commercial license exists for organizations
that cannot.

## What to do when a copy violates the license

1. Preserve evidence: URL, timestamp, screenshots, repository metadata.
2. Check whether the copy preserves LICENSE, NOTICE and copyright notices.
3. If it is a hosted derivative, check whether it offers corresponding source.
4. Contact the maintainer of the copy with a precise, factual request.
5. If unresolved, use the host's copyright/DMCA process or consult counsel.
6. Do not harass individual users; target the distribution or service.

## What not to do

- Do not add hidden phone-home code to "detect" copies.
- Do not claim the project is not open source while shipping an AGPL license.
- Do not add a license trap that revokes rights retroactively.
- Do not use trademark threats against legitimate commentary, reviews or forks
  that follow the fork rules.

## Fork checklist

A public fork that follows the rules should be welcome:

- [ ] different product name and icon
- [ ] LICENSE, NOTICE and copyright notices preserved
- [ ] modifications disclosed
- [ ] link back to the original repository
- [ ] no official-looking branding or endorsement claim

This document is not legal advice. For a real dispute, consult qualified counsel
in the relevant jurisdiction.

