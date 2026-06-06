export interface ResearchRunPromptRequest {
  readonly profileId: string;
  readonly portfolioId?: string;
  readonly selectedTeam: string;
  readonly configHash: string;
  readonly userRequest: string;
  readonly teamAgents: readonly string[];
}

export function buildInitialResearchRunPrompt(
  request: ResearchRunPromptRequest,
): string {
  return [
    "Start a Plutus research run.",
    `Profile: ${request.profileId}`,
    request.portfolioId ? `Portfolio: ${request.portfolioId}` : undefined,
    `Team: ${request.selectedTeam}`,
    `Agents: ${request.teamAgents.join(", ")}`,
    `Config hash: ${request.configHash}`,
    `User request: ${request.userRequest}`,
    "Run this as a Codex multi-agent team using the selected Plutus agents.",
    "Follow this operating sequence: plan, ground, execute, debate, validate, report.",
    "Use the local MCP tools for current portfolio, market, risk, and report data instead of asking for pasted inputs.",
    "For stock and crypto status analysis, include exposure, data freshness, correlation or an explicit data limitation, dissenting views, and a risk summary.",
    "Return only allowed recommendation categories: observe, research_more, rebalance_candidate, strategy_candidate, risk_warning, or no_action.",
    "This is research only. Do not produce live trading instructions or imperative buy, sell, or hold calls.",
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}
