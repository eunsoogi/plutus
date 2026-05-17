# Plutus Spec: Domain Model And Persistence

## 1. Goal

Define the data model, local persistence boundaries, and domain schemas needed for MVP portfolio management, watchlists, market data normalization, research runs, strategy specs, backtests, artifacts, and audit logging.

## 2. ID And Timestamp Conventions

- Use UUIDv7 for primary product records.
- Use provider-native identifiers only as external references, never as primary keys.
- Store all timestamps as ISO 8601 UTC strings in SQLite `TEXT` columns.
- Store market sessions and candle intervals with explicit timezone metadata.
- Use ISO currency codes for fiat and stablecoin-denominated cash balances.

## 3. Core Enums

```ts
export const AssetType = z.enum([
  "stock",
  "etf",
  "crypto",
  "stablecoin",
  "cash",
]);

export const RecommendationCategory = z.enum([
  "observe",
  "research_more",
  "rebalance_candidate",
  "strategy_candidate",
  "risk_warning",
  "no_action",
]);

export const ResearchRunStatus = z.enum([
  "queued",
  "planning",
  "grounding",
  "executing",
  "debating",
  "validating",
  "reporting",
  "completed",
  "failed",
  "cancelled",
]);

export const ArtifactType = z.enum([
  "run_card",
  "report_markdown",
  "report_html",
  "chart_json",
  "strategy_spec",
  "backtest_result",
  "mobile_summary",
  "audit_export",
]);

export const MemoryKind = z.enum([
  "user_preference",
  "research_memory",
  "strategy_memory",
  "workflow_memory",
  "wiki_source_memory",
  "wiki_pointer",
]);

export const WikiPageCategory = z.enum([
  "thesis",
  "strategy",
  "risk_lesson",
  "instrument",
  "workflow",
  "glossary",
]);
```

## 4. Entity Model

### LocalProfile

Owns portfolios, watchlists, preferences, research runs, and secrets references on the Mac host.

Columns:

- `id`
- `display_name`
- `created_at`
- `updated_at`
- `deleted_at`

### Account

Logical grouping for positions. MVP supports manual accounts only.

- `id`
- `profile_id`
- `name`
- `account_type`: `manual`, `cash`, `broker_readonly`, `exchange_readonly`
- `base_currency`
- `created_at`
- `updated_at`

### Portfolio

- `id`
- `profile_id`
- `name`
- `base_currency`
- `benchmark_id`
- `risk_profile`: JSON object containing optional limits
- `created_at`
- `updated_at`

### Position

Represents current and historical holdings. MVP can model current positions plus lot-level cost basis rows.

- `id`
- `portfolio_id`
- `account_id`
- `instrument_id`
- `quantity`
- `average_cost`
- `cost_currency`
- `fees_total`
- `acquired_at`
- `risk_bucket`
- `tags`: text array
- `thesis`
- `created_at`
- `updated_at`

### Instrument

Canonical tradable or trackable asset identity.

- `id`
- `asset_type`
- `canonical_symbol`
- `display_symbol`
- `name`
- `sector`
- `category`
- `market`
- `region`
- `currency`
- `exchange`
- `provider_refs`: JSON object keyed by provider
- `status`: `active`, `delisted`, `unsupported`
- `created_at`
- `updated_at`

### PriceBar

Normalized OHLCV candle.

- `id`
- `instrument_id`
- `provider`
- `interval`
- `timestamp`
- `timezone`
- `open`
- `high`
- `low`
- `close`
- `volume`
- `adjusted_close`
- `source_metadata`
- unique index on `(instrument_id, provider, interval, timestamp)`

### QuoteSnapshot

Latest quote snapshot with freshness metadata.

- `id`
- `instrument_id`
- `provider`
- `as_of`
- `price`
- `currency`
- `bid`
- `ask`
- `volume`
- `delay_status`: `realtime`, `delayed`, `stale`, `unknown`
- `warnings`: JSON array

### Watchlist

- `id`
- `profile_id`
- `name`
- `created_at`
- `updated_at`

### WatchlistItem

- `id`
- `watchlist_id`
- `instrument_id`
- `trigger_note`
- `target_zone`: JSON object with optional price ranges and invalidation levels
- `created_at`
- `updated_at`

### ResearchRun

- `id`
- `profile_id`
- `portfolio_id`
- `status`
- `user_request`
- `selected_team`
- `codex_thread_id`
- `workspace_path`
- `custom_agent_versions`
- `local_tool_config_hash`
- `model_config`
- `recommendation_category`
- `confidence`
- `started_at`
- `completed_at`
- `failure_reason`

### AgentArtifact

- `id`
- `research_run_id`
- `artifact_type`
- `title`
- `storage_key`
- `content_hash`
- `mime_type`
- `metadata`
- `created_by_agent`
- `created_at`

### StrategySpec

- `id`
- `profile_id`
- `research_run_id`
- `name`
- `asset_universe`
- `time_range`
- `entry_rules`
- `exit_rules`
- `position_sizing`
- `risk_rules`
- `required_data`
- `benchmark_id`
- `fee_assumption_bps`
- `slippage_assumption_bps`
- `engine_target`
- `validation_plan`
- `status`: `draft`, `validated`, `rejected`, `archived`

### BacktestRun

- `id`
- `strategy_spec_id`
- `research_run_id`
- `status`
- `dataset_ref`
- `assumptions`
- `metrics`
- `warnings`
- `artifact_ids`
- `started_at`
- `completed_at`
- `failure_reason`

### AuditEvent

- `id`
- `research_run_id`
- `agent_name`
- `event_type`
- `payload_ref`
- `input_hash`
- `output_hash`
- `source_refs`
- `created_at`

### MemoryRecord

Product-owned metadata for Mem0-backed automatic memory.

- `id`
- `profile_id`
- `mem0_id`
- `kind`: `user_preference`, `research_memory`, `strategy_memory`, `workflow_memory`, `wiki_source_memory`, `wiki_pointer`
- `summary`
- `tags`
- `source_refs`
- `capture_policy`
- `sensitivity_class`
- `retention_class`
- `status`: `active`, `archived`, `deleted`
- `last_recalled_at`
- `created_at`
- `updated_at`
- `deleted_at`

### MemoryActivity

- `id`
- `memory_id`
- `event_type`: `captured`, `recalled`, `updated`, `pinned`, `archived`, `deleted`, `category_disabled`, `category_enabled`
- `actor`
- `research_run_id`
- `audit_ref`
- `payload`
- `created_at`

### WikiPage

- `id`
- `profile_id`
- `slug`
- `category`: `thesis`, `strategy`, `risk_lesson`, `instrument`, `workflow`, `glossary`
- `title`
- `summary`
- `status`: `active`, `archived`
- `current_revision_id`
- `tags`
- `source_refs`
- `memory_refs`
- `freshness`: `current`, `needs_review`, `stale`, `contradicted`
- `confidence`: `low`, `medium`, `high`
- `created_at`
- `updated_at`
- `archived_at`

### WikiRevision

- `id`
- `wiki_page_id`
- `revision_number`
- `storage_key`
- `content_hash`
- `revision_note`
- `source_refs`
- `contradiction_refs`
- `created_by`
- `audit_ref`
- `created_at`

### WikiLink

- `id`
- `from_page_id`
- `to_page_id`
- `link_type`: `supports`, `contradicts`, `updates`, `related`, `supersedes`
- `created_at`

### RemoteDevice

Paired mobile controller identity.

- `id`
- `profile_id`
- `device_name`
- `device_platform`: `ios`, `android`
- `public_key`
- `permissions`: JSON object containing allowed remote command groups
- `paired_at`
- `last_seen_at`
- `revoked_at`

### RemoteSession

Short-lived connection state for a paired mobile device.

- `id`
- `remote_device_id`
- `status`: `pairing`, `connected`, `stale`, `revoked`
- `host_address`
- `started_at`
- `last_heartbeat_at`
- `ended_at`

## 5. Zod Schema Placement

Schemas live in `packages/domain/src` unless they depend on provider or runtime-specific types.

```text
packages/domain/src/
  ids.ts
  common.ts
  instrument/schema.ts
  portfolio/schema.ts
  watchlist/schema.ts
  strategy/schema.ts
  research-run/schema.ts
  artifact/schema.ts
  memory/schema.ts
  wiki/schema.ts
  remote-control/schema.ts
```

Provider-specific schemas live in `packages/data/src/providers/<provider>/schema.ts`.

Agent structured output schemas live in `packages/agents/src/schemas`.

Backtest engine schemas live in `packages/backtest/src`.

## 6. Local Database Module Boundaries

`apps/tauri/src-tauri/src/storage` owns SQLite persistence wiring. Domain packages define schemas and types but do not import database clients.

```text
apps/tauri/src-tauri/src/storage/
  schema/
    profiles.rs
    instruments.rs
    portfolios.rs
    market_data.rs
    watchlists.rs
    research_runs.rs
    strategies.rs
    artifacts.rs
    memory.rs
    wiki.rs
    audit.rs
    remote_control.rs
  repositories/
    portfolio_repository.rs
    instrument_repository.rs
    research_run_repository.rs
    artifact_repository.rs
    memory_repository.rs
    wiki_repository.rs
    remote_device_repository.rs
  migrations/
```

Repositories expose product operations, not raw SQL tables, for example:

```ts
export interface PortfolioRepository {
  createPortfolio(input: CreatePortfolioInput): Promise<Portfolio>;
  addPosition(input: AddPositionInput): Promise<Position>;
  getSnapshot(input: GetPortfolioSnapshotInput): Promise<PortfolioSnapshot>;
  computeAllocation(input: ComputeAllocationInput): Promise<AllocationBreakdown>;
}
```

SQLite is the MVP database. Do not require PostgreSQL, Redis, or a hosted database for MVP.

## 7. Derived Views

MVP should compute these in the local runtime and expose them through Tauri commands and local tools:

- allocation by asset class;
- allocation by sector/category;
- allocation by currency;
- allocation by account;
- allocation by risk bucket;
- allocation by tag;
- instrument exposure table;
- cash/stablecoin exposure;
- portfolio performance against benchmark;
- BTC/NVDA or arbitrary instrument correlation matrix;
- data freshness summary for all instruments used in a run.

## 8. Data Freshness Contract

Every market-data response returns:

```ts
export const DataFreshness = z.object({
  provider: z.string(),
  asOf: z.string().datetime(),
  receivedAt: z.string().datetime(),
  delayStatus: z.enum(["realtime", "delayed", "stale", "unknown"]),
  warnings: z.array(z.object({
    code: z.string(),
    severity: z.enum(["info", "warning", "blocking"]),
    message: z.string(),
  })),
});
```

Agents and reports must surface `warning` and `blocking` freshness states.

## 9. MVP Seed Scenario

The first product acceptance scenario must be seedable:

- Portfolio: "Core"
- Holdings: AAPL, NVDA, BTC, ETH, USDC, USD cash
- Watchlist: SPY, QQQ, BTC, ETH, NVDA
- Default benchmarks: SPY, QQQ, BTC, ETH

This seed state supports the required request:

```text
BTC and NVDA exposure together looks risky. Review my portfolio and suggest what to inspect.
```

## 10. Phase 2 Extensions

- Trade import rows for CSV uploads.
- Shadow Account behavior diagnostics.
- Broker/exchange read-only account references.
- Advanced memory governance beyond MVP category toggles.
- Periodic wiki review jobs and advanced contradiction review workflows.
- Provider health history and quota tracking.
- Expanded remote-control device metadata beyond MVP pairing and revocation fields.
