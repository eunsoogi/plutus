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
export type TauriInvoke = <T = unknown>(
  command: string,
  args?: Record<string, unknown>,
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

const tauriCommandMap: Record<
  z.infer<typeof AllowedCommandSchema>,
  (args: unknown[]) => { command: string; args: Record<string, unknown> }
> = {
  "portfolios.list": () => ({ command: "list_portfolios", args: {} }),
  "portfolios.create": ([input]) => ({
    command: "create_portfolio",
    args: {
      input: {
        profile_id: DEFAULT_PROFILE_ID,
        name: (input as AnyRecord).name,
        base_currency: (input as AnyRecord).baseCurrency ?? "USD",
      },
    },
  }),
  "portfolios.getSnapshot": ([input]) => ({
    command: "get_portfolio_snapshot",
    args: input as Record<string, unknown>,
  }),
  "portfolios.addPosition": ([input]) => ({
    command: "add_portfolio_position",
    args: {
      input: {
        portfolio_id: (input as AnyRecord).portfolioId,
        account_id: (input as AnyRecord).accountId,
        symbol: (input as AnyRecord).symbol,
        quantity: (input as AnyRecord).quantity,
        average_cost: (input as AnyRecord).averageCost,
        cost_currency: (input as AnyRecord).costCurrency,
        thesis: (input as AnyRecord).thesis,
      },
    },
  }),
  "portfolios.updatePosition": ([input]) => ({
    command: "update_portfolio_position",
    args: {
      input: {
        position_id: (input as AnyRecord).positionId,
        quantity: (input as AnyRecord).quantity,
        thesis: (input as AnyRecord).thesis,
      },
    },
  }),
  "portfolios.updatePositionThesis": ([input]) => ({
    command: "update_portfolio_position",
    args: {
      input: {
        position_id: (input as AnyRecord).positionId,
        quantity: undefined,
        thesis: (input as AnyRecord).thesis,
      },
    },
  }),
  "watchlists.list": () => ({ command: "list_watchlists", args: {} }),
  "watchlists.create": ([input]) => ({
    command: "create_watchlist",
    args: {
      input: {
        profile_id: (input as AnyRecord).profileId ?? DEFAULT_PROFILE_ID,
        name: (input as AnyRecord).name,
      },
    },
  }),
  "watchlists.addItem": ([input]) => ({
    command: "add_watchlist_item",
    args: {
      input: {
        watchlist_id: (input as AnyRecord).watchlistId,
        symbol: (input as AnyRecord).symbol,
        trigger_note: (input as AnyRecord).triggerNote,
        target_zone: (input as AnyRecord).targetZone,
      },
    },
  }),
  "watchlists.updateItem": ([input]) => ({
    command: "update_watchlist_item",
    args: {
      input: {
        item_id: (input as AnyRecord).itemId,
        trigger_note: (input as AnyRecord).triggerNote,
        target_zone: (input as AnyRecord).targetZone,
      },
    },
  }),
  "researchRuns.start": ([input]) => ({
    command: "start_research_run",
    args: {
      input: {
        profile_id: (input as AnyRecord).profileId ?? DEFAULT_PROFILE_ID,
        portfolio_id: (input as AnyRecord).portfolioId,
        user_request:
          (input as AnyRecord).userRequest ??
          (input as AnyRecord).thesis ??
          "Start Plutus research run.",
        selected_team: (input as AnyRecord).selectedTeam,
      },
    },
  }),
  "researchRuns.get": ([runId]) => ({
    command: "get_research_run",
    args: { runId },
  }),
  "researchRuns.cancel": ([runId]) => ({
    command: "cancel_research_run",
    args: { runId },
  }),
  "artifacts.get": ([artifactId]) => ({
    command: "get_artifact",
    args: { artifactId },
  }),
  "artifacts.openLocalFile": ([artifactId]) => ({
    command: "open_local_artifact_file",
    args: { artifactId },
  }),
  "memory.listActivity": ([input]) => ({
    command: "list_memory_activity",
    args: input as Record<string, unknown>,
  }),
  "memory.update": ([memoryId, patch]) => ({
    command: "update_memory",
    args: { memoryId, patch },
  }),
  "memory.archive": ([memoryId, reason]) => ({
    command: "archive_memory",
    args: { memoryId, reason },
  }),
  "memory.forget": ([memoryId]) => ({
    command: "forget_memory",
    args: { memoryId },
  }),
  "memory.setCategoryEnabled": ([category, enabled]) => ({
    command: "set_memory_category_enabled",
    args: { category, enabled },
  }),
  "wiki.listPages": ([input]) => ({
    command: "list_wiki_pages",
    args: input as Record<string, unknown>,
  }),
  "wiki.getPage": ([pageId]) => ({
    command: "get_wiki_page",
    args: { pageId },
  }),
  "wiki.listActivity": ([input]) => ({
    command: "list_wiki_activity",
    args: input as Record<string, unknown>,
  }),
  "wiki.revertRevision": ([pageId, revisionId, reason]) => ({
    command: "revert_wiki_revision",
    args: { pageId, revisionId, reason },
  }),
};

export function createTauriCommandBridge(invoke: TauriInvoke): CommandBridge {
  return async <T>(envelope: CommandEnvelope): Promise<T> => {
    const parsed = CommandEnvelopeSchema.parse(envelope);
    const mapped = tauriCommandMap[parsed.command](parsed.args);
    return invoke<T>(mapped.command, mapped.args);
  };
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
