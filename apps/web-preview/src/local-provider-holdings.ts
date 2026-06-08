import type {
  ProviderSyncedHolding,
  TradingProviderConfig,
} from "@plutus/command-client";

export function previewSyncedHoldingsForProvider(
  provider: TradingProviderConfig,
  baseCurrency: string,
): ProviderSyncedHolding[] {
  if (provider.providerId === "upbit") {
    return [
      {
        symbol: "BTC-KRW",
        name: "Bitcoin",
        quantity: 0.42,
        averageCost: 91000000,
        costCurrency: "KRW",
        thesis: `Imported from ${provider.displayName} account balance.`,
      },
      {
        symbol: "ETH-KRW",
        name: "Ethereum",
        quantity: 2.5,
        averageCost: 4800000,
        costCurrency: "KRW",
      },
    ];
  }

  if (provider.providerId === "kiwoom") {
    return [
      {
        symbol: "005930.KS",
        name: "Samsung Electronics",
        quantity: 10,
        averageCost: 70000,
        costCurrency: baseCurrency,
        thesis: `Imported from ${provider.displayName} account balance.`,
      },
      {
        symbol: "035420.KS",
        name: "NAVER",
        quantity: 3,
        averageCost: 185000,
        costCurrency: baseCurrency,
      },
    ];
  }

  return [
    {
      symbol: `${provider.providerId}-POSITION`,
      name: `${provider.displayName} Position`,
      quantity: 1,
      averageCost: 100,
      costCurrency: baseCurrency,
      thesis: `Imported from ${provider.displayName} account balance.`,
    },
  ];
}

export function providerBaseCurrency(
  provider: TradingProviderConfig,
): string {
  return provider.region === "KR" ||
    provider.providerId === "kiwoom" ||
    provider.providerId === "upbit"
    ? "KRW"
    : "USD";
}
