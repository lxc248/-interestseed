# InterestSeed

**An interest validator for Obsidian.**

> Turn one saved post into a real three-day action, then let evidence decide whether to keep it.

[简体中文](README.md) · [English](README.en.md) · [40-second demo](assets/interestseed-launch.mp4) · [Product design](docs/seed-sprint.md) · [Positioning](docs/positioning.md) · [Full tutorial](docs/tutorial.md)

[![InterestSeed demo cover](assets/interestseed-launch-cover.png)](assets/interestseed-launch.mp4)

<p>
  <img alt="Obsidian" src="https://img.shields.io/badge/Obsidian-1.5%2B-7c3aed" />
  <img alt="Version" src="https://img.shields.io/badge/version-2.7.3-0ea5e9" />
  <img alt="Tests" src="https://img.shields.io/badge/tests-471%20passing-22c55e" />
  <img alt="License" src="https://img.shields.io/badge/license-AGPL--3.0-f59e0b" />
  <img alt="Local first" src="https://img.shields.io/badge/local--first-yes-14b8a6" />
</p>

---

## 1. What problem it solves

InterestSeed targets a specific failure pattern: **people collect far more than they pursue.**

Existing tools optimize recall, organization, or memory. They answer:

- “Where is the thing I saved?”
- “What is related to it?”

InterestSeed answers a different question:

- “Is this interest worth doing, and after I actually try it, does it still hold?”

It therefore optimizes for **decision completion**, not node count.

---

## 2. Product model

```text
Capture → Decide → Connect → Verify → Review → Next action
```

| Stage | Behavior |
| --- | --- |
| **Capture** | A Share Inbox receives short-video links, article quotes, or notes. One item at a time. |
| **Decide** | Keep and connect, or pass. Passing is a valid outcome, not a failure. |
| **Connect** | Each kept spark is connected to an existing interest or becomes a new one. |
| **Verify** | A three-day starter experiment records one real action per day: did, thought, or did not. |
| **Review** | An append-only Observation Timeline stores evidence with belief direction. |
| **Next action** | An explicit Markdown Interest Route summarizes status, evidence, and the next step. |

The graph is not the product. It is the evidence layer that makes each decision inspectable.

---

## 3. Core capabilities

### One decision at a time

The Share Inbox has list and focus modes. Focus mode supports `←` pass and `→` keep. No batch processing.

### Source provenance

Every captured item stores:

```text
source
sourceRef
text
capturedAt
status
```

Source links return to the original note or external URL.

### Interest task state

```text
captured → judged → connected → experimenting → reviewed
```

States are resolved deterministically from node metadata and connections.

### Observation Timeline

Evidence entries are append-only, capped at 40, and record:

```text
stronger / weaker / changed
date
evidence
```

The timeline answers why an interest was kept, what happened, and whether it still holds.

### Three-day verification

Experiments are time-boxed and non-fabricated. Users record what actually happened; there is no automatic progress.

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

No embeddings and no external API are required.

### Interest Route

An explicit Markdown MOC generated only on command. It never writes or overwrites notes automatically.

### Unified view modes

```text
graph
inbox (relationship suggestions)
discoveries
```

Selecting a node always returns to graph detail, regardless of the active mode.

### Adaptive layout

The workspace adapts from desktop to very narrow panes:

```text
wide: full validation loop
narrow: icon-first quick actions
very narrow: structural fallback with a width hint
```

### Share cards

Five platform-specific cover cards are rendered locally on Canvas:

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

InterestSeed does not scrape platforms, store cookies, auto-publish, auto-write the graph, or auto-generate routes. The user keeps the decision rights.

---

## 5. Quick start

1. Download `interestseed-v2.7.3.zip` from [Releases](https://github.com/lxc248/-interestseed/releases).
2. Extract into:

```text
<your-vault>/.obsidian/plugins/interestseed/
```

3. Ensure `main.js`, `manifest.json`, and `styles.css` are present.
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
471 tests passing
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

AGPL-3.0-only. See [LICENSE](LICENSE).
