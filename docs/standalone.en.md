# Standalone

InterestSeed runs without the Obsidian plugin runtime.  
An Obsidian vault is just a Markdown folder: `.md`, frontmatter, tags, links.

## Shape

```text
CLI         interestseed scan / suggest / connect / serve
Local Web   http://127.0.0.1:4173
Agent Skill standalone/skill/SKILL.md
Storage     <vault>/.interestseed/
```

## Quick start

```bash
npm run build:standalone
node standalone/dist/cli.js init --vault "<vault>"
node standalone/dist/cli.js scan --vault "<vault>"
node standalone/dist/cli.js serve --vault "<vault>" --port 4173
```

## Commands

```bash
node standalone/dist/cli.js status --vault "<vault>"
node standalone/dist/cli.js capture --vault "<vault>" \
  --title "Saved item" --url "https://example.com" --text "Why I saved it"
node standalone/dist/cli.js inbox add --vault "<vault>" --text "A saved item"
node standalone/dist/cli.js inbox keep --vault "<vault>" --id "<inbox-id>"
node standalone/dist/cli.js discoveries refresh --vault "<vault>"
node standalone/dist/cli.js discoveries apply --vault "<vault>" --id "<discovery-id>"
node standalone/dist/cli.js suggest --vault "<vault>" --node "<node-id>"
node standalone/dist/cli.js connect --vault "<vault>" \
  --source "<id>" --target "<id>" --relation "shared method" \
  --reason "Both discuss how to make people willing to start."
node standalone/dist/cli.js experiment start --vault "<vault>" \
  --title "AI tools × habits" --node "<id>" --days 3
node standalone/dist/cli.js experiment log --vault "<vault>" \
  --id "<experiment-id>" --interest 4 --energy 4 \
  --evidence "Used AI to organize three old notes today."
```

## AI

```text
.interestseed/config.json
  model      default cn:deepseek-v4.1-flash
  baseUrl    default http://localhost:7863/v1
  keyEnv     INTERESTSEED_AI_API_KEY
```

Key sources:

```text
1. INTERESTSEED_AI_API_KEY
2. .interestseed/key (local convenience, do not commit)
```

Sent:

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

## Skill

The agent-facing contract is `standalone/skill/SKILL.md`:

```text
one suggestion at a time
wait for connect / next / not now
write only after confirmation
never edit notes automatically
```

## Relationship to the plugin

The plugin remains an Obsidian-native compatibility shell:

```text
sidebar
command palette
file context menu
Obsidian SecretStorage
```

The standalone core is the product: CLI + Web + Skill.
