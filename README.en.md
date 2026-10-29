# InterestSeed

**Stop collecting. Start proving.**

**InterestSeed is an interest validator: turn one saved post into a real 3-day action, then let evidence decide whether to keep it.**

[English](README.en.md) · [简体中文](README.md) · [Watch the 40s film](assets/interestseed-launch.mp4) · [Product design](docs/seed-sprint.md)

[![InterestSeed demo cover](assets/interestseed-launch-cover.png)](assets/interestseed-launch.mp4)

<p>
  <img alt="Obsidian" src="https://img.shields.io/badge/Obsidian-1.5%2B-7c3aed" />
  <img alt="Version" src="https://img.shields.io/badge/version-2.7.0-0ea5e9" />
  <img alt="Tests" src="https://img.shields.io/badge/tests-471%20passing-22c55e" />
  <img alt="License" src="https://img.shields.io/badge/license-AGPL--3.0-f59e0b" />
  <img alt="Local first" src="https://img.shields.io/badge/local--first-yes-14b8a6" />
</p>

---

## Not another collection app

Most interest tools open with a blank input and ask you to describe yourself. InterestSeed starts with four concrete choices, then turns them into a **draft constellation** you can confirm, edit, and grow.

```text
4 choices
→ 5 seeds + 4–6 evidence-backed candidate edges
→ 1 surprise connection
→ 1 seven-day interest experiment
→ a graph that keeps growing through real action
```

The core rule:

> **AI proposes. You confirm. Feedback makes the next round smarter.**

---

## The 0 → 1 flow

1. **Choose** — four scene-based questions, no long writing.
2. **See** — an animated first constellation appears.
3. **Confirm** — accept, skip, or edit every seed and edge.
4. **Act** — start a seven-day experiment.
5. **Return** — capture sparks, fill graph gaps, and watch the map evolve.

| Entry | What it does |
| --- | --- |
| **Cold-start questionnaire** | Four choices → first confirmable graph |
| **Interest Spark** | Paste a short-video link or a sentence → one seed |
| **Gap Coach** | Turn an orphan/bridge insight into one concrete observation |
| **3-Day Trial** | One-tap check-in; turn action into feedback |

---

## Why it is different

| Common AI graph tools | InterestSeed |
| --- | --- |
| Auto-generate and auto-write | **Proposal first, human confirmation, no silent writeback** |
| “Related” with no provenance | `origin`, `status`, `confidence`, `evidence` on every edge |
| Repeatedly recommend rejected ideas | Feedback memory + suppression keys |
| Require an existing vault | Cold start from zero with choice cards |
| Another chat sidebar | Graph is the workspace; Agent is the execution layer |
| Consumption stays in a saved-items pile | Sparks turn short-video curiosity into graph structure |

---

## Screenshots

### Workspace

![Workspace](assets/screenshot-1.png)

### Cold-start questionnaire

![Cold-start questionnaire](assets/onboarding.png)

### Explore Studio

![Explore Studio](assets/screenshot-2.png)

### Your own Agent

![Agent](assets/screenshot-3.png)

---

## Install

1. Download `interestseed-v2.7.0.zip` from Releases.
2. Extract into:

```text
<your-vault>/.obsidian/plugins/interestseed/
```

3. Ensure `main.js`, `manifest.json`, and `styles.css` are present.
4. Enable InterestSeed in Obsidian → Community plugins.

From source:

```bash
npm install
npm run build
npm run deploy
npm run verify
```

Requires Node.js 20+.

---

## Connect your own Agent

InterestSeed does not host your model credentials and does not choose a model platform.

```text
InterestSeed UI
    → DSH ACP / your agent command
    → ACP v1
    → your models, tools, sandbox and permissions
```

Configure the command, profile and model in Settings. The vault is the working directory. DSH owns models and keys; InterestSeed owns the conversation UI and graph visualization.

---

## Local-first privacy

- AI is off by default;
- Explicit consent before any AI data is sent;
- Sparks only store text/links you explicitly paste;
- Graph, feedback and experiment progress live in your vault;
- Writes go through an undoable graph session;
- Graph, discovery and exploration work without an Agent.

---

## License

AGPL-3.0-only. See [LICENSE](LICENSE).
