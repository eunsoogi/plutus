import type { AnyRecord } from "./types";

export function normalizePositionInput(input: AnyRecord): AnyRecord {
  return {
    profile_id: input.profileId,
    portfolio_id: input.portfolioId,
    account_id: input.accountId,
    symbol: input.symbol,
    quantity: input.quantity,
    average_cost: input.averageCost,
    cost_currency: input.costCurrency,
    thesis: input.thesis,
  };
}

export function normalizeProviderPortfolioSyncInput(
  input: AnyRecord,
): AnyRecord {
  return {
    profile_id: input.profileId,
    portfolio_id: input.portfolioId,
    provider_id: input.providerId,
    portfolio_name: input.portfolioName,
    base_currency: input.baseCurrency,
    holdings: Array.isArray(input.holdings)
      ? input.holdings.map((holding) =>
          normalizeProviderSyncedHolding(holding as AnyRecord),
        )
      : undefined,
  };
}

export function normalizeWatchlistItem(input: AnyRecord): AnyRecord {
  return {
    profile_id: input.profileId,
    watchlist_id: input.watchlistId,
    item_id: input.itemId,
    symbol: input.symbol,
    trigger_note: input.triggerNote,
    target_zone: input.targetZone,
  };
}

export function normalizeTradingProvider(input: AnyRecord): AnyRecord {
  return {
    provider_id: input.providerId,
    display_name: input.displayName,
    market: input.market,
    region: input.region,
    environment: input.environment,
    mode: input.mode,
    permissions: input.permissions,
    health: input.health,
    last_checked_at: input.lastCheckedAt,
    credential_ref: input.credentialRef,
    warnings: input.warnings,
  };
}

export function normalizeTradingDecisionInput(input: AnyRecord): AnyRecord {
  const provider = input.provider;
  const intent = input.intent;
  return {
    provider:
      provider && typeof provider === "object"
        ? normalizeTradingProvider(provider as AnyRecord)
        : provider,
    intent:
      intent && typeof intent === "object"
        ? normalizeTradingIntent(intent as AnyRecord)
        : intent,
    decision: input.decision,
  };
}

export function normalizeRemoteUnlock(unlock: AnyRecord) {
  return {
    method: unlock.method,
    session_key_ref: unlock.sessionKeyRef,
    challenge:
      typeof unlock.challenge === "string" ? unlock.challenge : undefined,
  };
}

export function normalizeTauriResult(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeTauriResult);
  if (!value || typeof value !== "object") return value;
  const normalized: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    normalized[snakeToCamel(key)] = normalizeTauriResult(nested);
  }
  return normalized;
}

function normalizeTradingIntent(input: AnyRecord): AnyRecord {
  return {
    provider_id: input.providerId,
    symbol: input.symbol,
    side: input.side,
    order_type: input.orderType,
    quantity: input.quantity,
    limit_price: input.limitPrice,
    quote_currency: input.quoteCurrency,
    rationale: input.rationale,
    live_requested: input.liveRequested,
  };
}

function normalizeProviderSyncedHolding(input: AnyRecord): AnyRecord {
  return {
    symbol: input.symbol,
    name: input.name,
    quantity: input.quantity,
    average_cost: input.averageCost,
    cost_currency: input.costCurrency,
    thesis: input.thesis,
  };
}

function snakeToCamel(key: string): string {
  return key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}
