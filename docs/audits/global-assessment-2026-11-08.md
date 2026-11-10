# Global assessment — 2026-11-08

Strict engineering and product review of `interestseed` at `9e9d99a`.

This is not a marketing score. It measures whether the project is ready to be
treated as a mature open-source product. Evidence was collected from the
repository, CI, release, GitHub metadata, coverage and manual checks.

## Verdict

**6.7 / 10 — promising, not yet mature.**

The product idea, safety boundaries and documentation are stronger than the
average hobby project. Coverage is now above the 80% line threshold, and
public-site, app-level and axe accessibility checks now run in CI. The two hard
limits remain external adoption and repository weight; app-state visual coverage and app depth are still gaps.

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
| Product value / differentiation | 15% | 7.2 | 1.08 | Clear “capture → one connection → 3-day experiment → evidence” loop; unproven demand |
| Product completeness / UX | 15% | 7.6 | 1.14 | CLI, web, skill, MCP and site exist; site + app E2E and axe gated; public pages plus app home/settings/capture/experiment/sprint/share/audit/correction visuals; landing layout with canvas hidden; animation itself not diffed |
| Code quality / maintainability | 15% | 7.3 | 1.10 | Strict TypeScript, 17 extracted plugin modules, app.js 589 lines, main.ts 1051 lines; remaining onload/onunload glue |
| Tests / QA | 15% | 8.0 | 1.20 | 694 tests, 85.83% line / 72.51% branch coverage; public pages plus app home/settings/capture/experiment/sprint/share/audit/correction visuals; landing layout with canvas hidden; animation itself not diffed |
| Security / privacy | 15% | 8.0 | 1.20 | Critical leak fixed, guards and body limit tested; no independent 4.0.9 audit |
| Docs / repo hygiene | 5% | 7.2 | 0.36 | Excellent current docs and checks; 29.6 MB tree, 2.5 MB archive; history still large |
| Release / supply chain | 10% | 8.5 | 0.85 | 4.0.9 built by workflow; digest and Sigstore attestation verified; no independent audit |
| Distribution / adoption | 10% | 1.5 | 0.15 | 1 star, 0 forks, 0 downloads of 4.0.9, no external citations |
| **Total** | **100%** |  | **7.1** | **Promising, not yet mature** |

## Evidence

### Engineering

```text
main:                 9e9d99a
Vitest:              574 passed
MCP smoke:            11 passed
Total tests:         694 passed
Coverage statements:  82.96%
Coverage branches:    72.15%
Coverage functions:   85.16%
Coverage lines:       85.71%
Playwright E2E:       31 passed
Typecheck:            passed
Lint:                 passed
Build:                passed
npm audit:            0 vulnerabilities
CodeQL open alerts:   0
Plugin bundle:        652.23 kB (gzip 164.87 kB)
Standalone CLI:       148.32 kB (gzip 38.84 kB)
```

Low-coverage areas that still matter:

```text
src/ui/GraphCanvas.ts          63.97% lines
standalone/src/server.ts       60.69% lines
standalone/src/state.ts        71.42% lines
```

### Site and docs

```text
Site check:           8 HTML pages passed
Docs check:           44 Markdown files passed
Version check:        all references = 4.0.9
npm audit:            0 vulnerabilities
CodeQL open alerts:   0
Site manual FPS:      ~61 fps at 1440×1000
```

### Repository weight

```text
Tracked tree:         29.6 MB
archive/:             2.5 MB (97 files)
assets/:              20.2 MB (13 files)
largest file:         assets/interestseed-launch.mp4 (10.9 MB)
```

The current tree is now 29.6 MB. The Git clone history remains large because
historical media is retained; a full history rewrite is still pending.

### Release and adoption

```text
Latest release:       standalone-v4.0.9
Release downloads:    0
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

- No independent audit of the 4.0.9 changes.
- The local server still trusts any local process; that is the model, but it
  should be stated more explicitly for users.
- Full MCP mode exposes graph summaries and `sourceRef`; `--minimal` reduces
  this but is not the default.
- The automated release workflow has now run and published 4.0.9; its Sigstore
  attestation signature is verified by `check:release`, but no independent
  human audit exists.

## What is genuinely strong

1. **The product loop is unusual and defensible.** Most tools stop at capture;
   InterestSeed forces one connection and a 3-day evidence step.
2. **The AI boundary is narrow and explicit.** Metadata-only requests are a
   real differentiator, not a slogan.
3. **The surface is broad.** CLI, local web, agent skill and read-only MCP share
   one graph.
4. **The docs and checks are better than most small projects.** Version, site,
   docs, JSON-LD, sitemap and security checks are automated.
5. **Release artifacts are checksummed and the 4.0.9 digest is verified.**

## What prevents a higher score

### P0 — project viability

1. **No adoption evidence.** 1 star, 0 forks and 3 downloads do not demonstrate
   demand. A good product nobody can find is still an unproven product.
2. **No external citation.** AI visibility is near zero; the site is not enough
   without backlinks and directory mentions.
3. **No user evidence.** There are no interviews, retention numbers or
   real-user experiment outcomes in the repository.

### P1 — engineering quality

4. **Coverage is uneven.** The floor is now 82/71/85/85, but
   `standalone/src/server.ts` is 60.69% lines and `GraphCanvas` is 63.97%.
5. **Visual regression is partial.** Linux screenshot baselines cover
   `/how-it-works/`, `/download/`, app home, settings, capture, experiment,
   sprint, share card, discovery audit, correction and the landing layout with
   its canvas hidden; the canvas animation itself is not screenshot-diffed.
6. **Repository weight.** The current tree is 29.6 MB, under the 40 MB target, but the Git clone history still retains historical media.
7. **No independent release audit.** The workflow executed and the digest was
   verified, but provenance and the 4.0.9 changes have not been independently
   checked.

## Strict score by dimension

| Dimension | Score | Strict interpretation |
| --- | ---: | --- |
| Idea | 8.0 | Clear, differentiated, worth testing |
| Implementation | 7.0 | Broad and coherent; uneven depth |
| Test confidence | 7.6 | Coverage above 80% lines; site/app E2E and axe gated; eleven visual baselines |
| Security | 8.0 | Host/token/key/consent hardening; not independently audited |
| Documentation | 8.0 | Current docs are good; archive bloat hurts repo hygiene |
| Release discipline | 8.5 | 4.0.9 workflow, digest and identity-bound Sigstore verified |
| Distribution | 1.5 | Effectively zero reach |
| **Overall** | **6.7** | **Promising prototype, not yet a mature product** |

## 30-day improvement plan

### Week 1 — quality floor

- Keep the coverage floor at `81/70/84/84`; raise branches to 72.
- Extend app E2E to cover graph selection and modal error states.
- Extend visual regression snapshots to the landing page and key app states.
- Add server route coverage for experiments and discoveries.

### Week 2 — repository weight

- Move archived MP4/GIF/WAV assets out of Git into release assets or object
  storage.
- Keep the current tree under 40 MB; historical media remains in Git history.
- Target tracked tree: **< 40 MB**.

### Week 3 — release proof

- Verify the downloaded zip hash and provenance attestation.
- Record an independent 4.0.9 audit covering the server/MCP changes.

### Week 4 — distribution proof

- Submit to three directories with UTM links.
- Record referral traffic and one real user interview.
- Publish one case study with real evidence, not a synthetic score.

## Exit criteria for 7.5 / 10

The project reaches “good” only when all of these are true:

```text
coverage >= 85.5% lines / 72.5% branches
visual regression covers key public and app states
tracked tree < 40 MB
independent 4.0.9 audit completed
at least 3 external citations
at least 10 real users or 3 interviews
```

## Method and limits

- Scores are based on repository evidence, not interviews or telemetry.
- There is no production analytics, so retention and conversion are unknown.
- The manual FPS check is a single headless run, not a field performance study.
- No independent security review of 4.0.9 was available.
- A high engineering score cannot compensate for zero distribution; the weights
  intentionally keep adoption material.
