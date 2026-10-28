# InterestSeed

**Turn scattered vault notes into a confirmable, traceable, actionable interest graph.**

[简体中文](README.md) · [English](README.en.md)

![InterestSeed interest graph](assets/screenshot-1.png)

<p>
  <img alt="Obsidian" src="https://img.shields.io/badge/Obsidian-1.5%2B-7c3aed" />
  <img alt="Version" src="https://img.shields.io/badge/version-0.1.3-0ea5e9" />
  <img alt="Tests" src="https://img.shields.io/badge/tests-437%20passing-22c55e" />
  <img alt="License" src="https://img.shields.io/badge/license-AGPL--3.0-f59e0b" />
</p>

---

## 1. What InterestSeed Is

InterestSeed is not an AI chat shell bolted onto a sidebar, and it is not another graph view.

It is a local-first interest workspace for **Obsidian**:

```text
Markdown notes
    ↓ scan / parse / classify
Traceable nodes and relations
    ↓ rule discovery / evidence / human confirmation
Discovery inbox
    ↓ accept / reject / correct / low-value / needs-verification
Graph changes + feedback memory
    ↓ local aggregation / anonymization / optional AI
Themes, project matrix, rhythm, next step
    ↓ Qwen / optional DSH Agent
Read the vault, call tools, take the next step
```

The problem is not that you write too little. It is that you cannot tell:

> What keeps recurring, what deserves another pass, and what is just noise?

InterestSeed turns those signals into a structure you can confirm, not a structure an AI silently rewrites.

---

## 2. How It Differs

| Common pattern | InterestSeed |
| --- | --- |
| Model writes graph mutations directly | Relations start as `suggested` and require confirmation |
| A chat bubble with no workflow | Graph, discovery, exploration and Agent share one workspace |
| Rejecting an item means it comes back tomorrow | `rejected` is persisted as suppression memory |
| AI reads full notes | Explore AI receives anonymized theme/project aggregates only |
| “Related” with no explanation | Every edge carries `origin`, `status`, `confidence`, `evidence` |
| One-click apply with unclear failure | Full state machine: `applying / applied / existing / failed / stale / recovery-required` |
| AI is the only intelligence | Local rule-based insight always works; AI is an enhancement |
| Agent lives in a separate plugin | DSH Agent is connected through ACP to the same vault context |

---

## 3. Core Capabilities

### 3.1 Graph foundation: explainable, not merely plausible

- Scans Markdown through `Vault.getMarkdownFiles()` and `MetadataCache`;
- Classifies nodes from frontmatter `type`, `project`, `activity` and file extensions;
- Parses wikilinks, shared tags and user-defined themes into candidate relations;
- Every edge keeps:
  - `origin`: `user` / `rule` / `ai`
  - `status`: `confirmed` / `suggested` / `rejected`
  - `confidence`
  - `evidence`
- Scanned edges are suggestions until confirmed;
- Rejected relations leave suppression records and do not keep resurfacing;
- Relation labels are editable while IDs, origin and status stay stable;
- Graph and viewport are persisted; undo / redo are supported;
- Custom Canvas renderer with no runtime graph-library dependency.

### 3.2 Discovery: a candidate engine with feedback memory

A discovery is a lifecycle object, not a random recommendation:

```text
active → accepted / rejected / corrected / low-value / needs-verification
                         ↓
                    feedbackHistory
                         ↓
                   soft undo
```

- Cross-project shared tags, themes and confirmed relations produce “shared theme” discoveries;
- Accepted, rejected, corrected, low-value and needs-verification are distinct semantics;
- Feedback supports soft undo; history is never erased;
- Identity, dedupe and suppression keys are independent of display copy;
- Discoveries are stored independently from the graph;
- Applying a discovery to the graph requires explicit confirmation;
- Failed application never marks a discovery as applied;
- `existing`, `stale` and `recovery-required` states are represented.

### 3.3 Explore Studio: from data to next action

Explore Studio is a decision surface, not a stats page:

- **01 / Signals** — local conclusions first;
- **02 / Themes** — theme entry points ranked by activity and cross-project spread;
- **03 / Matrix** — theme × project heatmap;
- **04 / Rhythm** — seven-day feedback rhythm;
- **05 / Explain** — optional AI explanation.

Every insight follows:

```text
Evidence → Judgment → Next step
```

It does not just say “you have many themes”. It says which theme is spreading across projects, what evidence supports it, and what to do next.

### 3.4 AI backend: Qwen (DashScope) first, DSH optional

The default AI backend is **Qwen / DashScope OpenAI-compatible**:

```text
InterestSeed
    → https://dashscope.aliyuncs.com/compatible-mode/v1
    → qwen-turbo (or another Qwen model available to the account)
```

- API base URL, model ID and the user token are configurable; the token goes to Obsidian SecretStorage, not data.json, and `DASHSCOPE_API_KEY` / `QWEN_API_KEY` remain supported;
- Explore AI sends only anonymized theme/project aliases, aggregate counts and activity data;
- Qwen Agent mode is a direct chat: it does not read the vault and has no local tool permissions;
- A missing key produces an explicit “Qwen key not configured” message, with no silent fallback or retry;
- Free quota, model availability and rate limits are determined by the platform account.

### 3.5 DSH Agent (optional): an agent inside the vault

For tool calls, sandboxing and approval prompts, DSH Agent can be enabled separately:

```text
InterestSeed UI
    → dsh --profile acp
    → ACP v1
    → DSH models, tools, sandbox and permissions
```

Streaming messages, reasoning, tool cards, permission cards, stop, new session and a vault working directory are supported. DSH is entirely optional; Qwen chat, graph and exploration remain usable without it, and DSH owns its own models and keys.

### 3.6 Local-first privacy

- AI is off by default;
- Explicit consent is required before enabling it;
- Explore AI receives only anonymized theme/project aliases, aggregate counts and activity data;
- Note bodies, paths, summaries and the full vault are not sent;
- Local rule-based insight always works;
- The audit layer accepts only a minimal projection, never note bodies;
- Discovery and graph writes pass through queues, backups, recovery and consistency checks;
- High-risk paths fail visibly, not silently.

---

## 4. Product Moats

### Moat 1: A domain model, not a set of screens

The core asset is the data contract and state machine:

- Discovery identity / dedupe / suppression keys;
- Five feedback semantics;
- Application state machine;
- Edge origin / status / confidence / evidence;
- Migration and backward compatibility;
- Failure recovery and consistency checks.

Copying a card style does not reproduce any of this.

### Moat 2: A human-in-the-loop safety loop

Most AI graph products treat generation as the finish line. InterestSeed treats confirmation as the starting line:

```text
Suggestion → Evidence → Human confirmation → Application → Undo → Recovery
```

That loop requires:

- Feedback memory;
- Soft undo;
- Idempotent writes;
- Rollback on application failure;
- Stale-discovery handling;
- Relation conflict handling;
- Queue failure handling;
- Migration compatibility.

### Moat 3: Graph interaction is a product, not a library call

InterestSeed owns its Canvas interaction layer:

- Drag, pan, zoom, hover highlight, neighbor highlight;
- Solid / dashed / dotted edges encode relation state;
- Viewport persistence;
- Large-graph performance and selection state;
- Narrow sidebar and mobile layouts;
- Keyboard and accessibility support.

These details cannot be “configured” from a generic graph library.

### Moat 4: ACP Agent engineering

The Agent workspace is not terminal output pasted into a sidebar:

- ACP lifecycle;
- NDJSON streaming;
- Tool status;
- Permission requests;
- Session cancellation;
- Child-process exit;
- Model selection;
- Vault working directory;
- Desktop/mobile loading boundaries.

### Moat 5: Privacy and audit are constraints from day one

Not “collect first, add a policy later”:

- No note bodies sent;
- No model keys stored;
- No automatic graph mutation;
- No silent retries;
- No failure disguised as success.

### Moat 6: Test and deployment gates

Current baseline:

```text
46 test files / 437 passing cases
typecheck / lint / build pass
deploy aborts when verify fails
```

Coverage spans graph, persistence, migration, discovery, feedback, audit, application, undo, performance, AI presentation and Claudian adaptation.

---

## 5. Architecture

```text
src/
├── core/              GraphStore / GraphSession / UndoManager / InsightEngine
├── discovery/         discovery, feedback, themes, aggregation, overview, exploration
├── plugin/            GraphController / PersistenceService / commands
├── services/          ModelProvider / ClaudianProvider / AI presentation
├── storage/           GraphRepository / MigrationManager / PluginDataStorage
├── ui/                Canvas / DetailPanel / FilterBar / Explore Studio / Agent
├── agent/             DSH ACP client
└── types/             graph and settings types
```

Core flow:

```text
Vault → GraphBuilder → GraphStore
                         ├─ GraphSession → Canvas
                         ├─ PersistenceService → storage
                         └─ DiscoveryEngine → DiscoveryRepository
                                                   ├─ feedback
                                                   ├─ application
                                                   └─ Explore Studio
```

---

## 6. Install

### Manual install

1. Download `release/interestseed-0.1.3.zip`;
2. Extract into:

```text
<Vault>/.obsidian/plugins/interestseed/
```

3. Confirm the directory contains:

```text
main.js
manifest.json
styles.css
```

4. Open Obsidian → Settings → Community plugins → enable `InterestSeed`;
5. Open the `Interest Graph` view.

### Build from source

```bash
npm install
npm run verify
npm run deploy
```

`npm run deploy` runs the full quality gate, then copies the build into the isolated vault and rebuilds the release zip. Set `INTERESTSEED_VAULT` to the isolated vault path; no local path is committed.

---

## 7. Quick Start

1. Choose included/excluded folders in settings;
2. Click `Scan`;
3. Click a node on the canvas;
4. Confirm or reject suggestions in the detail panel;
5. Open `Discoveries` to process feedback;
6. Open `Explore` for the theme × project matrix;
7. Open `Agent` when you want DSH to read the vault and take the next step.

The home surface exposes four visual entry points:

```text
Agent        Explore        Discoveries        Overview
```

---

## 8. Commands

| Entry | Action |
| --- | --- |
| `Open interest graph` | Open the main view |
| `Open InterestSeed Agent (DSH)` | Open the Agent workspace |
| `Scan` / `Rebuild` | Rebuild the graph |
| `New node` | Create a node from the active file or manually |
| `Suggestion inbox` | Review all pending relations |
| `Discoveries` | Open discovery suggestions |
| `Overview` | Open the read-only aggregate overview |
| `Explore` | Open Explore Studio |
| `Export` | Export the current graph as JSON |
| `Undo` / `Redo` | Revert / restore graph operations |

---

## 9. Settings

### AI (experimental, off by default)

- Qwen DashScope (default): `qwen-turbo`; reads the key from `DASHSCOPE_API_KEY` / `QWEN_API_KEY`;
- Local OpenAI-compatible provider;
- Optional Claudian plugin API;
- Sends anonymized theme/project aliases, aggregate counts and activity data only;
- No automatic retries or model switching on failure;
- Local rule-based discovery remains available.

Set it in **Platform API Key** in InterestSeed settings, or use a Windows environment variable (never commit it):

```powershell
[Environment]::SetEnvironmentVariable("DASHSCOPE_API_KEY", "<your-key>", "User")
```

Fully quit and restart Obsidian so the desktop process inherits the new environment variable.

### DSH Agent (optional, desktop)\n\nThe Agent header exposes **Qwen / DSH** modes: Qwen for direct Q&A, DSH for your own agent, tools and task execution. Switching modes only resets the current session, never the graph.

```text
Enable DSH Agent
DSH command: dsh or an absolute local path
DSH profile: acp by default
DSH model: provider/model; prefers `wodebody/cn:deepseek-v4.1-flash` (the local workbuddy2pi route)
```

DSH owns models and credentials. InterestSeed does not store keys.

### Obsidian CLI

Settings include an official Obsidian CLI setup entry for the `obsidian-cli` skill and automated acceptance.

---

## 10. Security and Privacy

- No full-vault upload;
- No note bodies sent to Explore AI;
- No automatic discovery or graph mutation;
- No AI suggestion treated as fact;
- No hidden failures;
- No overwriting existing relations without confirmation;
- Export is explicit;
- All writes use application paths and recovery mechanisms.

See [SECURITY.md](SECURITY.md).

---

## 11. License, Attribution and Brand Protection

The code, interface copy, interaction design, discovery model, test fixtures and documentation are original work.

- Code license: [GNU AGPL-3.0](LICENSE);
- Attribution and redistribution: [NOTICE](NOTICE);
- Name, icon and brand boundaries: [TRADEMARKS.md](TRADEMARKS.md);
- Citation: [CITATION.cff](CITATION.cff).

AGPL-3.0 permits study, modification and redistribution under the same license. It does not permit turning this project into a closed-source network service without publishing modifications. The `InterestSeed` name and icon are not licensed with the code; forks must use a different name and icon and preserve original attribution.

Commercial closed-source use requires separate written permission.

---

## 12. Contributing

Issues, reproductions, tests and security reports are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting.

Do not submit:

- Real vault content;
- API keys, cookies or tokens;
- Personal paths;
- Unredacted discovery or graph data.

---

## 13. Status

```text
Version: 0.1.3
Tests:   46 files / 437 cases
License: AGPL-3.0
```

InterestSeed is evolving quickly. Current focus:

1. More stable cross-project discovery;
2. Stronger Explore Studio readability;
3. More complete DSH Agent permission experience;
4. Clearer migration and recovery paths.

---

**InterestSeed does not think for you. It makes your interests visible, verifiable and actionable.**
