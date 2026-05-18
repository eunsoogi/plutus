import type {
  AgentArtifact,
  AppSnapshot,
  CommandBridge,
  CommandEnvelope,
  Portfolio,
  ResearchRun,
  Watchlist,
} from "./index";
import { CommandEnvelopeSchema } from "./index";

type AnyRecord = Record<string, unknown>;

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

const DEFAULT_PROFILE_ID = "018f3f5d-0000-7000-8000-000000000001";

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

export class FixtureCommandClient {
  app = {
    getSnapshot: async (): Promise<AppSnapshot> => ({
      profileId: DEFAULT_PROFILE_ID,
      portfolios: [corePortfolio],
      watchlists: [defaultWatchlist],
      runs: [btcNvdaRun],
      artifacts: [runCardArtifact],
      memoryActivity: [],
      wikiPages: [],
      remoteDevices: [],
    }),
  };

  portfolios = {
    list: async (): Promise<Portfolio[]> => [corePortfolio],
    create: async (input: { name: string }): Promise<Portfolio> => ({
      ...corePortfolio,
      name: input.name,
    }),
    getSnapshot: async (_input: { portfolioId: string }) => ({
      portfolio: corePortfolio,
    }),
    addPosition: async (input: AnyRecord) => ({
      id: "position-new",
      ...input,
    }),
    updatePosition: async (input: AnyRecord) => ({
      id: input.positionId ?? "position-btc",
      ...input,
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
    create: async (input: AnyRecord) => ({
      id: "watchlist-new",
      items: [],
      ...input,
    }),
    addItem: async (input: AnyRecord) => ({
      id: "watch-new",
      ...input,
    }),
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

  memory = {
    listActivity: async (_input: AnyRecord) => [],
    update: async (memoryId: string, patch: AnyRecord) => ({ memoryId, patch }),
    archive: async (_memoryId: string, _reason: string) => undefined,
    forget: async (_memoryId: string) => undefined,
    setCategoryEnabled: async (_category: string, _enabled: boolean) =>
      undefined,
  };

  wiki = {
    listPages: async (_input: AnyRecord) => [],
    getPage: async (pageId: string) => ({ pageId }),
    listActivity: async (_input: AnyRecord) => [],
    revertRevision: async (
      pageId: string,
      revisionId: string,
      reason: string,
    ) => ({ pageId, revisionId, reason }),
  };
}
