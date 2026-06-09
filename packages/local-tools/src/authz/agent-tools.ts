export interface AgentAllowlist {
  allowedNamespaces: string[];
  allowedTools: string[];
  writeTools: string[];
}

export const ns = {
  audit: "plutus_audit",
  backtest: "plutus_backtest",
  market: "plutus_market_data",
  memory: "plutus_memory",
  portfolio: "plutus_portfolio",
  reports: "plutus_reports",
  research: "plutus_research",
  risk: "plutus_risk",
  wiki: "plutus_wiki",
} as const;

export const tools = (namespace: string, names: string[]) =>
  names.map((tool) => `${namespace}.${tool}`);

export const NAMESPACE_NAMES = [
  ns.market,
  ns.portfolio,
  ns.risk,
  ns.backtest,
  ns.reports,
  ns.research,
  ns.memory,
  ns.wiki,
  ns.audit,
] as const;

export const WRITE_TOOLS = new Set([
  "plutus_backtest.run_backtest",
  "plutus_backtest.register_strategy_spec",
  "plutus_risk.register_risk_veto",
  "plutus_reports.create_run_card",
  "plutus_reports.render_report",
  "plutus_reports.create_chart_artifact",
  "plutus_reports.create_mobile_summary",
  "plutus_reports.register_artifact",
  "plutus_memory.capture_research_memory",
  "plutus_memory.update_research_memory",
  "plutus_memory.archive_research_memory",
  "plutus_memory.forget_research_memory",
  "plutus_wiki.create_wiki_page",
  "plutus_wiki.update_wiki_page",
  "plutus_wiki.merge_wiki_pages",
  "plutus_wiki.archive_wiki_page",
  "plutus_wiki.revert_wiki_revision",
  "plutus_audit.log_agent_event",
  "plutus_audit.log_tool_provenance",
  "plutus_audit.register_warning",
]);
