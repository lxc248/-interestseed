# Version comparison — 3.5 → 3.6 → 3.7 → 4.0

This is a feature-level comparison across the recent releases. The goal of 4.0 was
to leave the Obsidian plugin runtime behind; the comparison is used to check that
nothing important was dropped in that move.

## What each version contributed

| Area | 3.5 / 3.6 | 3.7 | 4.0 standalone |
| --- | --- | --- | --- |
| AI suggestion flow | one suggestion at a time; connect / next / not now | kept | kept in web panel |
| Editable relation name | yes | yes | yes |
| Undo after connect | yes | yes | yes |
| Local model only | yes | yes | yes |
| Model ID config | settings panel | settings panel | settings modal |
| Endpoint config | fixed local endpoint | fixed local endpoint | editable in settings |
| API key storage | Obsidian SecretStorage | SecretStorage | `.interestseed/key` or env |
| Key clear UI | yes | yes | added in this pass |
| AI side panel | modal | Obsidian ItemView | web right panel |
| Current-note / command-palette entry | no | yes | n/a (no Obsidian runtime) |
| Graph view | canvas graph | canvas graph | SVG planet system |
| Capture saved item | spark modal | spark modal | capture modal + CLI |
| Share inbox | modal | modal | web inbox + CLI |
| Discovery | rules + UI | rules + UI | web panel + CLI |
| Experiment | 7 / 3 day | 7 / 3 day | 3-day strip + history |
| Evidence per day | yes | yes | yes |
| Next action | experiment metadata | experiment metadata | evidence and history only |
| MCP | read-only | read-only | read-only, standalone state |
| Agent skill | no | no | `standalone/skill/SKILL.md` |

## What was kept (no regression)

- One suggestion at a time, never a batch pending wall.
- No auto-write: connect is explicit, undo is available.
- Reason attached; confidence only when the model supplies it.
- Privacy boundary: only node id / title / tags / existing edge pairs go to the model.
- No Claudian dependency.
- Evidence must be real: experiment log requires a concrete observation.

## Gaps found and fixed in this pass

1. **AI config UI was missing in the standalone web.** The plugin had model ID,
   endpoint, key status, save, and clear. The standalone web had a badge but no
   way to edit. Added:
   - `/api/config` GET and PUT;
   - settings modal: model ID, endpoint, key, include/exclude folders, include tags;
   - save and clear-key actions;
   - the model badge in the header now opens settings.

2. **Tag filtering was not exposed in the web settings.** `includeTags` existed in
   the scanner config but had no UI. Added a textarea for include tags.

3. **Web undo used in-memory state.** `/api/undo` now calls `undoGraph` from
   `history.json`, the same path the CLI uses, so undo survives a server restart.

4. **No AI consent / enable switch.** Added `enableAI` and `aiConsentGranted` to
   standalone config, settings checkboxes, and pre-flight checks in
   `suggestRelations`.

5. **Experiments were 3-day only.** Added a start-experiment modal with 3-day and
   7-day options, and a next-step input on the daily log.

6. **No insights strip.** Added top nodes, themes, orphan counts, and a friendly
   advice line backed by `src/core/InsightEngine.ts` to `/api/state` and rendered
   them as chips below the stat cards.

7. **Discovery feedback was shallow.** Added feedback actions (accepted /
   needs-verification / low-value / corrected / rejected) with a health summary,
   and friendly Chinese labels: 留下 / 想再看看 / 先放着 / 改一下 / 先不看.

8. **No share-card image.** Added a share-card modal with a canvas render and
   PNG download for inbox items.

9. **No cold start.** Added a Seed Sprint modal (兴趣 / 为什么 / 第一步) when the
   vault has no nodes.

10. **MCP only exposed the graph.** Added `interestseed://experiments` and
    `interestseed://discoveries` resources backed by `.interestseed/*.json`.

11. **No persistent header status.** Added a header pill showing key state,
    discovery count, and pending inbox count.

12. **No stage filter.** Added graph filter chips: all / captured / connected /
    experimenting / reviewed.

13. **Experiments could not be extended.** Added extend-to-7-days from the strip.

14. **No discovery audit view.** Added a 体检 modal with per-feedback summaries.

## Remaining differences that are intentional

- Obsidian-only entry points (file menu, command palette, SecretStorage) do not
  apply to the standalone runtime. The plugin remains a compatibility shell.
- The standalone stores the key in `.interestseed/key` (gitignored) or an
  environment variable instead of Obsidian SecretStorage. The web hint states
  this explicitly.

## Verification

```text
74 test files / 530 tests passing
typecheck:standalone passing
lint passing
config GET/PUT verified against demo vault
settings modal opens and is populated
```
