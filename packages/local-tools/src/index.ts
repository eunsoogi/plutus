import { AGENT_ALLOWLISTS } from "./authz/agent-allowlists";

export {
  AGENT_ALLOWLISTS,
  NAMESPACE_NAMES,
  WRITE_TOOLS,
} from "./authz/agent-allowlists";
export { createInMemoryToolRuntime } from "./audit/in-memory-audit";
export type { AuditEvent, InMemoryToolRuntime } from "./audit/in-memory-audit";
export { localToolRunContextSchema } from "./context";
export type { LocalToolCall, LocalToolRunContext } from "./context";
export type { LocalToolCall as ToolCall } from "./context";
export { LocalToolRouter } from "./router";
export {
  localToolResponseSchema,
  localToolResponseSchema as LocalToolResponseSchema,
  localToolWarningSchema,
  sourceRefSchema,
} from "./schemas/envelope";
export type {
  LocalToolResponse,
  LocalToolWarning,
  SourceRef,
} from "./schemas/envelope";

export function makeRunContext(agentName = "portfolio_manager") {
  const allowlist =
    AGENT_ALLOWLISTS[agentName] ?? AGENT_ALLOWLISTS.portfolio_manager;

  return {
    runId: "018f3f5d-0000-7000-8000-000000000006",
    profileId: "018f3f5d-0000-7000-8000-000000000001",
    agentName,
    selectedTeam:
      agentName === "quant_strategy_researcher"
        ? "quant_strategy_desk"
        : "portfolio_review_committee",
    allowedNamespaces: allowlist.allowedNamespaces,
    allowedTools: allowlist.allowedTools,
    writeScopes: allowlist.writeTools,
  };
}
