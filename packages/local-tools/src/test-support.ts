import { AGENT_ALLOWLISTS } from "./authz/agent-allowlists";

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
