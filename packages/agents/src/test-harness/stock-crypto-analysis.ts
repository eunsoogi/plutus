import type { FinalRunCard } from "../codex-run-host/schemas";
import {
  type AnalysisRunCardInput,
  blockingMessages,
  correlationFor,
  quoteAvailable,
  quoteDelayStatus,
  quoteFreshness,
  warningMessages,
  weightFor,
} from "./stock-crypto-evidence";
import { createFinalRunCard } from "./scripted-run-stream";

export function stockCryptoAnalysisPlan(portfolioId: string) {
  return {
    intent: "portfolio_review",
    selectedTeam: "portfolio_review_committee",
    requiredInstruments: ["BTC", "NVDA"],
    requiredPortfolioIds: [portfolioId],
    requiredTools: [
      "plutus_market_data.get_quote",
      "plutus_portfolio.compute_allocation",
      "plutus_risk.compute_correlation",
      "plutus_risk.check_concentration",
      "plutus_risk.check_liquidity",
      "plutus_reports.create_run_card",
    ],
    validationLevel: "enhanced_risk",
    rationale: "The request references current stock and crypto exposure risk.",
  };
}

export function createAnalysisRunCard(
  input: AnalysisRunCardInput,
): FinalRunCard {
  const btcWeight = weightFor(input.allocation.data, "BTC");
  const nvdaWeight = weightFor(input.allocation.data, "NVDA");
  const correlation = correlationFor(input.correlation.data);
  const blockingLimitations = blockingMessages(input);
  if (
    blockingLimitations.length > 0 ||
    btcWeight === undefined ||
    nvdaWeight === undefined ||
    correlation === undefined ||
    !quoteAvailable(input.btcQuote.data) ||
    !quoteAvailable(input.nvdaQuote.data)
  ) {
    return unavailableAnalysisRunCard(input, blockingLimitations);
  }

  return createFinalRunCard({
    runId: input.runId,
    profileId: input.profileId,
    userRequest: input.userRequest,
    selectedTeam: "portfolio_review_committee",
    title: "BTC/NVDA multi-agent status analysis",
    summary: `Market, portfolio, risk, and report agents reviewed BTC (${btcWeight}%) plus NVDA (${nvdaWeight}%) exposure; BTC/NVDA correlation is ${correlation}.`,
    confidence: "medium",
    warnings: [
      ...warningMessages(input.btcQuote.warnings),
      ...warningMessages(input.nvdaQuote.warnings),
      ...warningMessages(input.concentration.warnings),
      ...warningMessages(input.liquidity.warnings),
    ],
    evidenceRefs: [
      "agent:market_data_researcher:quote:BTC",
      "agent:market_data_researcher:quote:NVDA",
      "agent:portfolio_manager:allocation",
      "agent:risk_manager:correlation",
      "agent:report_writer:run_card",
    ],
    supportingEvidence: [
      {
        label: `portfolio_manager exposure BTC ${btcWeight}% / NVDA ${nvdaWeight}%`,
        sourceRef: "plutus_portfolio.compute_allocation",
      },
      {
        label: `risk_manager BTC/NVDA correlation ${correlation}`,
        sourceRef: "plutus_risk.compute_correlation",
      },
      {
        label: "market_data_researcher BTC quote freshness",
        sourceRef: quoteFreshness(input.btcQuote.data),
      },
      {
        label: "market_data_researcher NVDA quote freshness",
        sourceRef: quoteFreshness(input.nvdaQuote.data, "NVDA"),
      },
      {
        label: "report_writer generated run card artifact",
        sourceRef: "plutus_reports.create_run_card",
      },
    ],
    freshness: { delayStatus: quoteDelayStatus(input.btcQuote.data) },
    dissentingViews: [
      "Bull view: NVDA and BTC can both remain strong in risk-on markets.",
      "Risk view: positive BTC/NVDA correlation can amplify drawdowns during liquidity stress.",
    ],
    riskChecklist: [
      {
        check: "BTC/NVDA correlation",
        status: correlation >= 0.6 ? "warning" : "pass",
        evidenceRefs: ["plutus_risk.compute_correlation"],
      },
      {
        check: "Concentration",
        status: input.concentration.warnings.length > 0 ? "warning" : "pass",
        evidenceRefs: ["plutus_risk.check_concentration"],
      },
      {
        check: "Liquidity sizing",
        status: input.liquidity.warnings.length > 0 ? "warning" : "pass",
        evidenceRefs: ["plutus_risk.check_liquidity"],
      },
    ],
    limitations: [
      "Deterministic fixture analysis; refresh live provider data before an investment decision.",
      "Research-only workflow; no live trading or imperative buy/sell/hold instruction.",
    ],
    nextActions: [
      "Inspect combined BTC and NVDA weights against the portfolio risk budget.",
      "Refresh BTC quote freshness and rerun correlation before any rebalance candidate is considered.",
    ],
    approvalRequired: true,
  });
}

function unavailableAnalysisRunCard(
  input: AnalysisRunCardInput,
  blockingLimitations: readonly string[],
): FinalRunCard {
  const limitations =
    blockingLimitations.length > 0
      ? blockingLimitations
      : ["Required portfolio, market, or risk data was unavailable."];
  return createFinalRunCard({
    runId: input.runId,
    profileId: input.profileId,
    userRequest: input.userRequest,
    selectedTeam: "portfolio_review_committee",
    title: "BTC/NVDA multi-agent status analysis unavailable",
    category: "no_action",
    riskValidation: "vetoed",
    summary:
      "Required local tool data was unavailable, so the multi-agent team did not produce a stock and crypto status conclusion.",
    confidence: "low",
    warnings: [
      ...limitations,
      ...warningMessages(input.btcQuote.warnings),
      ...warningMessages(input.nvdaQuote.warnings),
      ...warningMessages(input.allocation.warnings),
      ...warningMessages(input.correlation.warnings),
      ...warningMessages(input.concentration.warnings),
      ...warningMessages(input.liquidity.warnings),
    ],
    evidenceRefs: [
      "plutus_portfolio.compute_allocation",
      "plutus_market_data.get_quote:BTC",
      "plutus_market_data.get_quote:NVDA",
      "plutus_risk.compute_correlation",
    ],
    supportingEvidence: [
      {
        label: "portfolio_manager allocation unavailable or incomplete",
        sourceRef: "plutus_portfolio.compute_allocation",
      },
      {
        label: "market_data_researcher BTC quote unavailable or incomplete",
        sourceRef: quoteFreshness(input.btcQuote.data, "BTC"),
      },
      {
        label: "market_data_researcher NVDA quote unavailable or incomplete",
        sourceRef: quoteFreshness(input.nvdaQuote.data, "NVDA"),
      },
      {
        label: "risk_manager BTC/NVDA correlation unavailable or incomplete",
        sourceRef: "plutus_risk.compute_correlation",
      },
    ],
    freshness: { delayStatus: "unknown" },
    dissentingViews: [
      "Risk view: missing required data prevents a reliable stock and crypto status assessment.",
    ],
    riskChecklist: [
      {
        check: "Required local tool data",
        status: "fail",
        evidenceRefs: [
          "plutus_portfolio.compute_allocation",
          "plutus_market_data.get_quote:BTC",
          "plutus_market_data.get_quote:NVDA",
          "plutus_risk.compute_correlation",
        ],
      },
    ],
    limitations: [
      ...limitations,
      "Research-only workflow; no live trading or imperative buy/sell/hold instruction.",
    ],
    nextActions: [
      "Configure local portfolio, market, and risk data providers, then rerun the analysis.",
    ],
    approvalRequired: true,
  });
}
