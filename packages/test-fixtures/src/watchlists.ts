import { WatchlistItemSchema, WatchlistSchema } from "@plutus/domain";

import { fixtureIds, fixtureNow } from "./ids";
import { instrumentMap } from "./instruments";

const watchlistItem = (
  symbol: keyof typeof instrumentMap,
  index: number,
  triggerNote: string,
) =>
  WatchlistItemSchema.parse({
    id: `018f3f5d-0000-7000-8000-0000000004${index.toString().padStart(2, "0")}`,
    watchlistId: fixtureIds.defaultWatchlist,
    instrumentId: instrumentMap[symbol].id,
    triggerNote,
    targetZone: {},
    createdAt: fixtureNow,
    updatedAt: fixtureNow,
  });

const instrumentsById = Object.fromEntries(
  Object.entries(instrumentMap).map(([symbol, instrument]) => [
    instrument.id,
    symbol,
  ]),
) as Record<string, keyof typeof instrumentMap>;

export const defaultWatchlist = {
  ...WatchlistSchema.parse({
    id: fixtureIds.defaultWatchlist,
    profileId: fixtureIds.profile,
    name: "Default",
    createdAt: fixtureNow,
    updatedAt: fixtureNow,
  }),
  items: [
    watchlistItem("SPY", 1, "Broad market benchmark."),
    watchlistItem("QQQ", 2, "Growth and technology benchmark."),
    watchlistItem("BTC", 3, "Digital asset benchmark."),
    watchlistItem("ETH", 4, "Crypto platform comparison."),
    watchlistItem("NVDA", 5, "AI concentration watch."),
  ].map((item) => ({ ...item, symbol: instrumentsById[item.instrumentId] })),
} as const;
