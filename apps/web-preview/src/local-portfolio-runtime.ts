import type {
  Portfolio,
  ProviderPortfolioSyncResult,
  ProviderSyncedHolding,
  TradingProviderConfig,
} from "@plutus/command-client";

import {
  previewSyncedHoldingsForProvider,
  providerBaseCurrency,
} from "./local-provider-holdings";

export type LocalPortfolioRuntimeState = {
  portfolios: Portfolio[];
  tradingProviders: TradingProviderConfig[];
};

export type LocalCreatePortfolioInput = {
  readonly baseCurrency?: string;
  readonly name?: string;
};

export type LocalAddPositionInput = {
  readonly averageCost?: number;
  readonly costCurrency?: string;
  readonly portfolioId?: string;
  readonly quantity?: number;
  readonly symbol?: string;
  readonly thesis?: string;
};

type LocalPortfolioPosition = NonNullable<Portfolio["positions"]>[number];

type LocalProviderPortfolioSyncInput = {
  readonly baseCurrency?: string;
  readonly holdings?: readonly unknown[];
  readonly portfolioId?: string;
  readonly portfolioName?: string;
  readonly providerId: string;
};

export function createPortfolio(
  state: LocalPortfolioRuntimeState,
  input: LocalCreatePortfolioInput,
): Portfolio {
  const portfolio = {
    id: newId("portfolio"),
    name: input.name ?? "Untitled Portfolio",
    baseCurrency: input.baseCurrency ?? "USD",
    positions: [],
  };
  state.portfolios.push(portfolio);
  return portfolio;
}

export function addPortfolioPosition(
  state: LocalPortfolioRuntimeState,
  input: LocalAddPositionInput,
): LocalPortfolioPosition {
  const portfolio = state.portfolios.find(
    (candidate) => candidate.id === input.portfolioId,
  );
  if (!portfolio) throw new Error("Portfolio not found");

  const quantity = Number(input.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Quantity must be greater than 0.");
  }

  const averageCost = Number(input.averageCost);
  if (!Number.isFinite(averageCost) || averageCost < 0) {
    throw new Error("Average cost must be 0 or greater.");
  }

  const symbol = input.symbol?.trim().toUpperCase();
  if (!symbol) throw new Error("Symbol is required.");

  const position = {
    id: newId("position"),
    symbol,
    name: symbol,
    thesis: input.thesis ?? "",
    quantity,
    averageCost,
    costCurrency: input.costCurrency ?? "USD",
  };
  portfolio.positions = [...(portfolio.positions ?? []), position];
  return position;
}

export function syncPortfolioFromProvider(
  state: LocalPortfolioRuntimeState,
  input: unknown,
): ProviderPortfolioSyncResult {
  const parsed = parseProviderPortfolioSyncInput(input);
  const provider = state.tradingProviders.find(
    (candidate) => candidate.providerId === parsed.providerId,
  );
  if (!provider || !isConfiguredProvider(provider)) {
    throw new Error(
      `Configure provider ${parsed.providerId} before syncing holdings.`,
    );
  }

  const requestedBaseCurrency = parsed.baseCurrency?.trim();
  const baseCurrency = normalizeCurrency(
    requestedBaseCurrency || providerBaseCurrency(provider),
  );
  const sourceHoldings =
    parsed.holdings ??
    previewSyncedHoldingsForProvider(provider, baseCurrency);
  const positions = sourceHoldings.map((holding) =>
    positionFromSyncedHolding(holding),
  );
  const portfolioName =
    parsed.portfolioName?.trim() || `${provider.displayName} Synced Holdings`;
  const existingPortfolio = parsed.portfolioId
    ? state.portfolios.find(
        (candidate) => candidate.id === parsed.portfolioId,
      )
    : undefined;
  const portfolio = {
    id: existingPortfolio?.id ?? newId("portfolio"),
    name: portfolioName,
    baseCurrency,
    positions,
  };
  state.portfolios = existingPortfolio
    ? state.portfolios.map((candidate) =>
        candidate.id === portfolio.id ? portfolio : candidate,
      )
    : [portfolio, ...state.portfolios];
  return {
    importedCount: positions.length,
    portfolioId: portfolio.id,
    providerId: provider.providerId,
    skippedCount: 0,
    positionSymbols: positions.map((position) => position.symbol),
  };
}

function parseProviderPortfolioSyncInput(
  input: unknown,
): LocalProviderPortfolioSyncInput {
  const record = objectRecord(input, "Provider sync input required.");
  const providerId = stringValue(record.providerId)?.trim();
  if (!providerId) throw new Error("Provider id is required.");
  return {
    providerId,
    baseCurrency: stringValue(record.baseCurrency),
    holdings: Array.isArray(record.holdings) ? record.holdings : undefined,
    portfolioId: stringValue(record.portfolioId),
    portfolioName: stringValue(record.portfolioName),
  };
}

function positionFromSyncedHolding(input: unknown): LocalPortfolioPosition {
  const holding = parseProviderSyncedHolding(input);
  return {
    id: newId("position"),
    symbol: holding.symbol.toUpperCase(),
    name: holding.name ?? holding.symbol.toUpperCase(),
    thesis: holding.thesis ?? "",
    quantity: holding.quantity,
    averageCost: holding.averageCost,
    costCurrency: normalizeCurrency(holding.costCurrency),
  };
}

function parseProviderSyncedHolding(input: unknown): ProviderSyncedHolding {
  const record = objectRecord(input, "Synced holding input required.");
  const symbol = stringValue(record.symbol)?.trim().toUpperCase();
  if (!symbol) throw new Error("Synced holding symbol is required.");

  const quantity = Number(record.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Synced holding quantity must be greater than 0.");
  }

  const averageCost = Number(record.averageCost);
  if (!Number.isFinite(averageCost) || averageCost < 0) {
    throw new Error("Synced holding average cost must be 0 or greater.");
  }

  const costCurrency = stringValue(record.costCurrency)?.trim();
  if (!costCurrency) {
    throw new Error("Synced holding cost currency is required.");
  }

  return {
    symbol,
    name: stringValue(record.name),
    thesis: stringValue(record.thesis),
    quantity,
    averageCost,
    costCurrency,
  };
}

function isConfiguredProvider(provider: TradingProviderConfig): boolean {
  return (
    provider.mode !== "disabled" &&
    provider.health !== "not_configured" &&
    provider.health !== "blocked" &&
    Boolean(provider.credentialRef?.startsWith("secure://plutus/"))
  );
}

function normalizeCurrency(currency: string): string {
  return currency.trim().toUpperCase();
}

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function objectRecord(
  value: unknown,
  message: string,
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(message);
  }
  return { ...value };
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
