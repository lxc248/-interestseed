# InterestSeed Architecture

## One screen, one decision

InterestSeed is a local-first Obsidian plugin. The graph is an evidence layer,
not the product. Every feature must preserve one property:

```text
The user can always see why a node, edge, or next action exists.
```

## Module map

```text
src/core          graph store, sessions, relations, insights, undo, observations
src/services      share analysis, model providers, route/canvas/share-card generation
src/storage       graph repository, migrations, plugin data storage
src/discovery     discovery engine, repository, audit, application, feedback
src/ui            Obsidian views, canvas renderers, modals, filters, detail panel
src/plugin        controller, persistence scheduler, commands, status wiring
src/adapters      Obsidian vault and audit adapters
src/utils         paths, validation, text/math helpers, IDs
mcp/              zero-dependency read-only MCP server
```

## Data flow

```text
Share text / note
  → ShareAnalysis (pure)
  → ShareInbox (pending decision)
  → user keep / pass
  → GraphStore (node + provenance)
  → GraphSession (undoable command)
  → PersistenceService (debounced, serialized save)
  → VaultGraphRepository (atomic write + backup)
```

Discovery flow:

```text
Graph snapshot
  → DiscoveryEngine (deterministic rules)
  → DiscoveryRepository (append-only feedback)
  → DiscoveryApplication (explicit user confirmation)
  → GraphStore edge
```

## AI boundary

```text
default: on
providers: local OpenAI-compatible service (localhost:7863)
model: default cn:deepseek-v4.1-flash; configurable in settings
setup: guided modal; key saved in Obsidian SecretStorage, env fallback
sent: node id, title, tags
never sent: note body, source paths, full observations, vault contents
output: candidate relations only; user confirmation writes them
failure: local rule discovery remains available
```

AI is a suggestion layer, not a writer. `enableAI` and `aiConsentGranted` are
both required; disabling either falls back to the disabled provider.

## Invariants

```text
1. No automatic graph writes from AI, discovery, or share analysis.
2. Every kept spark keeps source provenance.
3. Task state is derived, never guessed.
4. Observation evidence is append-only.
5. Rejected edges stay inspectable.
6. Persistence errors never roll back in-memory edits silently.
7. Corrupt data blocks writes and creates a backup before recovery.
8. MCP is read-only and never leaks absolute paths.
```

## Persistence

`PersistenceService` debounces saves and serializes them through a promise
queue. `VaultGraphRepository` writes a temporary file, validates the round trip,
and only then replaces the live file. Migration failures block writes and
preserve the original bytes.

## Canvas

Two renderers exist:

```text
GraphCanvas        force-directed, theme-variable colors
CosmicGraphCanvas  planets/orbits/nebulae, fixed palette
```

Pure model helpers live in `ui/cosmicGraphModel.ts`; shared text/math helpers
live in `utils/text.ts` and `utils/math.ts`. Rendering is local Canvas 2D with
no runtime graph library.

## UI boundaries

```text
InterestSeedView   composes graph, detail panel, filter bar, footer
DetailPanel        renders one selected node and its evidence
Modals             one decision per modal, no hidden batch operations
ShareCardRenderer  local Canvas composition, not a screenshot
```

## Testing strategy

```text
unit tests          pure domain and services
repository tests    corruption, migration, backup, concurrency
UI tests            jsdom component behavior
simulation tests    discovery quality and adversarial inputs
MCP smoke           protocol, tool errors, BOM, malformed JSON
persona scripts     real Obsidian end-to-end paths
```

Run everything with:

```bash
npm run verify
npm run coverage
node --test mcp/smoke.test.mjs
```

## Extension points

- Add a new discovery rule in `src/discovery/DiscoveryEngine.ts` and prove it
  with a deterministic fixture.
- Add a new share preset in `src/ui/ShareCardRenderer.ts`; keep it local Canvas.
- Add a new MCP tool in `mcp/server.mjs`; keep it read-only and path-safe.
- Add a new view mode only if it preserves the one-decision invariant.
