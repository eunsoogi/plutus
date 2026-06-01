import {
  buildTradingProviderPayload,
  createDefaultTradingProviderConfigs,
} from "../../../packages/data/src/providers/trading";
import {
  CCXT_EXCHANGE_IDS,
  DryRunOrderResultSchema,
  TradingOrderIntentSchema,
  TradingProviderConfigSchema,
  type DryRunOrderResult,
  type TradingDecision,
  type TradingOrderIntent,
  type TradingProviderConfig,
} from "../../../packages/domain/src/index";
import { evaluateTradingDecision } from "../../../packages/agents/src/trading-decision";

export type LocalTradingState = {
  tradingProviders: TradingProviderConfig[];
  tradingDecisions: TradingDecision[];
  dryRunOrders: DryRunOrderResult[];
};

export function emptyTradingState(now: string): LocalTradingState {
  return {
    tradingProviders: createDefaultTradingProviderConfigs(now),
    tradingDecisions: [],
    dryRunOrders: [],
  };
}

export function normalizeTradingState(
  parsed: Partial<LocalTradingState>,
  now: string,
): LocalTradingState {
  const fallback = emptyTradingState(now);
  const persistedProviders =
    Array.isArray(parsed.tradingProviders) && parsed.tradingProviders.length > 0
      ? parsed.tradingProviders.map((provider) => normalizeTradingProvider(provider))
      : [];
  return {
    tradingProviders: mergeTradingProviders(
      fallback.tradingProviders,
      persistedProviders,
    ),
    tradingDecisions: Array.isArray(parsed.tradingDecisions)
      ? parsed.tradingDecisions.map((decision) => decision)
      : fallback.tradingDecisions,
    dryRunOrders: Array.isArray(parsed.dryRunOrders)
      ? parsed.dryRunOrders.map((order) => DryRunOrderResultSchema.parse(order))
      : fallback.dryRunOrders,
  };
}

export function saveTradingProvider(
  state: LocalTradingState,
  input: unknown,
): TradingProviderConfig {
  const provider = TradingProviderConfigSchema.parse(input);
  state.tradingProviders = [
    provider,
    ...state.tradingProviders.filter(
      (candidate) => candidate.providerId !== provider.providerId,
    ),
  ].sort(compareProviders);
  return provider;
}

export function previewTradingDecision(
  state: LocalTradingState,
  input: unknown,
  now: string,
): TradingDecision {
  const { provider, intent } = parseTradingInput(input);
  const decision = evaluateTradingDecision({ provider, intent, now });
  state.tradingDecisions = [
    decision,
    ...state.tradingDecisions.filter(
      (candidate) => candidate.decisionId !== decision.decisionId,
    ),
  ];
  return decision;
}

export function submitDryRunOrder(
  state: LocalTradingState,
  input: unknown,
  now: string,
): DryRunOrderResult {
  const { provider, intent } = parseTradingInput(input);
  const decision =
    extractDecision(input) ?? previewTradingDecision(state, input, now);
  const payload = buildTradingProviderPayload({
    intent,
    clientOrderId: `dry-run-${provider.providerId}-${crypto.randomUUID()}`,
  });
  const order = DryRunOrderResultSchema.parse({
    orderId: `dry-run-${provider.providerId}-${crypto.randomUUID()}`,
    providerId: provider.providerId,
    status: orderStatus(decision.finalAction),
    liveReady: false,
    providerPayload: {
      endpoint: payload.endpoint,
      method: payload.method,
      dryRun: payload.dryRun,
      body: payload.body,
    },
    warnings: decision.warnings,
    auditRefs: [`audit:local:${provider.providerId}:${Date.now()}`],
    decision,
    createdAt: now,
  });
  state.dryRunOrders = [order, ...state.dryRunOrders];
  return order;
}

function parseTradingInput(input: unknown): {
  provider: TradingProviderConfig;
  intent: TradingOrderIntent;
} {
  if (!input || typeof input !== "object")
    throw new Error("Trading input required");
  const record = input as Record<string, unknown>;
  return {
    provider: TradingProviderConfigSchema.parse(record.provider),
    intent: TradingOrderIntentSchema.parse(record.intent),
  };
}

function extractDecision(input: unknown): TradingDecision | undefined {
  if (!input || typeof input !== "object") return undefined;
  const decision = (input as Record<string, unknown>).decision;
  return decision && typeof decision === "object"
    ? (decision as TradingDecision)
    : undefined;
}

function orderStatus(
  finalAction: TradingDecision["finalAction"],
): DryRunOrderResult["status"] {
  switch (finalAction) {
    case "dry_run_allowed":
      return "accepted";
    case "needs_review":
    case "live_requires_approval":
      return "needs_approval";
    case "blocked":
      return "blocked";
    default:
      return assertNever(finalAction);
  }
}

function providerRank(provider: TradingProviderConfig): number {
  if (provider.providerId === "kiwoom") return 0;
  const ccxtRank = CCXT_EXCHANGE_IDS.findIndex(
    (exchangeId) => exchangeId === provider.providerId,
  );
  return ccxtRank === -1 ? 1000 : 1 + ccxtRank;
}

function compareProviders(
  left: TradingProviderConfig,
  right: TradingProviderConfig,
): number {
  const rankDelta = providerRank(left) - providerRank(right);
  return rankDelta === 0
    ? left.providerId.localeCompare(right.providerId)
    : rankDelta;
}

function mergeTradingProviders(
  fallbackProviders: readonly TradingProviderConfig[],
  persistedProviders: readonly TradingProviderConfig[],
): TradingProviderConfig[] {
  const providersById = new Map(
    fallbackProviders.map((provider) => [provider.providerId, provider]),
  );
  for (const provider of persistedProviders) {
    providersById.set(provider.providerId, provider);
  }
  return Array.from(providersById.values()).sort(compareProviders);
}

function assertNever(value: never): never {
  throw new Error(`Unsupported decision action: ${String(value)}`);
}

function normalizeTradingProvider(provider: unknown): TradingProviderConfig {
  const parsed = TradingProviderConfigSchema.parse(provider);
  if (parsed.credentialRef || parsed.health !== "connected") return parsed;
  return {
    ...parsed,
    health: "not_configured",
  };
}
