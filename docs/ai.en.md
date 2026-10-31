# AI suggestions

AI is not an add-on in InterestSeed. It is the step that turns a pile of saved items into one testable next move.

```text
Too many saves
→ your local AI picks one connection worth testing
→ you decide: connect / next / not now
→ the connected interest enters a 3-day test
```

It does not save for you. It does not decide for you. It puts one candidate in front of you.

## Why not a chat box

A chat box gives you many answers. It does not help you decide.

InterestSeed's AI does one thing:

```text
one suggestion at a time
with one reason
editable relation name
written only after you connect
undoable after writing
```

## How it chooses

```text
focus node → focus first, then shared tags
no focus → orphan / low-degree nodes first
at most 32 nodes
at most 5 suggestions
existing edge pairs included to avoid duplicates
```

## Where the model runs

```text
local OpenAI-compatible service
http://localhost:7863/v1
model ID configurable, default cn:deepseek-v4.1-flash
API key in Obsidian SecretStorage
```

No Claudian, no third-party agent plugin.

## Data boundary

Sent:

```text
node id
title
tags
```

Not sent:

```text
note body
source path
full observations
vault contents
```

## Failure behavior

```text
model unavailable → local rule discovery stays
401/403 → setup window opens
one malformed item → skipped, batch survives
no confidence → no fake score
```

## Live run

```text
model: cn:deepseek-v4.1-flash
result: 5 focused candidates
connect: 32 → 33 edges
undo: 33 → 32 edges
```

## Screenshots

```text
assets/ai-suggestions-live.png
assets/ai-model-panel.png
assets/ai-setup.png
```
