# Global assessment — 2026-11-08

Strict engineering and product review of `interestseed` at `2c6b366`.

This is not a marketing score. It measures whether the project is ready to be
treated as a mature open-source product. Evidence was collected from the
repository, CI, release, GitHub metadata, coverage and manual checks.

## Verdict

**6.4 / 10 — promising, not yet mature.**

The product idea, safety boundaries and documentation are stronger than the
average hobby project. Coverage is now above the 80% line threshold after
adding GraphCanvas, ShareCardRenderer and AI tests. Public-site E2E now runs in
CI. The two hard limits remain external adoption and repository weight;
app-level E2E, accessibility and release automation are still gaps.

| Grade | Meaning |
| --- | --- |
| 9.0–10 | World-class, defensible, proven |
| 8.0–8.9 | Strong and ready for broad use |
| 7.0–7.9 | Good, with material gaps |
| 6.0–6.9 | Promising, not yet mature |
| < 6.0 | Not ready |

## Weighted score

| Category | Weight | Score | Weighted | Why this score |
| --- | ---: | ---: | ---: | --- |
| Product value / differentiation | 15% | 7.0 | 1.05 | Clear “capture → one connection → 3-day experiment → evidence” loop; unproven demand |
| Product completeness / UX | 15% | 7.0 | 1.05 | CLI, web, skill, MCP and site exist; public-site E2E gated; app E2E still missing |
| Code quality / maintainability | 15% | 7.0 | 1.05 | Strict TypeScript, modular layout, lint/typecheck; some large low-coverage modules |
| Tests / QA | 15% | 7.0 | 1.05 | 580 tests, 85.50% line / 71.83% branch coverage; app E2E and axe still missing |
| Security / privacy | 15% | 7.5 | 1.125 | Critical leak fixed, guards and body limit tested; no independent 4.0.3 audit |
| Docs / repo hygiene | 5% | 6.5 | 0.325 | Excellent current docs and checks; 171.8 MB tree, 149.3 MB archive |
| Release / supply chain | 10% | 6.0 | 0.60 | 4.0.3 hash and release notes; new workflow not exercised; provenance unverified |
| Distribution / adoption | 10% | 1.5 | 0.15 | 1 star, 0 forks, 3 downloads of 4.0.3, no external citations |
| **Total** | **100%** |  | **6.4** | **Promising, not yet mature** |

## Evidence

### Engineering

```text
main:                 9042384
Vitest:              564 passed
MCP smoke:            11 passed
Total tests:         580 passed
Coverage statements:  82.74%
Coverage branches:    71.83%
Coverage functions:   85.07%
Coverage lines:       85.50%
Playwright E2E:       5 passed
Typecheck:            passed
Lint:                 passed
Build:                passed
npm audit:            0 vulnerabilities
Plugin bundle:        652.23 kB (gzip 164.87 kB)
Standalone CLI:       145.48 kB (gzip 37.87 kB)
```

Low-coverage areas that still matter:

```text
src/ui/GraphCanvas.ts          63.97% lines
standalone/src/server.ts       60.69% lines
standalone/src/state.ts        71.42% lines
```

### Site and docs

```text
Site check:           7 HTML pages passed
Docs check:           44 Markdown files passed
Version check:        all references = 4.0.3
npm audit:            0 vulnerabilities
Site manual FPS:      ~61 fps at 1440×1000
```

### Repository weight

```text
Tracked tree:         171.8 MB
archive/:             149.3 MB (455 files)
assets/:              20.2 MB (13 files)
largest file:         assets/interestseed-launch.mp4 (10.9 MB)
```

This is a serious fork/clone and CI-cache cost. The current tree is larger than
many production applications.

### Release and adoption

```text
Latest release:       standalone-v4.0.3
Release downloads:    3
Stars:                1
Forks:                0
Open issues:          0
Open PRs:             0
External citations:   not established
```

### Security posture

Strong:

```text
Loopback-only server
JSON-only state-changing routes
Origin / Sec-Fetch-Site checks
Static path boundary
Encoded traversal test
CSP / nosniff / DENY / no-referrer
Generic 500 without internal exception text
1 MiB request body limit
MCP --minimal exposure
MCP graph path error handling
Dependabot + npm audit 0
```

Still open:

- No independent audit of the 4.0.3 changes.
- The local server still trusts any local process; that is the model, but it
  should be stated more explicitly for users.
- Full MCP mode exposes graph summaries and `sourceRef`; `--minimal` reduces
  this but is not the default.
- New `standalone-v*` release workflow has not yet run in production.

## What is genuinely strong

1. **The product loop is unusual and defensible.** Most tools stop at capture;
   InterestSeed forces one connection and a 3-day evidence step.
2. **The AI boundary is narrow and explicit.** Metadata-only requests are a
   real differentiator, not a slogan.
3. **The surface is broad.** CLI, local web, agent skill and read-only MCP share
   one graph.
4. **The docs and checks are better than most small projects.** Version, site,
   docs, JSON-LD, sitemap and security checks are automated.
5. **Release artifacts are checksummed and the 4.0.3 hash is verified.**

## What prevents a higher score

### P0 — project viability

1. **No adoption evidence.** 1 star, 0 forks and 3 downloads do not demonstrate
   demand. A good product nobody can find is still an unproven product.
2. **No external citation.** AI visibility is near zero; the site is not enough
   without backlinks and directory mentions.
3. **No user evidence.** There are no interviews, retention numbers or
   real-user experiment outcomes in the repository.

### P1 — engineering quality

4. **Coverage is uneven.** The floor is now 81/70/84/84, but
   `standalone/src/server.ts` is 60.69% lines and `GraphCanvas` is 63.97%.
5. **No app-level browser E2E / visual regression.** Public-site smoke tests now
   run in CI, but graph interactions, modals and mobile app layout are still
   only covered by jsdom tests.
6. **No accessibility audit.** Skip links and focus styles are present, but no
   axe/Lighthouse result is recorded.
7. **Repository weight.** 171.8 MB tracked is excessive; archive media dominates.
8. **Release workflow is new and untested.** The 4.0.3 release was assembled
   before the workflow existed.

## Strict score by dimension

| Dimension | Score | Strict interpretation |
| --- | ---: | --- |
| Idea | 8.0 | Clear, differentiated, worth testing |
| Implementation | 7.0 | Broad and coherent; uneven depth |
| Test confidence | 7.0 | Coverage above 80% lines; E2E and branch depth still missing |
| Security | 7.5 | Strong recent hardening; not independently audited |
| Documentation | 8.0 | Current docs are good; archive bloat hurts repo hygiene |
| Release discipline | 6.0 | Checksums and rules exist; automation not proven |
| Distribution | 1.5 | Effectively zero reach |
| **Overall** | **6.4** | **Promising prototype, not yet a mature product** |

## 30-day improvement plan

### Week 1 — quality floor

- Keep the coverage floor at `81/70/84/84`; raise branches to 72.
- Add `axe` checks for the landing page and content pages.
- Add an app-level Playwright smoke test for: load, search, filter, select node,
  open settings, close modal.
- Add server route coverage for capture / connect / config.

### Week 2 — repository weight

- Move archived MP4/GIF/WAV assets out of Git into release assets or object
  storage.
- Keep only small thumbnails in `archive/`.
- Target tracked tree: **< 40 MB**.

### Week 3 — release proof

- Cut `4.0.4` through `release-standalone.yml`.
- Verify the downloaded zip hash and provenance attestation.
- Record an independent 4.0.4 audit covering the server/MCP changes.

### Week 4 — distribution proof

- Submit to three directories with UTM links.
- Record referral traffic and one real user interview.
- Publish one case study with real evidence, not a synthetic score.

## Exit criteria for 7.5 / 10

The project reaches “good” only when all of these are true:

```text
coverage >= 85% lines / 72% branches
browser app E2E and visual regression run in CI
axe passes on all public pages
tracked tree < 40 MB
4.0.4 released through the automated workflow
provenance verified from the downloaded asset
at least 3 external citations
at least 10 real users or 3 interviews
```

## Method and limits

- Scores are based on repository evidence, not interviews or telemetry.
- There is no production analytics, so retention and conversion are unknown.
- The manual FPS check is a single headless run, not a field performance study.
- No independent security review of 4.0.3 was available.
- A high engineering score cannot compensate for zero distribution; the weights
  intentionally keep adoption material.
