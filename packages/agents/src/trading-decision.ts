import {
  TradingDecisionSchema,
  TradingOrderIntentSchema,
  type TradingDecision,
  type TradingOrderIntentInput,
  type TradingOrderIntent,
  type TradingProviderConfig,
} from "@plutus/domain";

export type EvaluateTradingDecisionInput = {
  readonly provider: TradingProviderConfig;
  readonly intent: TradingOrderIntentInput;
  readonly now: string;
};

function providerBlocks(provider: TradingProviderConfig): string[] {
  const blocks: string[] = [];
  if (provider.mode === "disabled") blocks.push("provider_disabled");
  if (
    !provider.permissions.includes("trade_dry_run") &&
    provider.mode !== "live_requires_approval"
  ) {
    blocks.push("dry_run_permission_missing");
  }
  return blocks;
}

function reviewReasons(input: EvaluateTradingDecisionInput): string[] {
  const reasons: string[] = [];
  if (input.provider.health === "degraded") reasons.push("provider_degraded");
  if (!input.intent.rationale) reasons.push("rationale_missing");
  return reasons;
}

function agentViews(intent: TradingOrderIntent) {
  return [
    {
      role: "bull_case",
      stance: "support",
      summary: `${intent.symbol} order candidate has an explicit thesis for review.`,
    },
    {
      role: "bear_case",
      stance: "review",
      summary: "Check valuation, liquidity, and concentration before approval.",
    },
    {
      role: "risk_manager",
      stance: "review",
      summary: "No live execution is allowed without explicit user approval.",
    },
    {
      role: "execution_specialist",
      stance: "support",
      summary: "Dry-run payload can be prepared without submitting an order.",
    },
  ] as const;
}

export function evaluateTradingDecision(
  input: EvaluateTradingDecisionInput,
): TradingDecision {
  const intent = TradingOrderIntentSchema.parse(input.intent);
  const blockingReasons = providerBlocks(input.provider);
  const needsReviewReasons = reviewReasons({ ...input, intent });
  const liveRequested =
    intent.liveRequested ||
    input.provider.mode === "live_requires_approval";
  const liveAllowed =
    liveRequested && input.provider.permissions.includes("trade_live");
  const finalAction = blockingReasons.length
    ? "blocked"
    : liveAllowed
      ? "live_requires_approval"
      : needsReviewReasons.length
        ? "needs_review"
        : "dry_run_allowed";
  const approvalRequired =
    finalAction === "needs_review" || finalAction === "live_requires_approval";
  const decisionBlocks =
    finalAction === "live_requires_approval"
      ? [...blockingReasons, "live_requires_user_approval"]
      : [...blockingReasons, ...needsReviewReasons];

  return TradingDecisionSchema.parse({
    decisionId: `decision-${input.provider.providerId}-${input.intent.symbol}`,
    provider: input.provider,
    intent,
    finalAction,
    confidence: finalAction === "dry_run_allowed" ? "high" : "medium",
    agentViews: agentViews(intent),
    blockingReasons: decisionBlocks,
    evidenceRefs: [`provider:${input.provider.providerId}`],
    warnings: input.provider.warnings,
    approvalRequired,
    createdAt: input.now,
  });
}
