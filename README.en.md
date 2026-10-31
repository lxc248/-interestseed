<div align="center">

<h1>InterestSeed</h1>

<p><strong>A local-first interest validator</strong></p>

<p>Turn one saved post into a real 3-day action.<br/>Then let evidence decide: keep it, or let it go.</p>

<p>Works with any Markdown vault, standalone.</p>

<p><strong>Local AI, one testable connection at a time.</strong></p>

<img src="assets/standalone-ai.png" alt="InterestSeed standalone with local AI" width="900" />

<p>
  <a href="assets/interestseed-launch.mp4"><img alt="Demo" src="https://img.shields.io/badge/%E2%96%B6%2040s%20demo-111827?style=for-the-badge" /></a>
  <img alt="AI" src="https://img.shields.io/badge/AI-READY-8b5cf6?style=for-the-badge" />
  <img alt="Local model" src="https://img.shields.io/badge/LOCAL-MODEL-22c55e?style=for-the-badge" />
  <img alt="CI" src="https://github.com/lxc248/-interestseed/actions/workflows/ci.yml/badge.svg?branch=main" />
  <img alt="Release" src="https://img.shields.io/github/v/release/lxc248/-interestseed?style=for-the-badge" />
  <img alt="Tests" src="https://img.shields.io/badge/tests-530%20passing-22c55e?style=for-the-badge" />
  <img alt="Coverage" src="https://img.shields.io/badge/coverage-75.4%25-14b8a6?style=for-the-badge" />
  <img alt="License" src="https://img.shields.io/badge/license-AGPL--3.0-f59e0b?style=for-the-badge" />
</p>

<p>
  <a href="README.md">简体中文</a> ·
  <a href="assets/interestseed-launch.mp4">40s demo</a> ·
  <a href="docs/ai.en.md">AI suggestions</a> ·
  <a href="docs/tutorial.md">Tutorial</a> ·
  <a href="docs/positioning.md">Positioning</a> ·
  <a href="https://github.com/lxc248/-interestseed/releases">Download</a>
</p>

</div>

---

> Most tools help you **save it**.  
> InterestSeed helps you **test it**.

We don't lack bookmarks. We lack the part after saving: actually trying it once, then saying honestly, "worth keeping" or "let it go."

## AI is the core, not an add-on

Most AI features hand you a chat box. InterestSeed's AI does one thing: it picks the one connection in your graph that is most worth testing.

```text
One saved item → one AI suggestion → connect / next / not now → 3-day test
```

- one suggestion at a time, not a pending-confirmation wall
- a reason attached; the relation name is editable
- written only after you connect; undo is available
- sends only node id, title, and tags
- uses your own local model and key

### How the AI meets Obsidian

- right-click the active note → "Find a connection for this note"
- command palette → "Find AI connection from current note"
- graph selection → "Find connection from selected node"
- file explorer right-click uses the same action
- the AI panel stays in the right sidebar, without interrupting editing
- connect / next / not now; undo after connecting

[How the AI works →](docs/ai.en.md)

## Standalone: no longer just an Obsidian plugin

InterestSeed now runs without the Obsidian plugin runtime. An Obsidian vault is just a Markdown folder.

```text
CLI        scan / suggest / connect / serve
Local Web  graph, one AI suggestion, undo
Skill      callable by an agent
Storage    <vault>/.interestseed/
```

```bash
npm run build:standalone
node standalone/dist/cli.js init --vault "<vault>"
node standalone/dist/cli.js serve --vault "<vault>" --port 4173
```

[Standalone docs →](docs/standalone.en.md) · [Agent Skill →](standalone/skill/SKILL.md) · [CLI →](standalone/README.md)

## Where it differs from a bookmark pile

| | Bookmarks | Bidirectional notes | **InterestSeed** |
| --- | --- | --- | --- |
| Question | Where is it? | What is it linked to? | **Is it worth doing?** |
| Success metric | Items collected | Links created | **One real test completed** |
| End state | To read | A graph | **Keep / drop + next action** |
| Default action | Save | Link | **Run a small experiment** |

Bookmarks solve "don't lose it." InterestSeed tries to solve "don't pretend you'll do it."

It does not optimize node count. It optimizes **decision completion**.

## How it actually runs

One piece of content comes in. It gets one path.

```text
Capture → Decide → Connect → Verify → Review → Next action
```

| Stage | What happens |
| --- | --- |
| **Capture** | A Share Inbox takes short-video links, article excerpts, or notes. One item at a time. |
| **Decide** | Keep and connect, or pass. Passing is a valid decision, not a failure. |
| **Connect** | A kept spark joins an existing interest or starts a new one. |
| **Verify** | A 3-day starter experiment records one real action per day. |
| **Review** | An append-only Observation Timeline stores evidence and belief direction. |
| **Next action** | An explicit Markdown Interest Route states status, evidence, and the next step. |

The graph is not the product. It is the evidence layer that makes each decision inspectable.

## What it looks like

AI first, then the whole picture.

<table>
  <tr>
    <td width="50%">
      <img src="assets/onboarding.png" alt="3-minute cold start" /><br/>
      <sub><b>3-minute cold start</b>: you do not need to know what you like first.</sub>
    </td>
    <td width="50%">
      <img src="assets/experiment.png" alt="3-day experiment" /><br/>
      <sub><b>3-day experiment</b>: one real piece of evidence per day, no fake progress.</sub>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <img src="assets/plugin-cosmic.png" alt="Cosmic graph and next step" /><br/>
      <sub><b>Cosmic graph</b>: nodes, orbits, bridges, and the next step.</sub>
    </td>
    <td width="50%">
      <img src="assets/share-card-xiaohongshu.png" alt="Xiaohongshu share card" /><br/>
      <sub><b>Local share cards</b>: five platform presets, rendered on Canvas.</sub>
    </td>
  </tr>
</table>

## What you will actually use

These aren't a feature checklist. They're the moves I actually make every day.

| Capability | What it does |
| --- | --- |
| **One at a time** | Share Inbox with list and focus modes; `←` pass, `→` keep. No batch processing. |
| **Source provenance** | Every item stores source, sourceRef, capturedAt, and status; links return to the note or URL. |
| **Task state** | `captured → judged → connected → experimenting → reviewed`, derived deterministically. |
| **Observation Timeline** | Append-only evidence with `stronger / weaker / changed`, capped at 40 entries. |
| **3-day verification** | A time-boxed experiment that records what actually happened. No auto-completion. |
| **Context Search** | Deterministic multi-field search across title, tags, summary, why, raw text, source, and evidence. No embeddings. |
| **Interest Route** | An explicit Markdown MOC generated on command. It never writes notes automatically. |
| **Five share cards** | Xiaohongshu, Instagram, X, WeChat, and Story, rendered locally on Canvas. |
| **AI suggestion** | On by default; your local model only; one at a time; editable relation; undo after connecting; default `cn:deepseek-v4.1-flash` |
| **MCP interface** | Zero-dependency read-only MCP server, protocol `2026-07-28`. |
| **Adaptive layout** | Desktop, narrow, and very narrow panes with icon-first actions and no horizontal overflow. |

## Install it

### Standalone (recommended)

Or download `interestseed-standalone-v4.0.0.zip` from [Releases](https://github.com/lxc248/-interestseed/releases).

```bash
npm run build:standalone
node standalone/dist/cli.js init --vault "<vault>"
node standalone/dist/cli.js serve --vault "<vault>" --port 4173
```

Web: `http://127.0.0.1:4173`

### Obsidian plugin (compatibility)

1. Download `interestseed-v3.7.0.zip` from [Releases](https://github.com/lxc248/-interestseed/releases).
2. Extract it into:

```text
<your-vault>/.obsidian/plugins/interestseed/
```

3. Confirm `main.js`, `manifest.json`, and `styles.css` are present.
4. Obsidian → Settings → Community plugins → enable **InterestSeed**.
5. Run the cold-start questionnaire, or record a spark.
6. Process the Share Inbox, then start a 3-day experiment.

Full walkthrough: [docs/tutorial.md](docs/tutorial.md)

## MCP

```bash
# standalone
node mcp/server.mjs --graph "<vault>/.interestseed/state.json"

# Obsidian plugin compatibility
node mcp/server.mjs --graph "<vault>/.obsidian/plugins/interestseed/graphs/default.json"
```

```text
tools:      interestseed_get_graph / next_step / search_interest / get_experiment / get_context
resources:  interestseed://graph / experiment / next / context
prompts:    review-interest / plan-next-experiment
```

The MCP surface is read-only. Core functionality needs no account or model credentials.  
AI relation suggestions are on by default and only call the selected model when you ask. A setup window lets you connect your own local service key, and the model ID can be changed in settings; it lives in Obsidian SecretStorage, never in data.json. If unavailable, local rule discovery stays intact.  
Live run: cn:deepseek-v4.1-flash returned 5 focused candidates; a confirmed relation carried its reason into edge evidence.  
Rename a relation before confirming; after writing, the dialog offers an undo button instead of leaving a stale accepted state.

## How stable it is

These numbers are not decoration. I rerun them after every change.

```text
530 tests passing
75.43% line coverage
92.25% core coverage
46.53% UI coverage
axe: graph / inbox / share-card 0 violations
semgrep: 0 findings
gitleaks: no leaks
CI + Release: green
```

```bash
npm install
npm run verify      # typecheck + tests + lint + build
npm run coverage
node --test mcp/smoke.test.mjs
```

Requires Node.js 22+.

## A few principles I won't trade away

```text
Human-in-the-loop
Local-first
Explicit over automatic
Evidence over volume
Deterministic retrieval
```

InterestSeed does not scrape platforms, store cookies, auto-publish, auto-write the graph, or auto-generate routes.  
The user keeps the decision rights.

## Documentation

| Document | Contents |
| --- | --- |
| [docs/architecture.md](docs/architecture.md) | Module map, data flow, invariants, extension points |
| [docs/tutorial.md](docs/tutorial.md) | End-to-end tutorial |
| [docs/positioning.md](docs/positioning.md) | Positioning and competitive analysis |
| [docs/seed-sprint.md](docs/seed-sprint.md) | Cold-start design |
| [docs/view-modes.md](docs/view-modes.md) | Graph / inbox / discovery invariants |
| [docs/context-packet.md](docs/context-packet.md) | Data model and task state |
| [docs/share-cards.md](docs/share-cards.md) | Share-card export behavior |
| [docs/commands.md](docs/commands.md) | Command palette reference |
| [SECURITY.md](SECURITY.md) | Security model and disclosure |

## License

AGPL-3.0-only. Author: [aicoder](https://github.com/lxc248).

If you have ever saved something and quietly known you would never try it, this is for you.  
Star it if it helps. Open an issue if it doesn't. If you want to improve it, start with [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).




