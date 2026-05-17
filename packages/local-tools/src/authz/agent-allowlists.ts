export interface AgentAllowlist {
  allowedNamespaces: string[];
  allowedTools: string[];
  writeTools: string[];
}

const ns = {
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

const tools = (namespace: string, names: string[]) =>
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

export const AGENT_ALLOWLISTS: Record<string, AgentAllowlist> = {
  orchestrator: {
    allowedNamespaces: [
      ns.memory,
      ns.audit,
      ns.market,
      ns.portfolio,
      ns.research,
    ],
    allowedTools: [
      ...tools(ns.memory, [
        "recall_user_preferences",
        "recall_prior_runs",
        "capture_research_memory",
      ]),
      ...tools(ns.audit, ["log_agent_event", "get_run_audit_trail"]),
      ...tools(ns.market, ["search_instruments", "get_quote"]),
      ...tools(ns.portfolio, ["list_portfolios", "get_portfolio_snapshot"]),
      ...tools(ns.research, ["summarize_sources"]),
    ],
    writeTools: [
      "plutus_memory.capture_research_memory",
      "plutus_audit.log_agent_event",
    ],
  },
  market_data_researcher: {
    allowedNamespaces: [ns.market, ns.audit, ns.research],
    allowedTools: [
      ...tools(ns.market, [
        "search_instruments",
        "get_quote",
        "get_ohlcv",
        "get_benchmark_series",
        "get_corporate_actions",
        "get_market_status",
        "get_provider_health",
        "select_provider",
      ]),
      ...tools(ns.audit, ["register_warning", "get_run_audit_trail"]),
      ...tools(ns.research, ["web_search", "read_url", "summarize_sources"]),
    ],
    writeTools: ["plutus_audit.register_warning"],
  },
  equity_analyst: {
    allowedNamespaces: [
      ns.market,
      ns.research,
      ns.audit,
      ns.memory,
      ns.portfolio,
    ],
    allowedTools: [
      ...tools(ns.market, [
        "search_instruments",
        "get_quote",
        "get_ohlcv",
        "get_provider_health",
      ]),
      ...tools(ns.research, [
        "web_search",
        "read_url",
        "search_filings",
        "get_news",
        "summarize_sources",
      ]),
      ...tools(ns.audit, ["log_agent_event", "get_run_audit_trail"]),
      ...tools(ns.memory, [
        "recall_user_preferences",
        "recall_prior_runs",
        "recall_saved_theses",
      ]),
      ...tools(ns.portfolio, ["get_portfolio_snapshot", "compute_allocation"]),
    ],
    writeTools: ["plutus_audit.log_agent_event"],
  },
  crypto_analyst: {
    allowedNamespaces: [ns.market, ns.research, ns.audit, ns.memory],
    allowedTools: [
      ...tools(ns.market, [
        "search_instruments",
        "get_quote",
        "get_ohlcv",
        "get_provider_health",
      ]),
      ...tools(ns.research, [
        "web_search",
        "read_url",
        "get_news",
        "summarize_sources",
      ]),
      ...tools(ns.audit, ["log_agent_event", "get_run_audit_trail"]),
      ...tools(ns.memory, [
        "recall_user_preferences",
        "recall_prior_runs",
        "recall_saved_theses",
      ]),
    ],
    writeTools: ["plutus_audit.log_agent_event"],
  },
  technical_analyst: {
    allowedNamespaces: [ns.market, ns.risk, ns.audit],
    allowedTools: [
      ...tools(ns.market, ["get_quote", "get_ohlcv", "get_benchmark_series"]),
      ...tools(ns.risk, [
        "compute_volatility",
        "compute_drawdown",
        "compute_correlation",
      ]),
      ...tools(ns.audit, ["log_agent_event", "get_run_audit_trail"]),
    ],
    writeTools: ["plutus_audit.log_agent_event"],
  },
  quant_strategy_researcher: {
    allowedNamespaces: [ns.market, ns.backtest, ns.risk, ns.audit, ns.memory],
    allowedTools: [
      ...tools(ns.market, [
        "search_instruments",
        "get_quote",
        "get_ohlcv",
        "select_provider",
      ]),
      ...tools(ns.backtest, [
        "validate_strategy_spec",
        "run_backtest",
        "get_backtest_result",
        "compare_backtests",
        "register_strategy_spec",
        "get_strategy_spec",
      ]),
      ...tools(ns.risk, ["compute_volatility", "compute_drawdown"]),
      ...tools(ns.audit, ["log_agent_event", "get_run_audit_trail"]),
      ...tools(ns.memory, ["recall_prior_runs", "recall_saved_theses"]),
    ],
    writeTools: [
      "plutus_backtest.run_backtest",
      "plutus_backtest.register_strategy_spec",
      "plutus_audit.log_agent_event",
    ],
  },
  portfolio_manager: {
    allowedNamespaces: [ns.portfolio, ns.market, ns.risk, ns.memory, ns.audit],
    allowedTools: [
      ...tools(ns.portfolio, [
        "list_portfolios",
        "get_portfolio_snapshot",
        "get_position_history",
        "get_watchlists",
        "get_instrument_notes",
        "compute_allocation",
        "compute_performance",
      ]),
      ...tools(ns.market, ["get_quote", "get_ohlcv"]),
      ...tools(ns.risk, [
        "check_concentration",
        "check_liquidity",
        "run_scenario",
      ]),
      ...tools(ns.memory, ["recall_user_preferences", "recall_prior_runs"]),
      ...tools(ns.audit, ["log_agent_event", "get_run_audit_trail"]),
    ],
    writeTools: ["plutus_audit.log_agent_event"],
  },
  risk_manager: {
    allowedNamespaces: [
      ns.risk,
      ns.portfolio,
      ns.market,
      ns.audit,
      ns.backtest,
      ns.memory,
    ],
    allowedTools: [
      ...tools(ns.risk, [
        "compute_correlation",
        "compute_volatility",
        "compute_drawdown",
        "check_concentration",
        "check_liquidity",
        "run_scenario",
        "register_risk_veto",
      ]),
      ...tools(ns.portfolio, ["get_portfolio_snapshot", "compute_allocation"]),
      ...tools(ns.market, ["get_quote", "get_ohlcv"]),
      ...tools(ns.audit, ["register_warning", "get_run_audit_trail"]),
      ...tools(ns.backtest, ["get_backtest_result", "compare_backtests"]),
      ...tools(ns.memory, ["recall_prior_runs"]),
    ],
    writeTools: [
      "plutus_risk.register_risk_veto",
      "plutus_audit.register_warning",
    ],
  },
  report_writer: {
    allowedNamespaces: [
      ns.reports,
      ns.audit,
      ns.memory,
      ns.market,
      ns.portfolio,
      ns.backtest,
      ns.risk,
    ],
    allowedTools: [
      ...tools(ns.reports, [
        "create_run_card",
        "render_report",
        "create_chart_artifact",
        "create_mobile_summary",
        "register_artifact",
      ]),
      ...tools(ns.audit, ["log_tool_provenance", "get_run_audit_trail"]),
      ...tools(ns.memory, [
        "recall_user_preferences",
        "capture_research_memory",
      ]),
      ...tools(ns.market, ["get_quote"]),
      ...tools(ns.portfolio, ["get_portfolio_snapshot", "compute_allocation"]),
      ...tools(ns.backtest, ["get_backtest_result"]),
      ...tools(ns.risk, ["check_concentration"]),
    ],
    writeTools: [
      "plutus_reports.create_run_card",
      "plutus_reports.render_report",
      "plutus_reports.create_chart_artifact",
      "plutus_reports.create_mobile_summary",
      "plutus_reports.register_artifact",
      "plutus_memory.capture_research_memory",
      "plutus_audit.log_tool_provenance",
    ],
  },
  llm_wiki_curator: {
    allowedNamespaces: [ns.memory, ns.wiki, ns.reports, ns.audit, ns.research],
    allowedTools: [
      ...tools(ns.memory, [
        "recall_user_preferences",
        "recall_prior_runs",
        "capture_research_memory",
        "update_research_memory",
        "archive_research_memory",
      ]),
      ...tools(ns.wiki, [
        "search_wiki",
        "get_wiki_page",
        "create_wiki_page",
        "update_wiki_page",
        "merge_wiki_pages",
        "archive_wiki_page",
        "revert_wiki_revision",
        "find_wiki_contradictions",
      ]),
      ...tools(ns.reports, ["register_artifact"]),
      ...tools(ns.audit, ["log_agent_event", "get_run_audit_trail"]),
      ...tools(ns.research, ["read_document", "summarize_sources"]),
    ],
    writeTools: [
      "plutus_memory.capture_research_memory",
      "plutus_memory.update_research_memory",
      "plutus_memory.archive_research_memory",
      "plutus_wiki.create_wiki_page",
      "plutus_wiki.update_wiki_page",
      "plutus_wiki.merge_wiki_pages",
      "plutus_wiki.archive_wiki_page",
      "plutus_wiki.revert_wiki_revision",
      "plutus_reports.register_artifact",
      "plutus_audit.log_agent_event",
    ],
  },
};
