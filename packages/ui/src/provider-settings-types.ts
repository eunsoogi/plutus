import {
  CCXT_EXCHANGE_IDS,
  ccxtExchangeDisplayName,
} from "@plutus/domain";

export type ProviderId = string;
export type ProviderMode =
  | "disabled"
  | "read_only"
  | "dry_run"
  | "live_requires_approval";
export type OrderSide = "buy" | "sell";
export type OrderType = "market" | "limit";

export type TradingProviderConfig = {
  readonly providerId: ProviderId;
  readonly displayName: string;
  readonly market: string;
  readonly region: string;
  readonly environment: "mock" | "sandbox" | "paper" | "live";
  readonly mode: ProviderMode;
  readonly permissions: readonly string[];
  readonly health: "connected" | "degraded" | "not_configured" | "blocked";
  readonly lastCheckedAt: string;
  readonly credentialRef: string | null;
  readonly warnings: readonly {
    readonly code: string;
    readonly severity: "info" | "warning" | "blocking";
    readonly message: string;
  }[];
};

export type TradingOrderIntent = {
  readonly providerId: ProviderId;
  readonly symbol: string;
  readonly side: OrderSide;
  readonly orderType: OrderType;
  readonly quantity: number;
  readonly limitPrice?: number;
  readonly quoteCurrency: string;
  readonly rationale?: string;
  readonly liveRequested?: boolean;
};

export type TradingDecision = {
  readonly decisionId: string;
  readonly provider: TradingProviderConfig;
  readonly intent: TradingOrderIntent;
  readonly finalAction:
    | "dry_run_allowed"
    | "needs_review"
    | "blocked"
    | "live_requires_approval";
  readonly confidence: "low" | "medium" | "high";
  readonly agentViews: readonly {
    readonly role: string;
    readonly stance: string;
    readonly summary: string;
  }[];
  readonly blockingReasons: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly warnings: TradingProviderConfig["warnings"];
  readonly approvalRequired: boolean;
  readonly createdAt: string;
};

export type DryRunOrderResult = {
  readonly orderId: string;
  readonly providerId: ProviderId;
  readonly status: "accepted" | "blocked" | "needs_approval";
  readonly liveReady: boolean;
  readonly providerPayload: Record<string, unknown>;
  readonly warnings: TradingProviderConfig["warnings"];
  readonly auditRefs: readonly string[];
  readonly decision: TradingDecision;
  readonly createdAt: string;
};

export type ProviderCommandClient = {
  readonly providers?: {
    readonly list: () => Promise<TradingProviderConfig[]>;
    readonly save: (
      input: TradingProviderConfig,
    ) => Promise<TradingProviderConfig>;
  };
  readonly trading?: {
    readonly previewDecision: (input: {
      provider: TradingProviderConfig;
      intent: TradingOrderIntent;
    }) => Promise<TradingDecision>;
    readonly submitDryRunOrder: (input: {
      provider: TradingProviderConfig;
      intent: TradingOrderIntent;
      decision?: TradingDecision;
    }) => Promise<DryRunOrderResult>;
  };
};

export const ccxtExchangeCount = CCXT_EXCHANGE_IDS.length;

export const fallbackProviders: readonly TradingProviderConfig[] = [
  providerFixture("kiwoom", "Kiwoom Securities", "Korean equities", "KR"),
  ...CCXT_EXCHANGE_IDS.map((exchangeId) =>
    providerFixture(
      exchangeId,
      ccxtExchangeDisplayName(exchangeId),
      "Spot crypto / derivatives via CCXT",
      "CCXT",
    ),
  ),
];

export function editProvider(
  provider: TradingProviderConfig,
  settings: {
    readonly credentialRef: string | null;
    readonly mode: ProviderMode;
  },
): TradingProviderConfig {
  const tradeLive = settings.mode === "live_requires_approval";
  const health =
    settings.credentialRef && provider.health === "not_configured"
      ? "degraded"
      : settings.credentialRef
        ? provider.health
        : "not_configured";
  const permissions = tradeLive
    ? Array.from(new Set([...provider.permissions, "trade_live"]))
    : provider.permissions.filter((permission) => permission !== "trade_live");
  return {
    ...provider,
    credentialRef: settings.credentialRef,
    mode: settings.mode,
    environment: tradeLive
      ? "live"
      : provider.environment === "live"
        ? "sandbox"
        : provider.environment,
    health,
    permissions,
    lastCheckedAt: new Date().toISOString(),
  };
}

export function defaultCredentialRef(providerId: ProviderId): string {
  return `secure://plutus/providers/${providerId}/main`;
}

function providerFixture(
  providerId: ProviderId,
  displayName: string,
  market: string,
  region: string,
): TradingProviderConfig {
  return {
    providerId,
    displayName,
    market,
    region,
    environment: providerId === "kiwoom" ? "mock" : "sandbox",
    mode: "dry_run",
    permissions: ["market_data", "account_read", "trade_dry_run"],
    health: "not_configured",
    lastCheckedAt: "2026-06-02T00:00:00.000Z",
    credentialRef: null,
    warnings: [],
  };
}
