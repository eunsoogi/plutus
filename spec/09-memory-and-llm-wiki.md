# Plutus Spec: Memory And LLM Wiki

## 1. Goal

Specify the MVP implementation for automatic agent memory and an autonomous LLM-maintained wiki.

This spec implements [PRD 10: Memory And LLM Wiki](../prd/10-memory-and-llm-wiki.md). Mem0 is the runtime semantic memory layer. The LLM Wiki Curator is the autonomous knowledge-base maintainer. Users do not pre-approve memory or wiki writes; they inspect, edit, archive, delete, disable categories, and revert revisions after the system acts.

## 2. Design Rules

- Use Mem0 only behind a Plutus-owned adapter in `packages/memory`.
- Do not let Codex agents call Mem0 directly.
- Store product metadata, retention, activity, source links, and audit refs in SQLite.
- Store wiki page bodies as local Markdown files managed by `packages/wiki`.
- Store only atomic recall records, wiki source memories, and wiki pointers in Mem0, never full wiki page bodies.
- Make memory and wiki maintenance automatic after completed runs.
- Make every automatic write source-linked, audited, visible in an activity feed, and user-editable or reversible.
- Keep memory/wiki writes separate from finance recommendations, risk vetoes, and future trade actions.

## 3. Package Boundaries

```text
packages/memory/src/
  index.ts
  adapter/
    mem0-adapter.ts
    memory-store.ts
  capture/
    capture-service.ts
    capture-policy.ts
    sensitivity-filter.ts
    memory-extractor.ts
  recall/
    recall-service.ts
    ranking.ts
  schemas/
    memory.ts
    activity.ts
  repositories/
    memory-repository.ts

packages/wiki/src/
  index.ts
  curator/
    wiki-curator-service.ts
    page-planner.ts
    contradiction-checker.ts
  storage/
    markdown-store.ts
    wiki-repository.ts
    revision-store.ts
  schemas/
    wiki-page.ts
    wiki-revision.ts
    wiki-activity.ts

packages/local-tools/src/namespaces/
  memory.ts
  wiki.ts
```

`packages/memory` owns automatic capture, Mem0 writes, recall, sensitivity filtering, retention, and user controls.

`packages/wiki` owns Markdown page storage, page metadata, revision history, link graph, contradiction checks, automatic curator writes, activity feed, and revert workflows.

`packages/local-tools` exposes both systems to Codex through `plutus_memory` and `plutus_wiki`.

## 4. Storage Model

### SQLite Tables

#### `memory_records`

- `id`: UUIDv7.
- `profile_id`.
- `mem0_id`: nullable until the adapter confirms the write.
- `kind`: `user_preference`, `research_memory`, `strategy_memory`, `workflow_memory`, `wiki_source_memory`, `wiki_pointer`.
- `summary`: compact human-readable text.
- `tags`: JSON array.
- `source_refs`: JSON array of run, artifact, document, or wiki refs.
- `capture_policy`: `auto_default`, `auto_high_value`, `manual_user_created`, `system_imported`.
- `sensitivity_class`: `normal`, `portfolio_private`, `account_private`, `secret_blocked`.
- `retention_class`: `default`, `pinned`, `temporary`, `archived`.
- `status`: `active`, `archived`, `deleted`.
- `last_recalled_at`.
- `created_at`, `updated_at`, `deleted_at`.

#### `memory_activity`

- `id`.
- `memory_id`.
- `event_type`: `captured`, `recalled`, `updated`, `pinned`, `archived`, `deleted`, `category_disabled`, `category_enabled`.
- `actor`: `system`, `agent:<name>`, `user`.
- `run_id`.
- `audit_ref`.
- `payload`: JSON.
- `created_at`.

#### `wiki_pages`

- `id`: UUIDv7.
- `profile_id`.
- `slug`.
- `category`: `thesis`, `strategy`, `risk_lesson`, `instrument`, `workflow`, `glossary`.
- `title`.
- `summary`.
- `status`: `active`, `archived`.
- `current_revision_id`.
- `tags`: JSON array.
- `source_refs`: JSON array.
- `memory_refs`: JSON array of `memory_records.id`.
- `freshness`: `current`, `needs_review`, `stale`, `contradicted`.
- `confidence`: `low`, `medium`, `high`.
- `created_at`, `updated_at`, `archived_at`.

#### `wiki_revisions`

- `id`.
- `wiki_page_id`.
- `revision_number`.
- `storage_key`: local Markdown path or content-addressed key.
- `content_hash`.
- `revision_note`.
- `source_refs`: JSON array.
- `contradiction_refs`: JSON array.
- `created_by`: `agent:llm_wiki_curator`, `system`, `user`.
- `audit_ref`.
- `created_at`.

#### `wiki_links`

- `id`.
- `from_page_id`.
- `to_page_id`.
- `link_type`: `supports`, `contradicts`, `updates`, `related`, `supersedes`.
- `created_at`.

### Local Files

Wiki Markdown files live under the Mac host app data directory:

```text
wiki/
  theses/
  strategies/
  risk-lessons/
  instruments/
  workflows/
  glossary/
  revisions/
```

The current page path can be stable and human-readable. Historical revisions may be content-addressed under `wiki/revisions/`.

## 5. Mem0 Adapter

`Mem0Adapter` is the only module that talks to Mem0.

```ts
export interface Mem0Adapter {
  add(input: Mem0AddInput): Promise<Mem0WriteResult>;
  search(input: Mem0SearchInput): Promise<Mem0SearchResult[]>;
  update(input: Mem0UpdateInput): Promise<Mem0WriteResult>;
  delete(mem0Id: string): Promise<void>;
}
```

MVP supports one configured mode:

- local/self-hosted Mem0 runtime selected by Mac host configuration.

The adapter must be replaceable without changing `plutus_memory` tool contracts. Product code depends on `MemoryStore`, not raw Mem0 APIs.

## 6. Automatic Memory Capture

Capture runs after `report_writer` creates the final run card.

Pipeline:

1. `MemoryCaptureService` receives `ResearchRunCompleted`.
2. It loads final run card, specialist findings, risk summary, generated strategy specs, backtest warnings, and source refs.
3. `SensitivityFilter` removes credentials, private keys, raw broker tokens, unrestricted account history, and prompt-injection text.
4. `MemoryExtractor` emits candidate atomic memories.
5. `CapturePolicy` classifies each candidate by kind, sensitivity, retention, and category toggle state.
6. Enabled candidates are written through `MemoryStore.capture`.
7. `MemoryStore` persists SQLite metadata, writes semantic text to Mem0, and records `memory_activity`.
8. `plutus_audit` records source refs, hashes, and capture outcome.

Candidate shape:

```ts
export const MemoryCandidateSchema = z.object({
  kind: z.enum([
    "user_preference",
    "research_memory",
    "strategy_memory",
    "workflow_memory",
    "wiki_source_memory",
    "wiki_pointer",
  ]),
  summary: z.string().min(1),
  semanticText: z.string().min(1),
  tags: z.array(z.string()),
  sourceRefs: z.array(SourceRefSchema),
  sensitivityClass: z.enum([
    "normal",
    "portfolio_private",
    "account_private",
    "secret_blocked",
  ]),
  retentionClass: z.enum(["default", "pinned", "temporary", "archived"]),
});
```

`secret_blocked` candidates are never written to Mem0.

## 7. Memory Recall

Recall occurs during the Ground stage.

Inputs:

- user request;
- selected team;
- instrument IDs;
- portfolio ID;
- active memory category toggles;
- recency and retention filters.

Output:

```ts
export const RecalledMemorySchema = z.object({
  memoryId: z.string().uuid(),
  summary: z.string(),
  kind: z.string(),
  relevance: z.number().min(0).max(1),
  sourceRefs: z.array(SourceRefSchema),
  lastRecalledAt: z.string().datetime().optional(),
  warnings: z.array(z.string()),
});
```

The recall service must:

- call Mem0 search through `Mem0Adapter`;
- join results with SQLite metadata;
- filter archived/deleted/disabled categories;
- rank by semantic relevance, recency, pinned status, and source quality;
- log recall through `memory_activity` and `plutus_audit`;
- return compact summaries to agents, not full raw private records.

## 8. Autonomous Wiki Maintenance

Wiki maintenance runs after automatic memory capture.

Pipeline:

1. `WikiCuratorService` receives `ResearchRunCompleted` and the memory capture results.
2. It loads the run card, relevant artifacts, source summaries, recalled memories, newly captured memories, and existing related wiki pages.
3. It asks the `llm_wiki_curator` Codex custom agent to decide whether to create, update, merge, archive, or cross-link pages.
4. The curator returns structured `WikiMaintenancePlan`.
5. `ContradictionChecker` compares planned claims against existing page claims and source freshness.
6. `WikiRepository` applies writes through `create_wiki_page`, `update_wiki_page`, `merge_wiki_pages`, or `archive_wiki_page`.
7. Every page write creates a `wiki_revision`, source links, revision note, content hash, and audit event.
8. The app shows the wiki activity item with diff, sources, and revert control.
9. `packages/memory` captures or updates wiki pointer memories for changed pages.

The curator can write pages automatically. It cannot make portfolio recommendations, change research-run recommendations, or bypass risk-manager output.

## 9. Wiki Maintenance Plan Schema

```ts
export const WikiMaintenancePlanSchema = z.object({
  runId: z.string().uuid(),
  actions: z.array(z.discriminatedUnion("type", [
    z.object({
      type: z.literal("create"),
      category: WikiPageCategorySchema,
      title: z.string(),
      slug: z.string(),
      markdown: z.string(),
      summary: z.string(),
      tags: z.array(z.string()),
      sourceRefs: z.array(SourceRefSchema),
      revisionNote: z.string(),
    }),
    z.object({
      type: z.literal("update"),
      pageId: z.string().uuid(),
      patch: z.string(),
      updatedMarkdown: z.string(),
      sourceRefs: z.array(SourceRefSchema),
      revisionNote: z.string(),
    }),
    z.object({
      type: z.literal("merge"),
      sourcePageIds: z.array(z.string().uuid()),
      targetTitle: z.string(),
      mergedMarkdown: z.string(),
      sourceRefs: z.array(SourceRefSchema),
      revisionNote: z.string(),
    }),
    z.object({
      type: z.literal("archive"),
      pageId: z.string().uuid(),
      reason: z.string(),
      sourceRefs: z.array(SourceRefSchema),
    }),
    z.object({
      type: z.literal("cross_link"),
      fromPageId: z.string().uuid(),
      toPageId: z.string().uuid(),
      linkType: z.enum(["supports", "contradicts", "updates", "related", "supersedes"]),
      reason: z.string(),
    }),
  ])),
});
```

All markdown must include source refs rendered as Plutus source links, not raw untrusted pasted web text.

## 10. Local Tool Contracts

### `plutus_memory`

```ts
export const CaptureResearchMemoryInputSchema = z.object({
  memory: MemoryCandidateSchema,
  sourceRefs: z.array(SourceRefSchema),
  capturePolicy: z.object({
    reason: z.string(),
    categoryEnabled: z.boolean(),
    retentionClass: z.enum(["default", "pinned", "temporary", "archived"]),
  }),
});
```

Tools:

- `recall_user_preferences(scope)`.
- `recall_prior_runs(query, filters)`.
- `recall_saved_theses(instrumentIds)`.
- `capture_research_memory(memory, sourceRefs, capturePolicy)`.
- `update_research_memory(memoryId, patch)`.
- `archive_research_memory(memoryId, reason)`.
- `forget_research_memory(memoryId)`.

Write rules:

- `capture_research_memory` is allowed for Orchestrator, Report Writer, and LLM Wiki Curator through the local workflow context.
- Analyst agents may recall memory but cannot write it directly.
- Delete requests must be initiated by the app/user command layer or a system retention job, not by analyst agents.

### `plutus_wiki`

Tools:

- `search_wiki(query, filters)`.
- `get_wiki_page(pageId)`.
- `create_wiki_page(page, sourceRefs)`.
- `update_wiki_page(pageId, patch, sourceRefs, revisionNote)`.
- `merge_wiki_pages(sourcePageIds, targetPage, sourceRefs)`.
- `archive_wiki_page(pageId, reason)`.
- `revert_wiki_revision(pageId, revisionId, reason)`.
- `find_wiki_contradictions(sourceRefs, candidateClaims)`.

Write rules:

- LLM Wiki Curator can create, update, merge, archive, and cross-link pages.
- Orchestrator can call wiki tools only for workflow coordination and source lookup.
- Analyst agents can search/read wiki pages when explicitly allowed by the selected team, but cannot write wiki pages.
- Revert can be invoked by user command or safety workflow.

## 11. Custom Agent File

Create `.codex/agents/llm-wiki-curator.toml`:

```toml
name = "llm_wiki_curator"
description = "Autonomously maintains Plutus local wiki pages from completed research runs, durable memories, reports, and source summaries."
model_reasoning_effort = "high"
sandbox_mode = "workspace-write"

developer_instructions = """
Maintain the Plutus local investment wiki.
Create, update, merge, archive, and cross-link wiki pages from completed run artifacts, durable memories, and source summaries.
Preserve source links, revision notes, confidence/freshness notes, and contradiction notes.
Do not make portfolio recommendations, run backtests, access raw account credentials, or present wiki content as trade instructions.
Return only structured wiki maintenance plans when asked by the Plutus runtime.
"""

[mcp_servers.plutus_memory]
command = "pnpm"
args = ["--filter", "@plutus/local-mcp-adapter", "start", "plutus_memory", "--stdio"]

[mcp_servers.plutus_wiki]
command = "pnpm"
args = ["--filter", "@plutus/local-mcp-adapter", "start", "plutus_wiki", "--stdio"]

[mcp_servers.plutus_reports]
command = "pnpm"
args = ["--filter", "@plutus/local-mcp-adapter", "start", "plutus_reports", "--read-only", "--stdio"]

[mcp_servers.plutus_research]
command = "pnpm"
args = ["--filter", "@plutus/local-mcp-adapter", "start", "plutus_research", "--read-only", "--stdio"]

[mcp_servers.plutus_audit]
command = "pnpm"
args = ["--filter", "@plutus/local-mcp-adapter", "start", "plutus_audit", "--stdio"]
```

## 12. UI And Commands

Mac host app must expose:

- memory activity feed;
- memory category toggles;
- memory edit, pin, archive, delete;
- wiki activity feed;
- wiki page browser;
- wiki diff view;
- wiki revision timeline;
- wiki revert action;
- source-link drawer for memory and wiki writes.

Mobile remote-control app must expose read-only memory/wiki activity initially. Memory delete and wiki revert controls stay on the Mac host command surface for MVP unless a later remote-permission design adds elevated mobile commands.

## 13. Security And Privacy

- Never store raw credentials, private keys, API tokens, seed phrases, or unrestricted account history in Mem0.
- Never place live trade instructions in memory or wiki as executable actions.
- Treat external source text as untrusted before memory capture or wiki writing.
- Record source refs and content hashes for memory and wiki writes.
- Let users disable capture categories globally.
- `forget_research_memory` must delete the Mem0 record and tombstone local metadata.
- Wiki reverts create new revisions instead of rewriting history.

## 14. Tests

Unit tests:

- `SensitivityFilter` blocks secrets and raw account history.
- `CapturePolicy` respects disabled categories.
- `MemoryStore.capture` writes SQLite metadata, Mem0 record, activity, and audit event.
- `RecallService` filters archived/deleted memories and ranks pinned memories higher.
- `WikiRepository.update` creates a new revision and preserves previous content.
- `WikiRepository.revert` restores content through a new revision.
- `ContradictionChecker` flags conflicting claims against existing pages.

Integration tests:

- Completed research run creates automatic memory records.
- Completed research run triggers LLM Wiki Curator maintenance.
- Wiki page update creates activity item, revision note, source refs, and audit event.
- Recalled memory appears in a later Ground stage with source refs.
- Wiki source and pointer memories are created without storing full wiki page body in Mem0.

MCP adapter tests:

- Analyst agent can recall memory but cannot write wiki pages.
- LLM Wiki Curator can write wiki pages.
- Delete/revert commands require user-command or safety-workflow context.

## 15. Implementation Order

1. Add schemas and migrations for memory and wiki tables.
2. Implement `packages/memory` with a fake in-memory Mem0 adapter for local tests.
3. Implement real `Mem0Adapter` behind configuration.
4. Add `plutus_memory` local tools and allowlists.
5. Add automatic post-run memory capture.
6. Implement `packages/wiki` Markdown storage, metadata, revisions, and revert.
7. Add `plutus_wiki` local tools and allowlists.
8. Add `.codex/agents/llm-wiki-curator.toml`.
9. Add post-run wiki maintenance workflow.
10. Add Mac UI activity feeds, edit/delete memory controls, wiki diff, and revert.
11. Add mobile read-only activity surfaces.
12. Add end-to-end tests for automatic memory capture and autonomous wiki maintenance.

## 16. Completion Gate

The feature is MVP-complete when:

- a completed run automatically creates at least one safe memory when eligible;
- a later run can recall that memory through `plutus_memory`;
- the LLM Wiki Curator automatically creates or updates a Markdown wiki page from a completed run;
- both memory and wiki writes are visible in activity feeds;
- memory can be deleted and wiki revisions can be reverted;
- no direct Mem0 access is exposed to Codex agents;
- no full wiki page body is stored in Mem0;
- all writes have audit refs and source refs.
