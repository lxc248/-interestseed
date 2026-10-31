# InterestSeed Standalone 4.0.0

This zip is self-contained. It does not need the Obsidian plugin runtime.

```bash
node cli.js init --vault "<vault>"
node cli.js scan --vault "<vault>"
node cli.js serve --vault "<vault>" --port 4173
```

Open `http://127.0.0.1:4173`.

## CLI

```bash
node cli.js capture --vault "<vault>" --title "Saved item" --text "Why I saved it"
node cli.js inbox add --vault "<vault>" --text "A saved item"
node cli.js inbox keep --vault "<vault>" --id "<inbox-id>"
node cli.js discoveries refresh --vault "<vault>"
node cli.js discoveries apply --vault "<vault>" --id "<discovery-id>"
node cli.js suggest --vault "<vault>" --node "<node-id>"
node cli.js connect --vault "<vault>" --source "<id>" --target "<id>" --relation "shared method"
node cli.js experiment start --vault "<vault>" --title "AI tools × habits"
node cli.js experiment log --vault "<vault>" --id "<id>" --evidence "What I actually did"
```

## Skill

`skill/SKILL.md` is the agent-facing contract: one suggestion at a time,
wait for connect / next / not now, write only after confirmation.

## MCP

```bash
node mcp/server.mjs --graph "<vault>/.interestseed/state.json"
```

## Data

```text
<vault>/.interestseed/config.json
<vault>/.interestseed/state.json
<vault>/.interestseed/experiments.json
<vault>/.interestseed/key
```

The key can also come from `INTERESTSEED_AI_API_KEY`.

AGPL-3.0-only. Author: aicoder.
