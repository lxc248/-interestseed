# Changelog

## 3.0.2 — Canvas keyboard navigation

- Added arrow-key node cycling and Enter/Space selection.
- Added aria-keyshortcuts to the graph canvas.

## 3.0.1 — Quality and CI

- Added CI workflow on push/PR.
- Added MCP smoke tests.
- Fixed MCP stdin trailing-line processing.
- Strict scorecard: 78 → 86.

## 3.0.0 — Complete

- Final complete release with new vertical promo video (no beat-flash).
- Fixed deploy.ps1 UTF-8 manifest parsing for packaging.
- Audited GitHub upload/release pipeline end to end.

## 2.7.16 — Author attribution

- Set project author to aicoder across manifest, package, NOTICE, banner, and README.

## 2.7.15 — Smooth frontend onboarding

- Added first-open loading overlay.
- Added first-render entrance animations with reduced-motion support.

## 2.7.14 — Project traits and learning map

- Added docs/project-characteristics.md mapping project traits to learned practices.
- Centralized MCP tool error handling in toolFail.

## 2.7.13 — Node engineering hardening

- Centralized MCP error handling with stderr-only detail.
- Added graceful shutdown and process-level error guards.

## 2.7.12 — Accessibility pass

- Added visible keyboard focus styles.
- Added polite live regions for filter summary and next-step copy.
- Audited with axe-core WCAG A/AA (0 violations).

## 2.7.11 — Button contrast fix

- Fixed Agent and next-step buttons turning white-on-white in light theme.

## 2.7.10 — Learn performance from Solid/Fastify

- Cached GraphStore.stats by graph revision (Solid derived-state principle).
- Kept MCP graph reads cached by mtime (Fastify low-overhead principle).
- Documented the study in review/2.7.10-solid-fastify-study.md.

## 2.7.9 — Performance canvas budget

- Reduced canvas redraws to every other animation frame.
- Reused the graph snapshot inside refresh instead of cloning it twice.

## 2.7.8 — Visualization focus emphasis

- Added node/edge/label dimming when a node is selected or hovered.
- Kept the focus node and its direct neighbors highlighted.
- Documented the visualization practice in review/2.7.8-visualization.md.

## 2.7.7 — JSON Canvas export

- Added an explicit JSON Canvas export command.
- Added deterministic canvas node/edge generation with validation tests.

## 2.7.6 — Performance practice

- Added a cached search index for graph filtering.
- Cached MCP graph reads by file mtime.
- Documented the performance practice in review/2.7.6-performance.md.

## 2.7.5 — Security hardening (full batch)

- Hardened Share Inbox external links and MCP prompt/output boundaries.
- Added MCP stdin line cap and generic error messages.
- Allowlisted the DSH agent child environment.
- Removed cloud API key fallback for the local AI service.
- Sanitized Claudian exploration requests.
- Pinned GitHub Actions to immutable SHAs, added SHA256SUMS, removed `--clobber`.
- Fixed deploy script and Vite banner version sources.

## 2.7.4 — Security hardening

- Opened external Share Inbox sources with `window.open(noopener,noreferrer)`.
- Added a prompt-injection data boundary to MCP prompts.
- Added the scoped security audit report.

## 2.7.3 — Dense graph readability

- Ranked labels by degree and kept selected/hovered labels always visible.
- Limited dense graphs to at most 12 node labels.
- Increased dense label size slightly for readability.
- Hid generic orbit labels in dense graphs to avoid competing with node titles.

## 2.7.2 — Sparse graph readability

- Enlarged nodes dynamically for graphs with 10 or fewer nodes.
- Increased sparse-graph label size and maximum width.
- Kept all labels visible in sparse graphs instead of hiding them by collision.

## 2.7.1 — Share card polish

- Added a real “最近在关注” topic line to portrait and landscape cards.
- Improved label placement with node/label collision avoidance.
- Enlarged the share preview and documented the new cover hierarchy.

## 2.7.0 — Share card redesign

- Rebuilt social cards around a mobile-first hook, three proof stats, the graph, and a three-step close.
- Added dedicated portrait and landscape layouts for all five platform presets.
- Added label collision avoidance so labels never cover nodes.
- Widened the share modal and improved preview size.
- Added `assets/share-card-xiaohongshu.png` and refreshed `assets/social-card.png`.

## 2.6.2 — Global bug fixes

- Restored the desktop filter/search entry point.
- Fixed light-host contrast inside the experiment modal.
- Fixed light-theme filter inputs on the dark filter surface.
- Added the full bug-audit report and screenshots.

## 2.6.1 — Adaptive narrow layout

- Added icon-first layout for panes below 360px.
- Added a structural fallback below 300px instead of compressing the desktop layout.
- Kept the graph, quick actions and a width hint usable in narrow panes.
- Verified Share Inbox at 480px wide.
- Documented the adaptive audit.

## 2.6.0 — Interest validator positioning

- Reframed the product from “interest graph” to “interest validator”.
- Added “别收藏更多，验证一个。” to README and manifest.
- Updated the main view subtitle to “一次只验证一个兴趣：收藏 → 行动 → 证据”.
- Added docs/positioning.md with audience, moat and competition-stage strategy.

## 2.5.0 — View state convergence

- Replaced competing inbox/discovery booleans with one graph / inbox / discoveries mode.
- Fixed discovery theme filter being reset when opening.
- Selecting a node now exits discovery mode and restores its detail.
- Closed the “更多” menu after running an action.
- Styled the discovery panel for the dark graph surface.
- Documented the view-mode invariants.

## 2.4.0 — Context search

- Extended graph search to source refs, reasons, raw captures and observation evidence.
- Added multi-word AND matching.
- Kept search deterministic, local and dependency-free.
- Documented the GitHub high-star gap scan.

## 2.3.1 — External source URI fix

- Preserved `https://` and `http://` in `sourceUri`.
- Repaired previously collapsed `https:/` values on graph load.
- Fixed interest-route links for external sources.
- Added path normalization tests.

## 2.3.0 — Timeline, route and agent context

- Added append-only observation timelines to graph nodes.
- Added “生成兴趣路线笔记（Markdown MOC）” with explicit user action.
- Upgraded the local MCP server to 2026-07-28 resources, prompts and context.
- Added the Agent Context packet as an MCP tool and resource.
- Kept all writes explicit, local and reversible.

## 2.2.0 — Task state and cross-surface context

- Added clickable source labels that open the original note.
- Added Interest Task State: captured / judged / connected / experimenting / reviewed.
- Displayed task state in the node detail panel.
- Wrote task state and source provenance into new spark nodes.
- Exposed task state and source fields through the read-only MCP graph tool.
- Kept old graphs compatible through inferred states.

## 2.1.1 — Source provenance and readable menus

- Added `sourceRef` to context packets so note imports retain their path.
- Stripped frontmatter and heading markers from note imports.
- Grouped the “更多” menu into 图谱 / 关系 / 发现 / 导出.
- Fixed the menu being clipped by the horizontal quickbar.
- Hardened release uploads with `gh release upload --clobber`.

## 2.1.0 — Source-aware Context Inbox

- Added source metadata to Share Inbox items: share, clipboard, note.
- Added “把当前笔记加入分享收件箱”.
- Displayed source labels in list and focus cards.
- Kept local-first behavior: no account, no credits, no platform scraping.
- Preserved backward compatibility with existing inbox data.

## 2.0.0 — Full acceptance release

- Completed a full build, typecheck, lint and test pass.
- Default Share Inbox is a conventional list; Focus Deck is optional.
- Onboarding skip now opens a real spark capture.
- Kept the 3-day trial and one-tap daily check-in.
- Unified overview, explorer and modal surfaces in the dark theme.
- Added command-palette actions for experiment check-ins.
- Renamed the suggestion inbox to “关系建议”.
- Synced plugin, MCP, docs and release metadata to 2.0.0.

## 1.8.0 — Familiar-first UX, validated by two personas

- Made the conventional Share Inbox list the default.
- Made Focus Deck opt-in and reversible.
- Changed onboarding skip to open a real spark capture instead of an empty graph.
- Fixed secondary-button contrast in the onboarding dialog.
- Ran and documented two real-UI persona tasks: design student and office worker.
- Kept all test state clean and reversible.

## 1.7.2 — Conventional inbox by default

- Restored a standard list as the default Share Inbox.
- Moved Focus Deck behind an explicit “专注一条” action.
- Kept all pending items visible in list mode.
- Simplified the header language to Chinese.
- Updated the inbox guide to explain list-first behavior.

## 1.7.1 — GitHub-grade command access

- Added command-palette actions for opening the experiment and recording “做了 / 只想过 / 没做”.
- Added a command reference with recommended user-assigned hotkeys.
- Kept all default hotkeys unbound to avoid conflicts.
- Fixed stale test count in the README.
- Added more bottom breathing room to the Focus Deck.

## 1.7.0 — Focus Deck

- Rebuilt Share Inbox as a one-card Focus Deck.
- Added swipe left/right and ArrowLeft/ArrowRight decisions.
- Renamed the primary decision to “留下并连接”.
- Moved adding another share below the current card.
- Kept one-at-a-time queue, URL dedupe and no auto-scraping.

## 1.6.0 — Lower-friction experiments

- New cold-start questionnaires create a 3-day trial by default.
- Added one-tap “做了 / 只想过 / 没做” experiment check-ins.
- Moved scales, evidence and next-step fields into optional details.
- Added a compact, scroll-safe experiment modal.
- Kept the strict one-record-per-day and no-fake-progress model.
- Unified overview and explorer modals with the dark graph surface.
- Added a visible active state to explorer tabs.

## 1.5.3 — Cold-start questionnaire and validation track

- Renamed “兴趣起跑” to “冷启动问卷”.
- Renamed “实验轨道” to “3/7 天验证行动”.
- Kept internal tags and existing graph data compatible.
- Updated commands, onboarding copy, docs and screenshots.

## 1.5.2 — Clearer onboarding and experiment labels

- Renamed “兴趣起跑” to “开始建图”.
- Renamed “实验轨道” to “我的实验”.
- Kept internal tags and existing graph data compatible.
- Updated commands, onboarding copy, docs and screenshots.

## 1.5.1 — Visual hierarchy and one primary action

- Reduced the visible toolbar to Record / Inbox / More.
- Added progressive disclosure for advanced graph actions.
- Simplified spark intake with optional details and Cmd/Ctrl+Enter.
- Made Share Inbox one-candidate-at-a-time.
- Increased minimum type sizes and secondary contrast.
- Restyled detail-panel actions for dark surfaces.

## 1.5.0 — Inbox, themes, share studio and read-only MCP

- Added a persistent Share Inbox with URL dedupe, one-at-a-time processing and NEXT integration.
- Added theme-first focus with visible theme counts.
- Added share-card node hiding, caption copying and small-screen layout.
- Added a local read-only MCP server with graph, next-step, search and experiment tools.
- Added inbox persistence and queue size limits.
- Added inbox and MCP documentation.

## 1.4.0 — Lighter passing, lighter sharing

- Added “just passing” to the spark intake; it closes without writing a node.
- Added suggested share caption copying with real graph topics.
- Improved download compatibility and small-screen share modal layout.
- Paused cosmic canvas drawing while Obsidian is hidden.
- Improved share-card label collision avoidance.
- Added caption and preset tests.

## 1.3.0 — Share a constellation

- Added platform-sized PNG share cards for Xiaohongshu, Instagram, X, WeChat and Stories.
- Share cards are re-rendered from graph data, never UI screenshots.
- Added label collision avoidance for dense graphs.
- Added download, copy-image and system-share paths with environment fallbacks.
- Added a dark, platform-aware share modal.
- Added presets and filename tests.

## 1.2.0 — Three-day starter and theme-first map

- Added a 3-day starter experiment that can be extended to 7 days after review.
- Added a theme rail with cluster focus; long graphs open on one theme instead of every planet.
- Added mobile share entry through `obsidian://interestseed-share` and clipboard intake.
- Added real-life interest choices: beauty/style and games/virtual worlds.
- Added life-topic inference for makeup, sport, games and open-world content.
- Fixed initial-text spark cards not enabling their primary action.
- Added a complete real-life 7-day report with screenshot index.

## 1.1.0 — Clear next action

- Global audit of the student and office-worker journeys.
- Share analysis: platform, short title, inferred topics, `why saved` note and one explicit spark decision.
- NEXT bar: one primary action at a time; duplicate experiment CTAs removed.
- Experimental nodes are no longer counted as orphan nodes.
- Compact graph labels keep the map readable; full titles remain in the detail panel.
- Unified dark cosmic surfaces for onboarding, spark, experiment and toolbar.
- Added share-analysis tests and a 1.1.0 release workflow.

## 1.0.0 — The first living constellation

- Seed Sprint: four choices → a first confirmable interest constellation.
- Interest Spark: capture a short-video link or a sentence as a graph seed.
- Gap Coach: turn bridge/orphan insights into one concrete observation.
- Strict 7-day interest experiment: daily evidence, 1–5 interest/energy scores, one check-in per calendar day, and a completion review.
- One Agent entry for connecting your own DSH-compatible agent via ACP.
- Evidence-backed draft graph; no silent writeback; undoable application.
- Obsidian main view now uses the cosmic canvas by default: central star core, planetary systems, gold constellation threads, nebulae and travelling light.
- Share intake now exposes platform, short title, inferred topics, a `why saved` note, and one explicit spark decision.
- Standalone cosmic viewer: planets, orbits, nebulae, particle trails and glass HUD.
- Portable Agent Skill package with a single-file `star-map.html` renderer.
- 40-second programmatic launch film and launch documentation.

## 0.2.0

- Simplified AI to one own-Agent connection.
- Removed Qwen/free-model settings from the user interface.
- Single-agent onboarding and visual polish.

## 0.1.2

- Global visual system, graph label collision handling, detail panel fixes and responsive launch cards.