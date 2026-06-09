import type { AgentAllowlist } from "./agent-tools";
import { ns, tools } from "./agent-tools";

export const RESEARCH_AGENT_ALLOWLISTS = {
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
} satisfies Record<string, AgentAllowlist>;
