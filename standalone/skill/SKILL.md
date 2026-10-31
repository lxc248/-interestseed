---
name: interestseed
description: Turn saved interests in a Markdown vault into one testable connection and a real 3-day experiment. Use when the user wants to validate an interest, connect a note to their graph, or run a local-AI-assisted review of an Obsidian vault without the Obsidian plugin.
---

# InterestSeed

InterestSeed is a local-first interest validator. It treats any Markdown folder as a vault. It does not need the Obsidian plugin runtime.

The core rule:

```text
one saved item → one testable connection → one 3-day experiment → evidence
```

## When to use

Use this skill when the user:

- has an Obsidian vault (or any Markdown folder) full of saved interests;
- wants to know what is worth actually trying;
- wants AI to suggest one connection, not a chat answer;
- wants a 3-day experiment with evidence;
- wants a local web view of the interest graph.

## Commands

Build once:

```bash
npm run build --prefix standalone
```

Initialize / scan:

```bash
node standalone/dist/cli.js init --vault "<vault-path>"
node standalone/dist/cli.js scan --vault "<vault-path>"
node standalone/dist/cli.js status --vault "<vault-path>"
```

Capture a saved item into the vault inbox:

```bash
node standalone/dist/cli.js capture --vault "<vault-path>" \
  --title "一条收藏" --url "https://example.com" --text "为什么我想保存它"
```

AI suggestion:

```bash
node standalone/dist/cli.js suggest --vault "<vault-path>" --node "<node-id>"
```

The output is JSON:

```json
{
  "suggestions": [
    {
      "source": "node_...",
      "target": "node_...",
      "relation": "共享方法",
      "reason": "两者都在讨论如何让人愿意开始。",
      "confidence": 0.82
    }
  ]
}
```

Present **exactly one** suggestion at a time. Do not dump the array as a checklist.

Connect only after confirmation:

```bash
node standalone/dist/cli.js connect --vault "<vault-path>" \
  --source "<id>" --target "<id>" --relation "共享方法" \
  --reason "两者都在讨论如何让人愿意开始。"
```

Experiment:

```bash
node standalone/dist/cli.js experiment start --vault "<vault-path>" \
  --title "AI 工具 × 习惯" --node "<id>" --days 3

node standalone/dist/cli.js experiment log --vault "<vault-path>" \
  --id "<experiment-id>" --interest 4 --energy 4 \
  --evidence "今天用 AI 整理了三篇旧笔记。"
```

Web panel:

```bash
node standalone/dist/cli.js serve --vault "<vault-path>" --port 4173
```

## Interaction contract

1. Scan the vault.
2. Pick a focus node: the user's selected note, or the node most related to their question.
3. Ask for one suggestion.
4. Show source → target, relation, reason.
5. Offer exactly three actions: connect / next / not now.
6. Write only after the user chooses connect.
7. Offer a 3-day experiment for the connected focus.
8. Record one real observation per day; never fake evidence.
9. Report the edge and offer undo if the web panel is running.

Never:

- edit the user's Markdown notes automatically;
- write an edge without confirmation;
- claim a suggestion is a fact;
- send note bodies, full paths, or vault contents to the model.

## Data boundary

Sent to the local model:

```text
node id
title
tags
existing edge pairs
```

Never sent:

```text
note body
source path
full observations
vault contents
```

## Configuration

`.interestseed/config.json`:

```json
{
  "model": "cn:deepseek-v4.1-flash",
  "baseUrl": "http://localhost:7863/v1",
  "keyEnv": "INTERESTSEED_AI_API_KEY",
  "includeFolders": [],
  "excludeFolders": [".obsidian", ".trash", ".interestseed", "node_modules"],
  "includeTags": []
}
```

The key comes from `INTERESTSEED_AI_API_KEY`, or `.interestseed/key` for local-only use.

## State

```text
.interestseed/config.json   configuration
.interestseed/state.json    graph state
.interestseed/key           optional local key, never commit
```

The state directory is append-only by convention: graph rewrites are explicit; experiment logs are append-only.
