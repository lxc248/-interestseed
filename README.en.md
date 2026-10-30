# InterestSeed

**An interest validator for Obsidian.**

> Turn one saved post into a real three-day action, then let evidence decide whether to keep it.

[English](README.en.md) · [简体中文](README.md) · [40-second demo](assets/interestseed-launch.mp4) · [Product design](docs/seed-sprint.md) · [Positioning](docs/positioning.md) · [Full tutorial](docs/tutorial.md)

[![InterestSeed demo cover](assets/interestseed-launch-cover.png)](assets/interestseed-launch.mp4)

<p>
  <img alt="Obsidian" src="https://img.shields.io/badge/Obsidian-1.5%2B-7c3aed" />
  <img alt="Version" src="https://img.shields.io/badge/version-3.0.3-0ea5e9" />
  <img alt="Tests" src="https://img.shields.io/badge/tests-472%20passing-22c55e" />
  <img alt="License" src="https://img.shields.io/badge/license-AGPL--3.0-f59e0b" />
  <img alt="Local first" src="https://img.shields.io/badge/local--first-yes-14b8a6" />
</p>

---

## 1. Problem

Most personal-knowledge tools answer two questions:

- “Where did I put it?”
- “What is related to it?”

InterestSeed answers a third, harder question:

- “Is this interest worth pursuing, and does it survive a real-world test?”

It is built for the gap between **saving something** and **doing something with it**.

---

## 2. Product model

```text
Capture → Decide → Connect → Verify → Review → Next action
```

| Stage | Behavior |
| --- | --- |
| **Capture** | A Share Inbox accepts short-video links, article excerpts, or notes. One item at a time. |
| **Decide** | Keep and connect, or pass. Passing is recorded as a valid decision. |
| **Connect** | A kept spark joins an existing interest or starts a new one. |
| **Verify** | A three-day starter experiment records one real action per day: did, thought, or did not. |
| **Review** | An append-only Observation Timeline stores evidence with belief direction. |
| **Next action** | An explicit Markdown Interest Route summarizes status, evidence, and the next step. |

The graph is an evidence layer, not the product.

---

## 3. Core capabilities

### One decision at a time

The Share Inbox supports list and focus modes. Focus mode maps `←` to pass and `→` to keep. There is no batch processing.

### Source provenance

Every captured item stores:

```text
source
sourceRef
text
capturedAt
status
```

Source links resolve back to the original note or external URL.

### Interest task state

```text
captured → judged → connected → experimenting → reviewed
```

State is resolved deterministically from node metadata and connections.

### Observation Timeline

Append-only evidence, capped at 40 entries, with:

```text
stronger / weaker / changed
date
evidence
```

It records why an interest was kept and whether it still holds.

### Three-day verification

Experiments are time-boxed and require real input. There is no fabricated progress.

### Context Search

Deterministic multi-field search over:

```text
title
tags
summary
why
raw text
source path
observation evidence
```

No embeddings or external APIs are required.

### Interest Route

An explicit Markdown MOC generated only on command. It never writes or overwrites notes automatically.

### Unified view modes

```text
graph
inbox (relationship suggestions)
discoveries
```

Selecting a node always returns to graph detail.

### Adaptive layout

The workspace adapts across widths:

```text
wide: full validation loop
narrow: icon-first quick actions
very narrow: structural fallback with a width hint
```

### Share cards

Five platform-specific cover cards rendered locally on Canvas:

```text
Xiaohongshu 1080×1440
Instagram   1080×1350
X / Weibo   1600×900
WeChat      1080×1080
Story       1080×1920
```

They are re-composed from the graph, not screenshots of the UI.

---

## 4. Design principles

```text
Human-in-the-loop
Local-first
Explicit over automatic
Evidence over volume
Deterministic retrieval
```

InterestSeed does not scrape platforms, store cookies, auto-publish, auto-write the graph, or auto-generate routes. The user retains decision rights.

---

## 5. Quick start

1. Download `interestseed-v3.0.3.zip` from [Releases](https://github.com/lxc248/-interestseed/releases).
2. Extract into:

```text
<your-vault>/.obsidian/plugins/interestseed/
```

3. Confirm `main.js`, `manifest.json`, and `styles.css` are present.
4. Enable the plugin under Obsidian → Community plugins.
5. Run the cold-start questionnaire or record a spark.
6. Process the Share Inbox, then start a three-day experiment.

The full walkthrough is in [docs/tutorial.md](docs/tutorial.md).

---

## 6. MCP interface

InterestSeed ships a zero-dependency MCP server implementing protocol `2026-07-28`.

```bash
node mcp/server.mjs --graph "<vault>/.obsidian/plugins/interestseed/graphs/default.json"
```

Tools:

```text
interestseed_get_graph
interestseed_next_step
interestseed_search_interest
interestseed_get_experiment
interestseed_get_context
```

Resources:

```text
interestseed://graph
interestseed://experiment
interestseed://next
interestseed://context
```

Prompts:

```text
review-interest
plan-next-experiment
```

The MCP surface is read-only. Core product functionality requires no account, no API key, and no model credentials.

---

## 7. Repository structure

```text
src/core          domain model: graph, observations, task state
src/services      analysis and route generation
src/ui            Obsidian view, canvas, modals, filters
mcp/              read-only MCP server
tests/            Vitest unit and simulation tests
docs/             product and usage documentation
promo/            reproducible UI and persona test scripts
review/           acceptance reports and visual evidence
```

---

## 8. Development

```bash
npm install
npm run verify
npm run build
```

`npm run verify` runs:

```text
typecheck
tests
lint
build
```

Current state:

```text
56 test files
472 tests passing
```

Requires Node.js 20+.

---

## 9. Documentation

```text
docs/positioning.md     product positioning and competitive analysis
docs/tutorial.md        end-to-end usage tutorial
docs/seed-sprint.md     cold-start design
docs/view-modes.md      graph / inbox / discoveries invariants
docs/context-packet.md  data model and task state
docs/share-cards.md     social export behavior
docs/commands.md        command palette reference
```

---

## 10. License

AGPL-3.0-only. Author: aicoder. See [LICENSE](LICENSE).
