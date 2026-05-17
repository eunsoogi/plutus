import { marketData } from "./market-data";
import { mvpProfile } from "./mvp-profile";
import { corePortfolio } from "./portfolios";
import { remoteDevices } from "./remote-devices";
import { acceptanceResearchRun } from "./research-runs";
import { defaultWatchlist } from "./watchlists";

export * from "./ids";
export * from "./instruments";
export * from "./market-data";
export * from "./mvp-profile";
export * from "./portfolios";
export * from "./remote-devices";
export * from "./research-runs";
export * from "./watchlists";

export const quotes = marketData.quotes;
export const mvpScenario = {
  profile: mvpProfile,
  portfolios: [corePortfolio],
  watchlists: [defaultWatchlist],
  runs: [acceptanceResearchRun],
  remoteDevices,
} as const;
