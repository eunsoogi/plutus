import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { defaultWatchlist } from "../runtime-reference-data";
import { warning } from "./common";
import type { AllocationGroupBy, PortfolioLike } from "./portfolio-fixtures";

export function groupByFor(input: unknown): AllocationGroupBy {
  if (!input || typeof input !== "object" || !("groupBy" in input)) {
    return "position";
  }
  const groupBy = String((input as { groupBy: unknown }).groupBy);
  return [
    "sector",
    "category",
    "currency",
    "account",
    "riskBucket",
    "tag",
  ].includes(groupBy)
    ? (groupBy as AllocationGroupBy)
    : "position";
}

export function portfolioFor(
  input: unknown,
  portfolios: PortfolioLike[],
): PortfolioLike | undefined {
  const portfolioId =
    input && typeof input === "object" && "portfolioId" in input
      ? String((input as { portfolioId: unknown }).portfolioId)
      : undefined;
  return portfolioId
    ? portfolios.find((portfolio) => portfolio.id === portfolioId)
    : portfolios[0];
}

export function portfolioAccessWarning(
  input: unknown,
  profileId: string,
  portfolios: PortfolioLike[],
) {
  const requestedProfileId =
    input && typeof input === "object" && "profileId" in input
      ? String((input as { profileId: unknown }).profileId)
      : undefined;
  if (requestedProfileId && requestedProfileId !== profileId) {
    return warning(
      "portfolio_outside_active_profile",
      "blocking",
      "Portfolio tools cannot read portfolios outside the active profile.",
    );
  }

  const requestedPortfolioId =
    input && typeof input === "object" && "portfolioId" in input
      ? String((input as { portfolioId: unknown }).portfolioId)
      : undefined;
  if (
    requestedPortfolioId &&
    !portfolios.some(
      (portfolio) =>
        portfolio.id === requestedPortfolioId &&
        portfolio.profileId === profileId,
    )
  ) {
    return warning(
      "portfolio_outside_active_profile",
      "blocking",
      "Portfolio tools cannot read portfolios outside the active profile.",
    );
  }
  return undefined;
}

export function portfolioStateFor(appDataPath: string | undefined):
  | {
      portfolios: PortfolioLike[];
      watchlists: Array<typeof defaultWatchlist>;
    }
  | undefined {
  if (!appDataPath) return undefined;
  const path = join(appDataPath, "local-tools", "portfolio-state.json");
  if (!existsSync(path)) return undefined;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as {
      portfolios?: unknown;
      watchlists?: unknown;
    };
    if (!Array.isArray(parsed.portfolios)) return undefined;
    return {
      portfolios: parsed.portfolios as PortfolioLike[],
      watchlists: Array.isArray(parsed.watchlists)
        ? (parsed.watchlists as Array<typeof defaultWatchlist>)
        : [],
    };
  } catch {
    return undefined;
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
