# Plutus Spec: Security, Compliance, And Risk Controls

## 1. Goal

Define controls that keep Plutus within research and decision-support boundaries while protecting user data, secrets, agent workflows, generated artifacts, and financial-risk communication.

## 2. Financial Product Boundary

MVP allowed:

- portfolio tracking;
- watchlists;
- research runs;
- strategy specs;
- simulation/backtesting;
- risk warnings;
- report artifacts.

MVP forbidden:

- live order placement;
- broker/exchange write permissions;
- guaranteed return claims;
- hidden or suppressed risk warnings;
- autonomous portfolio decisions;
- high-frequency or latency-sensitive trading flows.

## 3. Recommendation Categories

Every final run card must choose one:

- `observe`
- `research_more`
- `rebalance_candidate`
- `strategy_candidate`
- `risk_warning`
- `no_action`

If risk validation is `vetoed`, final category must be `risk_warning` or `no_action`.

## 4. Prompt Injection Controls

Untrusted sources:

- uploaded documents;
- CSV imports;
- copied text;
- web pages;
- news;
- broker/export statements;
- generated strategy code from future post-MVP code-export features.

Controls:

- Keep untrusted content in delimited data fields, not system/developer instructions.
- Summarize untrusted content through `plutus_research.summarize_sources` before decision agents use it.
- Register warning when content asks the agent to ignore rules, hide losses, leak secrets, or change permissions.
- Never allow untrusted content to modify local tool allowlists, sandbox mode, model config, or approval policy.

## 5. Secret Handling

Sensitive data:

- portfolio holdings;
- broker/exchange credentials;
- API keys;
- trade history;
- research notes;
- generated strategy specs and any future generated strategy code;
- Codex environment variables.

Rules:

- Provider secrets are stored in platform secure storage.
- Remote-control pairing keys are stored in platform secure storage.
- Secrets are referenced by ID in agent-visible contexts.
- Local tools resolve secrets internally and never return raw secret values.
- Logs and traces redact tokens, keys, and authorization headers.
- Codex `env` controls must pass only the minimum variables required for the run.

## 6. Workspace And Sandbox Controls

Per-run workspaces:

```text
<app-data>/plutus-runs/
  <run-id>/
    context/
    artifacts/
    generated/
    audit/
```

Rules:

- Codex working directory is the per-run workspace.
- Generated files cannot write outside workspace paths.
- Ordinary analyst agents use read-only sandbox where possible.
- `quant_strategy_researcher` can write strategy artifacts only in the run workspace.
- If generated strategy code execution is introduced after MVP, it runs in a sandboxed process with resource limits.
- No MVP custom agent gets broad shell/database access.

## 7. Remote-Control Security

Remote control must enforce:

- explicit Mac-host enablement before pairing;
- QR code or short-lived pairing code;
- encrypted session transport;
- paired-device allowlist;
- host-visible connected-device status;
- host-side revoke action;
- host-side kill switch;
- command authorization per paired device;
- no mutations while mobile is disconnected or session is stale.

## 8. Audit Requirements

Persist audit records for:

- run creation;
- stage transitions;
- selected team;
- custom-agent versions;
- local-tool config hash;
- every tool call;
- tool input/output hashes;
- source refs;
- warnings;
- risk vetoes;
- artifact creation;
- final output validation.
- remote pairing, connection, revocation, and denied command events.

Audit logs should store hashes and artifact refs for large payloads. Do not duplicate raw secrets or unrestricted private datasets in audit tables.

## 9. Risk Guardrails

Guardrails must detect and warn/block:

- guaranteed return requests;
- hidden high-leverage trade requests;
- attempts to bypass risk review;
- instructions to hide losses or uncertainty;
- unavailable live-trading permission requests;
- leverage, margin, derivatives, illiquid markets, and concentrated positions;
- stale or missing provider data;
- unsupported market regions.

Guardrail result:

```ts
export const GuardrailResultSchema = z.object({
  status: z.enum(["allow", "warn", "block"]),
  code: z.string(),
  message: z.string(),
  requiredFinalCategory: RecommendationCategory.optional(),
  evidenceRefs: z.array(z.string()),
});
```

## 10. Account Deletion And Export

MVP must design for:

- user data export;
- account deletion request;
- deletion of portfolios, watchlists, notes, runs, and artifacts;
- retention of minimal compliance/audit records where legally required;
- deletion of app-local artifact files by storage key.

Implementation can be staged, but schemas must avoid making deletion impossible.

## 11. Future Live Trading Gate

Live trading requires a separate PRD and cannot be enabled by configuration alone. Required future controls:

- explicit user approval per order;
- pre-trade risk check;
- position limits;
- kill switch;
- broker/exchange permission scoping;
- complete order audit trail;
- compliance review.

## 12. Acceptance Tests

- Agent refuses to execute or simulate a hidden high-leverage guaranteed-profit trade.
- Uploaded prompt-injection text is flagged and does not override rules.
- Backtest report contains the past-performance caveat.
- Logs and audit records do not contain raw API keys.
- Generated strategy artifacts stay inside the per-run workspace.
- Analyst agents cannot call live trading or broad filesystem tools.
- Revoked mobile devices cannot issue remote-control commands.
