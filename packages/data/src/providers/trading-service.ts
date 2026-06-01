import {
  DryRunOrderResultSchema,
  TradingDecisionSchema,
  TradingOrderIntentSchema,
  TradingProviderConfigSchema,
  makeWarning,
  type DryRunOrderResult,
  type TradingOrderIntent,
  type TradingOrderIntentInput,
  type TradingProviderConfig,
  type TradingProviderConfigInput,
} from "@plutus/domain";

import { defaultTradingProviderConfigs } from "./trading-defaults";
import {
  buildTradingProviderPayload,
  providerEvidenceRef,
} from "./trading-payloads";

export type TradingProviderServiceOptions = {
  readonly providerConfigs?: readonly TradingProviderConfigInput[];
  readonly now?: string;
};

export function createTradingProviderService(
  options: TradingProviderServiceOptions = {},
) {
  const now = options.now ?? "2026-06-02T00:00:00.000Z";
  const providers = [
    ...(options.providerConfigs ?? defaultTradingProviderConfigs),
  ].map((provider) => TradingProviderConfigSchema.parse(provider));

  function listProviders(): TradingProviderConfig[] {
    return providers;
  }

  function previewOrder(intentInput: TradingOrderIntentInput): DryRunOrderResult {
    const intent = TradingOrderIntentSchema.parse(intentInput);
    const provider = providers.find(
      (candidate) => candidate.providerId === intent.providerId,
    );
    if (!provider) {
      throw new Error(`Unknown trading provider: ${intent.providerId}`);
    }
    const providerPayload = buildTradingProviderPayload({
      intent,
      clientOrderId: `dry-run-${provider.providerId}-${intent.symbol}`,
    });
    const warnings = providerWarnings(provider, intent);
    const finalAction = orderFinalAction(provider, intent, warnings);
    const decision = TradingDecisionSchema.parse({
      decisionId: `decision-${provider.providerId}-${intent.symbol}`,
      provider,
      intent,
      finalAction,
      confidence: finalAction === "dry_run_allowed" ? "high" : "medium",
      agentViews: [
        {
          role: "risk_manager",
          stance: finalAction === "blocked" ? "object" : "review",
          summary:
            "Provider preview is decision support only; live submission remains approval-gated.",
        },
      ],
      blockingReasons: warnings
        .filter((warning) => warning.severity === "blocking")
        .map((warning) => warning.code),
      evidenceRefs: [providerEvidenceRef(provider.providerId)],
      warnings,
      approvalRequired: finalAction !== "dry_run_allowed",
      createdAt: now,
    });

    return DryRunOrderResultSchema.parse({
      orderId: `dry-run-${provider.providerId}-${intent.symbol}`,
      providerId: provider.providerId,
      status:
        finalAction === "blocked"
          ? "blocked"
          : finalAction === "live_requires_approval"
            ? "needs_approval"
            : "accepted",
      liveReady: false,
      providerPayload: {
        endpoint: providerPayload.endpoint,
        method: providerPayload.method,
        mode: provider.mode,
        dryRun: providerPayload.dryRun,
        body: providerPayload.body,
      },
      warnings,
      auditRefs: [`audit:trading:${provider.providerId}:${intent.symbol}`],
      decision,
      createdAt: now,
    });
  }

  return { listProviders, previewOrder };
}

function providerWarnings(
  provider: TradingProviderConfig,
  intent: TradingOrderIntent,
) {
  const warnings = [...provider.warnings];
  const livePath =
    intent.liveRequested || provider.mode === "live_requires_approval";
  if (provider.mode === "disabled") {
    warnings.push(
      makeWarning("provider_disabled", "blocking", "Provider is disabled."),
    );
  }
  if (!livePath && !provider.permissions.includes("trade_dry_run")) {
    warnings.push(
      makeWarning(
        "dry_run_permission_missing",
        "blocking",
        "Provider does not allow dry-run order preview.",
      ),
    );
  }
  if (livePath) {
    if (!provider.permissions.includes("trade_live")) {
      warnings.push(
        makeWarning(
          "live_permission_missing",
          "blocking",
          "Provider is not configured for live order permissions.",
        ),
      );
    }
    if (!provider.credentialRef) {
      warnings.push(
        makeWarning(
          "live_credentials_missing",
          "blocking",
          "Live trading requires a secure credential reference.",
        ),
      );
    }
    warnings.push(
      makeWarning(
        "human_approval_required",
        "warning",
        "Live order candidates require explicit user approval.",
      ),
    );
  }
  return warnings;
}

function orderFinalAction(
  provider: TradingProviderConfig,
  intent: TradingOrderIntent,
  warnings: ReturnType<typeof providerWarnings>,
) {
  if (warnings.some((warning) => warning.severity === "blocking")) {
    return "blocked";
  }
  if (intent.liveRequested || provider.mode === "live_requires_approval") {
    return "live_requires_approval";
  }
  return "dry_run_allowed";
}
