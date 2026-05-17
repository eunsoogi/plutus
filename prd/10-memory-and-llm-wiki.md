# Plutus PRD: Memory And LLM Wiki

## 1. Objective

Introduce a durable memory system and an LLM Wiki Curator agent so Plutus can preserve user preferences, research decisions, strategy lessons, and reusable investment knowledge across sessions.

The memory layer must use the most popular open-source agent memory project as the implementation baseline, while keeping all private portfolio and research data under the macOS host's local-first control.

## 2. Product Decision

Plutus should use both Mem0 and an LLM-maintained wiki, but they must solve different jobs.

Mem0 is the runtime memory layer. It stores automatically captured atomic memories that agents can retrieve during a research run: preferences, prior conclusions, strategy lessons, risk sensitivities, and short summaries of relevant past decisions.

The LLM wiki is the agent-maintained knowledge layer. It stores Markdown pages for theses, strategy notes, risk lessons, instrument notes, glossary entries, and reusable workflows, and the LLM Wiki Curator keeps those pages current from completed runs and source artifacts.

MVP priority:

1. Implement automatic Mem0 capture and recall first behind `plutus_memory`.
2. Add the LLM Wiki Curator as an autonomous wiki maintenance agent.
3. Let the curator create, update, merge, archive, and cross-link wiki pages from completed run cards, artifacts, source summaries, and durable memories.
4. Give users visibility, diff history, and revert controls instead of requiring pre-approval for wiki changes.

The two systems must not duplicate each other. Mem0 should not store full wiki pages, and the wiki should not become the primary vector-memory store. Mem0 may store wiki page IDs, summaries, tags, and source links so agents can recall that a maintained page exists.

## 3. Open-Source Memory Baseline

Use Mem0 as the default memory-system baseline for Plutus.

Rationale:

- `mem0ai/mem0` is an Apache-2.0 open-source universal memory layer for AI agents.
- As of 2026-05-17, the GitHub repository showed about 55.9k stars, which is higher than comparable open-source agent memory projects checked for this PRD update.
- It provides Python and TypeScript-facing integration paths, a self-hosted server option, CLI flows, semantic search, memory add/search/delete primitives, and agent-focused usage patterns.
- Its product shape maps cleanly to Plutus requirements: user preferences, prior research recall, strategy lessons, saved theses, and long-term agent personalization.

Plutus must treat Mem0 as an implementation dependency behind a product-owned memory adapter, not as the direct product domain model.

## 4. Architecture

MVP memory architecture:

1. `packages/memory` owns the Plutus memory adapter, schemas, capture rules, retention policies, and Mem0 integration.
2. `packages/local-tools` exposes memory operations through the first-party `plutus_memory` namespace.
3. `packages/local-mcp-adapter` exposes only role-allowed `plutus_memory` tools to Codex agents.
4. SQLite stores Plutus-owned memory metadata, capture policy, audit links, source run IDs, retention state, and references to Mem0 memory IDs.
5. Mem0 stores and searches the semantic memory records through a local or self-hosted runtime selected by the Mac host configuration.

No finance agent should call Mem0 directly. All agent access must go through `plutus_memory` so Plutus can enforce scope, audit, retention, and deletion semantics.

## 5. Memory Types

MVP must support these memory categories:

- User preference memory: risk tolerance, default benchmark, preferred asset classes, excluded assets, reporting style, tax/account caveats supplied by the user.
- Research memory: saved theses, accepted caveats, prior run conclusions, watchlist rationale, rejected ideas, and follow-up questions.
- Strategy memory: strategy specs, backtest lessons, invalidated assumptions, overfitting warnings, and reusable parameter ranges.
- Workflow memory: recurring run templates, preferred preset teams, report sections, and notification preferences.
- Wiki source memory: distilled facts or lessons promoted into wiki pages by the LLM Wiki Curator.
- Wiki pointer memory: page IDs, summaries, tags, and source links for maintained wiki pages; full wiki page bodies must remain in wiki storage.

Memory records must carry:

- Source run ID or source artifact ID.
- Capture policy and sensitivity class.
- Visibility scope.
- Retention class.
- Last used timestamp.
- Deletion eligibility.
- Audit trail reference.

## 6. Capture And Controls

Plutus should automatically create durable investment memory when a completed run, user preference, research conclusion, or strategy lesson is useful for future runs.

Required controls:

- Auto-saved ephemeral run context allowed only inside the current research run.
- Automatic durable memory capture from completed runs and user interactions.
- User-visible memory activity feed.
- Edit, pin, archive, and delete controls.
- "Forget this" action that removes the Plutus metadata row and calls the backing memory deletion path.
- Per-category enable/disable toggles.
- Sensitive-data filters so raw credentials, private keys, and unrestricted account history are not stored as memory.
- Memory citation in final reports when recalled memory materially affected a recommendation.

## 7. LLM Wiki Curator Agent

Add a project-scoped custom agent:

- `.codex/agents/llm-wiki-curator.toml`

The LLM Wiki Curator converts completed research runs, durable memories, report artifacts, and source summaries into structured local wiki pages.

Responsibilities:

- Maintain an investment knowledge base for lessons, theses, definitions, strategy notes, and post-run reviews.
- Convert repeated research findings into durable wiki entries.
- Link wiki pages back to source run cards, data artifacts, assumptions, and memory IDs.
- Detect contradictions between new research and existing wiki pages.
- Rewrite, merge, split, cross-link, and archive wiki pages as new evidence arrives.
- Preserve page history and explain material revisions with source links.
- Keep wiki writing separate from analyst decision-making so finance agents do not mutate long-term knowledge while making a recommendation.

The LLM Wiki Curator must not:

- Make portfolio recommendations.
- Run backtests.
- Access raw broker credentials or unrestricted portfolio history.
- Present wiki content as a trade instruction, guaranteed advice, or replacement for the current run's risk review.

## 8. Wiki Storage

MVP should store wiki pages as local Markdown artifacts managed by Plutus, with SQLite metadata for indexing and audit.

Default layout inside the Mac host app data directory:

- `wiki/theses/`
- `wiki/strategies/`
- `wiki/risk-lessons/`
- `wiki/instruments/`
- `wiki/workflows/`
- `wiki/glossary/`

Each wiki page must include:

- Stable wiki page ID.
- Title.
- Summary.
- Source run links.
- Source memory links.
- Last reviewed timestamp.
- Confidence and freshness notes.
- Contradiction notes when applicable.
- Revision history and last updater.

## 9. Tool Requirements

The LLM Wiki Curator should use `plutus_memory`, `plutus_reports`, `plutus_research`, `plutus_wiki`, and `plutus_audit`.

`plutus_wiki` must provide:

- `search_wiki(query, filters)`: search local wiki pages and metadata.
- `get_wiki_page(pageId)`: read a page with source links and freshness metadata.
- `create_wiki_page(page, sourceRefs)`: create a wiki page with source links and revision metadata.
- `update_wiki_page(pageId, patch, sourceRefs, revisionNote)`: update an existing wiki page.
- `merge_wiki_pages(sourcePageIds, targetPage, sourceRefs)`: consolidate duplicated or overlapping pages.
- `archive_wiki_page(pageId, reason)`: archive an obsolete page.
- `revert_wiki_revision(pageId, revisionId, reason)`: restore a previous revision at user or system request.
- `find_wiki_contradictions(sourceRefs, candidateClaims)`: compare proposed claims against existing wiki pages.

Only the LLM Wiki Curator and Orchestrator may write wiki pages. Wiki writes are autonomous agent maintenance actions, but every write must produce revision history, source links, and audit events so the user can inspect or revert changes.

## 10. Workflow Contract

Memory and wiki updates must happen after the main research recommendation is produced.

Required sequence:

1. Research run completes and report writer creates the run card.
2. Orchestrator and local memory service evaluate the run for durable memory capture.
3. Memory writes go through `plutus_memory` with source links, sensitivity class, retention class, and audit events.
4. The app shows a memory activity feed with edit, pin, archive, delete, and category controls.
5. LLM Wiki Curator independently evaluates the completed run for wiki maintenance.
6. Wiki writes go through `plutus_wiki` with source links, revision notes, and contradiction checks.
7. The app shows a wiki activity feed with diffs, source links, and revert actions.
8. Audit log links every durable memory or wiki page update to its source run.

## 11. Acceptance Criteria

- The Mac host can automatically save and recall a user preference through the `plutus_memory` namespace.
- A research run can recall relevant prior theses without exposing broad database access to analyst agents.
- A user can inspect, edit, pin, archive, delete, and disable categories of durable memories after automatic capture.
- The LLM Wiki Curator can create and update wiki pages from completed run cards, source summaries, artifacts, and durable memories.
- Wiki updates are applied automatically with source links, revision notes, audit events, and user-visible diffs.
- A user can inspect wiki history and revert a wiki revision.
- Mem0 records and wiki pages are linked by IDs, summaries, tags, and source refs instead of duplicating full wiki page content into runtime memory.
- Final reports cite any recalled memory or wiki page that materially influenced the output.
- All automatic memory and wiki writes are logged through `plutus_audit`.

## 12. Source Notes

- `mem0ai/mem0` GitHub repository, accessed 2026-05-17: Apache-2.0 universal memory layer for AI agents, CLI/SDK/self-hosted paths, and about 55.9k stars.
- `letta-ai/letta` GitHub repository, accessed 2026-05-17: Apache-2.0 stateful agent platform with about 22.8k stars.
- `getzep/zep` GitHub repository, accessed 2026-05-17: context engineering examples/integrations repository with about 4.6k stars; current README points production use toward Zep Cloud and Graphiti.
