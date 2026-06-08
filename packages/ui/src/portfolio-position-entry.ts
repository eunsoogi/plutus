export type PositionEntryFormValues = {
  readonly averageCost: string;
  readonly costCurrency: string;
  readonly portfolioId: string;
  readonly profileId?: string;
  readonly quantity: string;
  readonly symbol: string;
  readonly thesis: string;
};

export type AddPortfolioPositionInput = {
  readonly averageCost: number;
  readonly costCurrency: string;
  readonly portfolioId: string;
  readonly profileId?: string;
  readonly quantity: number;
  readonly symbol: string;
  readonly thesis?: string;
};

export type PositionEntryValidationKey =
  | "portfolio.positionPortfolioRequired"
  | "portfolio.positionSymbolRequired"
  | "portfolio.positionQuantityRequired"
  | "portfolio.positionAverageCostRequired"
  | "portfolio.positionCurrencyRequired";

export type PositionEntryParseResult =
  | {
      readonly ok: true;
      readonly input: AddPortfolioPositionInput;
    }
  | {
      readonly ok: false;
      readonly messageKey: PositionEntryValidationKey;
    };

const SUPPORTED_COST_CURRENCY = "USD";
const DISPLAYED_CRYPTO_USD_ALIASES: Readonly<Record<string, string>> = {
  BTC: "BTC-USD",
  ETH: "ETH-USD",
  USDC: "USDC-USD",
};

export function parsePositionEntryForm(
  values: PositionEntryFormValues,
): PositionEntryParseResult {
  const portfolioId = values.portfolioId.trim();
  if (!portfolioId) {
    return { ok: false, messageKey: "portfolio.positionPortfolioRequired" };
  }

  const symbol = normalizePositionSymbol(values.symbol);
  if (!symbol) {
    return { ok: false, messageKey: "portfolio.positionSymbolRequired" };
  }

  const quantity = Number(values.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { ok: false, messageKey: "portfolio.positionQuantityRequired" };
  }

  const averageCostValue = values.averageCost.trim();
  if (!averageCostValue) {
    return {
      ok: false,
      messageKey: "portfolio.positionAverageCostRequired",
    };
  }

  const averageCost = Number(averageCostValue);
  if (!Number.isFinite(averageCost) || averageCost < 0) {
    return {
      ok: false,
      messageKey: "portfolio.positionAverageCostRequired",
    };
  }

  const costCurrency = values.costCurrency.trim().toUpperCase();
  if (costCurrency !== SUPPORTED_COST_CURRENCY) {
    return { ok: false, messageKey: "portfolio.positionCurrencyRequired" };
  }

  const thesis = values.thesis.trim();
  return {
    ok: true,
    input: {
      averageCost,
      costCurrency,
      portfolioId,
      ...(values.profileId ? { profileId: values.profileId } : {}),
      quantity,
      symbol,
      ...(thesis ? { thesis } : {}),
    },
  };
}

function normalizePositionSymbol(value: string): string {
  const symbol = value.trim().toUpperCase();
  return DISPLAYED_CRYPTO_USD_ALIASES[symbol] ?? symbol;
}
