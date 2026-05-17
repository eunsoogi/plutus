# Plutus Spec: Agent Runtime And Run Lifecycle

## 1. Goal

Specify how Plutus turns a Mac-hosted user research request into a local Codex-controlled multi-agent run with planning, grounding, specialist execution, debate, risk validation, report creation, persistence, mobile remote-control streaming, and app restart resumability.

## 2. Runtime Rule

`@openai/codex-sdk` is used only by `packages/agents` through `CodexRunHost`, instantiated by the local Tauri runtime. React UI code and unrelated modules cannot start Codex threads directly.

Desktop MVP runs full Codex workflows locally on the Mac host. Mobile MVP does not run Codex directly; it sends remote-control commands to the Mac host and receives run events, summaries, and artifacts from that host.

## 3. Run State Machine

```text
queued
  -> planning
  -> grounding
  -> executing
  -> debating
  -> validating
  -> reporting
  -> completed

Any active state can transition to failed or cancelled.
```

State ownership:

- Tauri command creates `queued`.
- Agent host controls `planning` through `reporting`.
- Repository validates final transition to `completed`.
- User command can request `cancelled`.
- Local runtime marks `failed` with structured failure reason.

## 4. Stage Contracts

### Plan

Input:

- user request;
- portfolio/watchlist context references;
- user preferences;
- available team presets;
- allowed recommendation categories.

Output schema:

```ts
export const RunPlanSchema = z.object({
  intent: z.enum([
    "portfolio_review",
    "equity_research",
    "crypto_research",
    "strategy_backtest",
    "technical_analysis",
    "watchlist_review",
    "knowledge_curation",
  ]),
  selectedTeam: z.enum([
    "portfolio_review_committee",
    "investment_committee",
    "crypto_research_desk",
    "quant_strategy_desk",
    "technical_analysis_panel",
    "knowledge_curation_desk",
  ]),
  requiredInstruments: z.array(z.string()),
  requiredPortfolioIds: z.array(z.string().uuid()),
  requiredTools: z.array(z.string()),
  validationLevel: z.enum(["standard", "enhanced_risk", "blocking_risk"]),
  rationale: z.string(),
});
```

### Ground

Fetch data through local tools only:

- instruments;
- quotes;
- OHLCV;
- portfolio snapshot;
- allocation;
- watchlist notes;
- prior run summaries;
- recalled memories;
- relevant wiki page summaries;
- provider freshness.

Output:

- `GroundingBundle` with source refs and warning refs.

### Execute

Run specialist analyses with team-specific role instructions and structured outputs. Each specialist returns:

```ts
export const SpecialistFindingSchema = z.object({
  role: z.string(),
  scope: z.string(),
  inputsUsed: z.array(z.string()),
  keyObservations: z.array(z.string()),
  confidence: z.enum(["low", "medium", "high"]),
  dataFreshness: z.array(DataFreshness),
  limitations: z.array(z.string()),
  recommendedNextAction: z.string(),
  evidenceRefs: z.array(z.string()),
});
```

### Debate

Material recommendations require dissent capture:

- bull case;
- bear case;
- portfolio impact;
- risk objection;
- unresolved uncertainty.

If the selected team does not include distinct bull/bear roles, the orchestrator must still ask at least one specialist or the risk manager to produce dissenting views.

### Validate

Risk manager validates:

- concentration;
- correlation;
- volatility;
- liquidity;
- leverage/derivatives exposure;
- data freshness;
- benchmark mismatch;
- strategy assumption quality;
- output category safety.

Risk manager can return:

- `approved`;
- `approved_with_warnings`;
- `vetoed`.

`vetoed` runs can still complete, but the final recommendation category must be `risk_warning` or `no_action`.

### Deliver

Report writer creates:

- run card;
- report artifact;
- chart artifact references;
- mobile summary;
- next actions;
- user approval notice for any future irreversible action.

## 5. Team Presets

### Portfolio Review Committee

Agents:

- `market_data_researcher`
- `portfolio_manager`
- `risk_manager`
- `report_writer`

Use when request references current holdings, allocation, exposure, concentration, or portfolio risk.

### Investment Committee

Agents:

- `equity_analyst` bull pass
- `equity_analyst` bear pass
- `technical_analyst`
- `portfolio_manager`
- `risk_manager`
- `report_writer`

Use for stock/ETF investment theses and portfolio impact.

### Crypto Research Desk

Agents:

- `crypto_analyst`
- `technical_analyst`
- `quant_strategy_researcher`
- `risk_manager`
- `report_writer`

Use for crypto research and simple crypto strategy exploration.

### Quant Strategy Desk

Agents:

- `market_data_researcher`
- `quant_strategy_researcher`
- `risk_manager`
- `report_writer`

Use for natural-language strategy specs and backtest requests.

### Technical Analysis Panel

Agents:

- `market_data_researcher`
- `technical_analyst`
- `risk_manager`
- `report_writer`

Use for chart/regime/support/resistance questions.

### Knowledge Curation Desk

Agents:

- `llm_wiki_curator`
- `report_writer`

Use after completed runs and for explicit knowledge-base maintenance commands. This team does not make portfolio recommendations.

## 6. Custom Agent Files

Create these files under `.codex/agents/`:

```text
market-data-researcher.toml
equity-analyst.toml
crypto-analyst.toml
quant-strategy-researcher.toml
technical-analyst.toml
portfolio-manager.toml
risk-manager.toml
report-writer.toml
llm-wiki-curator.toml
```

Every file must define:

- `name`
- `description`
- `developer_instructions`
- role-appropriate `model_reasoning_effort`
- `sandbox_mode`
- explicit local stdio MCP adapter allowlists from `spec/03-local-tool-surface.md`

## 7. CodexRunHost Adapter

Implementation location:

```text
packages/agents/src/codex-run-host/
  codex-run-host.ts
  codex-sdk-run-host.ts
  run-workspace.ts
  streamed-events.ts
  structured-turn.ts
  config-overrides.ts
```

### Start

`startResearchRun(input)` must:

1. create `research_runs` row;
2. create per-run workspace directory in the app data directory;
3. materialize safe run context files;
4. compute custom-agent and local-tool config hashes;
5. call `startThread({ workingDirectory, ...config })`;
6. persist `codex_thread_id`;
7. enqueue/enter the plan stage.

### Post-Run Memory And Wiki Maintenance

After a run reaches `completed`, the local runtime must:

1. run automatic memory capture through `packages/memory`;
2. write eligible atomic memories through `plutus_memory`;
3. trigger the LLM Wiki Curator when the run created durable lessons, strategy notes, or thesis changes;
4. write wiki changes through `plutus_wiki` with source links, revision notes, and audit refs;
5. emit memory/wiki activity events to the Mac host UI and paired mobile clients.

This maintenance step must not change the final run recommendation or risk-manager decision.

### Stream

`streamResearchRun(handle)` must:

- call `runStreamed()` for live stages;
- map Codex JSONL events to `CodexRunEvent`;
- redact secrets and raw env values;
- persist event summaries, not unbounded raw stream payloads;
- emit local runtime events to the Tauri webview.

### Structured Turns

`requestStructuredTurn(handle, prompt, schema)` must:

- pass a JSON Schema derived from Zod;
- validate SDK output again with Zod;
- store validation failures;
- retry only when the failure is schema-format related and within run budget.

### Resume

`resumeResearchRun(threadId)` must:

- locate `research_runs.codex_thread_id`;
- verify workspace exists;
- call `resumeThread(threadId)`;
- continue from persisted stage;
- fail closed if custom-agent or local-tool config hash changed in a way that invalidates reproducibility.

## 8. Native Subagent And Deterministic Modes

MVP default: native Codex subagent workflow through project custom agents.

Use deterministic multi-thread mode when:

- per-agent retries are required;
- strict budgets are required;
- every specialist output must map one-to-one to a database row;
- native subagent behavior is not deterministic enough for a regulated workflow.

The public workflow command interface must stay the same for both modes.

## 9. Final Run Card Schema

```ts
export const RunCardSchema = z.object({
  runId: z.string().uuid(),
  userRequest: z.string(),
  selectedTeam: z.string(),
  recommendationCategory: RecommendationCategory,
  plainLanguageSummary: z.string(),
  confidence: z.enum(["low", "medium", "high"]),
  supportingEvidence: z.array(z.object({
    label: z.string(),
    sourceRef: z.string(),
    freshness: DataFreshness.optional(),
  })),
  dissentingViews: z.array(z.string()),
  riskChecklist: z.array(z.object({
    check: z.string(),
    status: z.enum(["pass", "warning", "fail", "not_applicable"]),
    evidenceRefs: z.array(z.string()),
  })),
  artifacts: z.array(z.object({
    artifactId: z.string().uuid(),
    type: ArtifactType,
    title: z.string(),
  })),
  limitations: z.array(z.string()),
  nextActions: z.array(z.string()),
  userApprovalRequired: z.boolean(),
});
```

## 10. Acceptance Tests

The first end-to-end test should run:

```text
BTC and NVDA exposure together looks risky. Review my portfolio and suggest what to inspect.
```

Expected result:

- selected team is `portfolio_review_committee`;
- portfolio snapshot includes BTC and NVDA exposure;
- market data freshness is visible;
- correlation or data limitation is included;
- risk manager can warn or veto;
- final category is one of the allowed categories;
- run card and mobile summary artifacts are persisted on the Mac host;
- run can be reopened by ID from the Mac host database and inspected from mobile while connected through remote control.

Agent-runtime test automation requirements:

- Unit tests validate run state transitions, structured output schemas, retry limits, and final run card category rules.
- Integration tests use a mocked Codex SDK stream by default and must not call real models unless an explicit real-smoke environment variable is set.
- MCP adapter integration tests prove each specialist receives only the local tool namespaces allowed in [Local Tool Surface](./03-local-tool-surface.md).
- The BTC/NVDA scenario must be runnable through `pnpm test:agent` with deterministic fixtures from [Codex Development Automation](./08-codex-development-automation.md).
