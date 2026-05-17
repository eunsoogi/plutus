import { z } from "zod";

export const AllowedCommandSchema = z.enum([
  "portfolios.list",
  "portfolios.create",
  "portfolios.getSnapshot",
  "portfolios.addPosition",
  "portfolios.updatePosition",
  "portfolios.updatePositionThesis",
  "watchlists.list",
  "watchlists.create",
  "watchlists.addItem",
  "watchlists.updateItem",
  "researchRuns.start",
  "researchRuns.get",
  "researchRuns.cancel",
  "artifacts.get",
  "artifacts.openLocalFile",
  "memory.listActivity",
  "memory.update",
  "memory.archive",
  "memory.forget",
  "memory.setCategoryEnabled",
  "wiki.listPages",
  "wiki.getPage",
  "wiki.listActivity",
  "wiki.revertRevision",
]);

export const CommandEnvelopeSchema = z.object({
  command: AllowedCommandSchema,
  args: z.array(z.unknown()).default([]),
});

export type CommandEnvelope = z.infer<typeof CommandEnvelopeSchema>;
export type CommandBridge = <T = unknown>(
  envelope: CommandEnvelope,
) => Promise<T>;

export interface Portfolio {
  id: string;
  name: string;
  baseCurrency: string;
  positions?: Array<{ id: string; symbol: string; thesis: string }>;
}

export interface Watchlist {
  id: string;
  name: string;
  items: Array<{ id: string; symbol: string; triggerNote: string }>;
}

export interface ResearchRun {
  id: string;
  status: string;
  portfolioId: string;
  selectedTeam?: string;
  thesis?: string;
}

export interface AgentArtifact {
  id: string;
  title: string;
  type: string;
}

type AnyRecord = Record<string, unknown>;

const corePortfolio: Portfolio = {
  id: "portfolio-core",
  name: "Core",
  baseCurrency: "USD",
  positions: [
    {
      id: "position-btc",
      symbol: "BTC",
      thesis: "Long-term store-of-value exposure.",
    },
    {
      id: "position-nvda",
      symbol: "NVDA",
      thesis: "AI infrastructure upside with valuation risk.",
    },
  ],
};

const defaultWatchlist: Watchlist = {
  id: "watchlist-default",
  name: "Default Watchlist",
  items: [
    { id: "watch-btc", symbol: "BTC", triggerNote: "Digital asset benchmark." },
    {
      id: "watch-nvda",
      symbol: "NVDA",
      triggerNote: "AI concentration watch.",
    },
  ],
};

const btcNvdaRun: ResearchRun = {
  id: "run-btc-nvda",
  portfolioId: corePortfolio.id,
  status: "completed",
  selectedTeam: "portfolio_review_committee",
};

const runCardArtifact: AgentArtifact = {
  id: "artifact-risk-report",
  title: "BTC NVDA risk report",
  type: "run_card",
};

function invoke<T>(
  bridge: CommandBridge,
  command: z.infer<typeof AllowedCommandSchema>,
  args: unknown[],
) {
  return bridge<T>(CommandEnvelopeSchema.parse({ command, args }));
}

export function createCommandClient(bridge: CommandBridge) {
  return {
    portfolios: {
      list: () => invoke<Portfolio[]>(bridge, "portfolios.list", []),
      create: (input: { name: string; baseCurrency: string }) =>
        invoke<Portfolio>(bridge, "portfolios.create", [input]),
      getSnapshot: (input: AnyRecord) =>
        invoke<AnyRecord>(bridge, "portfolios.getSnapshot", [input]),
      addPosition: (input: AnyRecord) =>
        invoke<AnyRecord>(bridge, "portfolios.addPosition", [input]),
      updatePosition: (input: AnyRecord) =>
        invoke<AnyRecord>(bridge, "portfolios.updatePosition", [input]),
      updatePositionThesis: (input: AnyRecord) =>
        invoke<AnyRecord>(bridge, "portfolios.updatePositionThesis", [input]),
    },
    watchlists: {
      list: () => invoke<Watchlist[]>(bridge, "watchlists.list", []),
      create: (input: AnyRecord) =>
        invoke<AnyRecord>(bridge, "watchlists.create", [input]),
      addItem: (input: AnyRecord) =>
        invoke<AnyRecord>(bridge, "watchlists.addItem", [input]),
      updateItem: (input: AnyRecord) =>
        invoke<AnyRecord>(bridge, "watchlists.updateItem", [input]),
    },
    researchRuns: {
      start: (input: {
        portfolioId?: string;
        symbols?: string[];
        thesis?: string;
        userRequest?: string;
      }) => invoke<ResearchRun>(bridge, "researchRuns.start", [input]),
      get: (runId: string) =>
        invoke<AnyRecord>(bridge, "researchRuns.get", [runId]),
      cancel: (runId: string) =>
        invoke<void>(bridge, "researchRuns.cancel", [runId]),
    },
    artifacts: {
      get: (artifactId: string) =>
        invoke<AgentArtifact>(bridge, "artifacts.get", [artifactId]),
      openLocalFile: async (artifactId: string) => {
        await invoke<unknown>(bridge, "artifacts.openLocalFile", [artifactId]);
      },
    },
    memory: {
      listActivity: (input: AnyRecord) =>
        invoke<AnyRecord[]>(bridge, "memory.listActivity", [input]),
      update: (memoryId: string, patch: AnyRecord) =>
        invoke<AnyRecord>(bridge, "memory.update", [memoryId, patch]),
      archive: (memoryId: string, reason: string) =>
        invoke<void>(bridge, "memory.archive", [memoryId, reason]),
      forget: (memoryId: string) =>
        invoke<void>(bridge, "memory.forget", [memoryId]),
      setCategoryEnabled: (category: string, enabled: boolean) =>
        invoke<void>(bridge, "memory.setCategoryEnabled", [category, enabled]),
    },
    wiki: {
      listPages: (input: AnyRecord) =>
        invoke<AnyRecord[]>(bridge, "wiki.listPages", [input]),
      getPage: (pageId: string) =>
        invoke<AnyRecord>(bridge, "wiki.getPage", [pageId]),
      listActivity: (input: AnyRecord) =>
        invoke<AnyRecord[]>(bridge, "wiki.listActivity", [input]),
      revertRevision: (pageId: string, revisionId: string, reason: string) =>
        invoke<AnyRecord>(bridge, "wiki.revertRevision", [
          pageId,
          revisionId,
          reason,
        ]),
    },
  };
}

export function createMockCommandBridge(
  handlers: Record<string, (...args: any[]) => Promise<unknown>>,
) {
  const calls: CommandEnvelope[] = [];
  const bridge = (async <T>(envelope: CommandEnvelope): Promise<T> => {
    const parsed = CommandEnvelopeSchema.parse(envelope);
    calls.push(parsed);
    const handler = handlers[parsed.command];
    if (!handler)
      throw new Error(`No handler registered for ${parsed.command}`);
    return (await handler(...parsed.args)) as T;
  }) as CommandBridge & { calls: CommandEnvelope[] };
  bridge.calls = calls;
  return bridge;
}

export function redactCommandLog<T>(value: T): T {
  if (Array.isArray(value))
    return value.map((item) => redactCommandLog(item)) as T;
  if (value && typeof value === "object") {
    const redacted: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      redacted[key] = /apiKey|authorization|token|secret|sessionKey/i.test(key)
        ? "[REDACTED]"
        : redactCommandLog(nested);
    }
    return redacted as T;
  }
  return value;
}

export class FixtureCommandClient {
  portfolios = {
    list: async (): Promise<Portfolio[]> => [corePortfolio],
    create: async (input: { name: string }): Promise<Portfolio> => ({
      ...corePortfolio,
      name: input.name,
    }),
    getSnapshot: async (_input: { portfolioId: string }) => ({
      portfolio: corePortfolio,
    }),
    updatePositionThesis: async (input: {
      positionId: string;
      thesis: string;
    }) => ({
      ...(corePortfolio.positions?.find(
        (position) => position.id === input.positionId,
      ) ?? corePortfolio.positions?.[0]),
      thesis: input.thesis,
    }),
  };

  watchlists = {
    list: async (): Promise<Watchlist[]> => [defaultWatchlist],
    updateItem: async (input: { itemId: string; triggerNote: string }) => ({
      ...(defaultWatchlist.items.find((item) => item.id === input.itemId) ??
        defaultWatchlist.items[0]),
      triggerNote: input.triggerNote,
    }),
  };

  researchRuns = {
    start: async (_input: { userRequest: string }): Promise<ResearchRun> =>
      btcNvdaRun,
    get: async (_runId: string) => ({
      run: btcNvdaRun,
      artifacts: [runCardArtifact],
    }),
    cancel: async (_runId: string) => undefined,
  };

  artifacts = {
    get: async (_artifactId: string): Promise<AgentArtifact> => runCardArtifact,
    openLocalFile: async (_artifactId: string) => undefined,
  };
}
