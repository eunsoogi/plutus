import type {
  OrderSide,
  OrderType,
  ProviderId,
  ProviderMode,
  TradingOrderIntent,
} from "./provider-settings-types";

export function createTradingOrderIntent(input: {
  readonly providerId: ProviderId;
  readonly symbol: string;
  readonly side: OrderSide;
  readonly orderType: OrderType;
  readonly quantity: string;
  readonly limitPrice: string;
  readonly quoteCurrency: string;
  readonly rationale: string;
  readonly mode: ProviderMode;
}): TradingOrderIntent {
  const intent: TradingOrderIntent = {
    providerId: input.providerId,
    symbol: input.symbol,
    side: input.side,
    orderType: input.orderType,
    quantity: Number.parseFloat(input.quantity),
    quoteCurrency: input.quoteCurrency,
    rationale: input.rationale,
    liveRequested: input.mode === "live_requires_approval",
  };
  const parsedLimit = Number.parseFloat(input.limitPrice);
  return input.orderType === "limit" && Number.isFinite(parsedLimit)
    ? { ...intent, limitPrice: parsedLimit }
    : intent;
}
