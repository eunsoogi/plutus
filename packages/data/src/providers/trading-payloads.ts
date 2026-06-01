import {
  TradingOrderIntentSchema,
  type TradingOrderIntent,
  type TradingOrderIntentInput,
  type TradingProviderConfig,
  type TradingProviderId,
} from "@plutus/domain";

export type TradingProviderPayload = {
  readonly endpoint: string;
  readonly method: "POST";
  readonly dryRun: true;
  readonly body: Record<string, unknown>;
};

export type BuildTradingProviderPayloadInput = {
  readonly intent: TradingOrderIntentInput;
  readonly clientOrderId: string;
};

export function buildTradingProviderPayload(
  input: BuildTradingProviderPayloadInput,
): TradingProviderPayload {
  const intent = TradingOrderIntentSchema.parse(input.intent);
  switch (intent.providerId) {
    case "kiwoom":
      return kiwoomPayload(intent, input.clientOrderId);
    case "upbit":
      return upbitPayload(intent, input.clientOrderId);
    case "coinbase":
      return coinbasePayload(intent, input.clientOrderId);
    case "binance":
      return binancePayload(intent, input.clientOrderId);
    default:
      return assertNever(intent.providerId);
  }
}

export function providerSupportsDryRun(
  provider: TradingProviderConfig,
): boolean {
  return provider.permissions.includes("trade_dry_run");
}

export function providerEvidenceRef(providerId: TradingProviderId): string {
  return `provider:${providerId}`;
}

function kiwoomPayload(
  intent: TradingOrderIntent,
  clientOrderId: string,
): TradingProviderPayload {
  return {
    endpoint: "/api/dostk/ordr",
    method: "POST",
    dryRun: true,
    body: {
      domain: "https://mockapi.kiwoom.com",
      client_order_id: clientOrderId,
      symbol: intent.symbol,
      side: intent.side,
      order_type: intent.orderType,
      quantity: decimal(intent.quantity),
      limit_price:
        intent.limitPrice === undefined ? undefined : decimal(intent.limitPrice),
      quote_currency: intent.quoteCurrency,
    },
  };
}

function upbitPayload(
  intent: TradingOrderIntent,
  clientOrderId: string,
): TradingProviderPayload {
  const isMarketBuy = intent.orderType === "market" && intent.side === "buy";
  return {
    endpoint: "/v1/orders",
    method: "POST",
    dryRun: true,
    body: {
      market: upbitMarket(intent),
      side: intent.side === "buy" ? "bid" : "ask",
      ord_type:
        intent.orderType === "limit"
          ? "limit"
          : intent.side === "buy"
            ? "price"
            : "market",
      volume: isMarketBuy ? undefined : decimal(intent.quantity),
      price:
        intent.orderType === "limit"
          ? decimal(intent.limitPrice ?? 0)
          : isMarketBuy
            ? decimal(intent.quantity)
            : undefined,
      identifier: clientOrderId,
    },
  };
}

function coinbasePayload(
  intent: TradingOrderIntent,
  clientOrderId: string,
): TradingProviderPayload {
  return {
    endpoint: "/api/v3/brokerage/orders/preview",
    method: "POST",
    dryRun: true,
    body: {
      client_order_id: clientOrderId,
      product_id: coinbaseProductId(intent),
      side: intent.side === "buy" ? "BUY" : "SELL",
      order_configuration:
        intent.orderType === "limit"
          ? {
              limit_limit_gtc: {
                base_size: decimal(intent.quantity),
                limit_price: decimal(intent.limitPrice ?? 0),
                post_only: false,
              },
            }
          : {
              market_market_ioc: {
                base_size: decimal(intent.quantity),
                rfq_disabled: true,
              },
            },
    },
  };
}

function binancePayload(
  intent: TradingOrderIntent,
  clientOrderId: string,
): TradingProviderPayload {
  return {
    endpoint: "/api/v3/order/test",
    method: "POST",
    dryRun: true,
    body: {
      symbol: binanceSymbol(intent),
      side: intent.side === "buy" ? "BUY" : "SELL",
      type: intent.orderType === "limit" ? "LIMIT" : "MARKET",
      timeInForce: intent.orderType === "limit" ? "GTC" : undefined,
      quantity: decimal(intent.quantity),
      price:
        intent.limitPrice === undefined ? undefined : decimal(intent.limitPrice),
      newClientOrderId: clientOrderId,
    },
  };
}

function upbitMarket(intent: TradingOrderIntent): string {
  if (intent.symbol.includes("-")) return intent.symbol.toUpperCase();
  return `${intent.quoteCurrency}-${intent.symbol}`.toUpperCase();
}

function coinbaseProductId(intent: TradingOrderIntent): string {
  if (intent.symbol.includes("-")) return intent.symbol.toUpperCase();
  return `${intent.symbol}-${intent.quoteCurrency}`.toUpperCase();
}

function binanceSymbol(intent: TradingOrderIntent): string {
  return intent.symbol.includes("-")
    ? intent.symbol.replace("-", "").toUpperCase()
    : `${intent.symbol}${intent.quoteCurrency}`.toUpperCase();
}

function decimal(value: number): string {
  return Number.isInteger(value) ? value.toFixed(0) : String(value);
}

function assertNever(value: never): never {
  throw new Error(`Unsupported trading provider: ${String(value)}`);
}
