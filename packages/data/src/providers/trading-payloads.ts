import {
  TradingOrderIntentSchema,
  isCcxtExchangeId,
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
  if (intent.providerId === "kiwoom") {
    return kiwoomPayload(intent, input.clientOrderId);
  }
  if (isCcxtExchangeId(intent.providerId)) {
    return ccxtPayload(intent, input.clientOrderId);
  }
  throw new UnsupportedTradingProviderError(intent.providerId);
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

function ccxtPayload(
  intent: TradingOrderIntent,
  clientOrderId: string,
): TradingProviderPayload {
  return {
    endpoint: `ccxt://${intent.providerId}/createOrder`,
    method: "POST",
    dryRun: true,
    body: {
      exchange: intent.providerId,
      type: intent.orderType,
      side: intent.side,
      amount: decimal(intent.quantity),
      price:
        intent.limitPrice === undefined ? undefined : decimal(intent.limitPrice),
      params: {
        clientOrderId,
        dryRun: true,
      },
      symbol: ccxtSymbol(intent),
    },
  };
}

function ccxtSymbol(intent: TradingOrderIntent): string {
  if (intent.symbol.includes("/")) return intent.symbol.toUpperCase();
  if (intent.symbol.includes("-")) {
    return intent.symbol.replace("-", "/").toUpperCase();
  }
  return `${intent.symbol}/${intent.quoteCurrency}`.toUpperCase();
}

function decimal(value: number): string {
  return Number.isInteger(value) ? value.toFixed(0) : String(value);
}

class UnsupportedTradingProviderError extends Error {
  readonly name = "UnsupportedTradingProviderError";

  constructor(readonly providerId: string) {
    super(`Unsupported trading provider: ${providerId}`);
  }
}
