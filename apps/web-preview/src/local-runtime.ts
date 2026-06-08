import type {
  AgentArtifact,
  AppSnapshot,
  CommandBridge,
  CommandEnvelope,
  Portfolio,
  ResearchRun,
  Watchlist,
} from "@plutus/command-client";

import {
  addPortfolioPosition,
  createPortfolio,
  syncPortfolioFromProvider,
  type LocalAddPositionInput,
  type LocalCreatePortfolioInput,
} from "./local-portfolio-runtime";
import {
  emptyTradingState,
  normalizeTradingState,
  previewTradingDecision,
  saveTradingProvider,
  submitDryRunOrder,
  type LocalTradingState,
} from "./local-trading-runtime";

type LocalState = Omit<
  AppSnapshot,
  "tradingProviders" | "tradingDecisions" | "dryRunOrders"
> &
  LocalTradingState;

const STORAGE_KEY = "plutus.localRuntime.v1";
const PROFILE_ID = "local-browser-profile";

function emptyState(): LocalState {
  return {
    profileId: PROFILE_ID,
    portfolios: [],
    watchlists: [],
    runs: [],
    artifacts: [],
    memoryActivity: [],
    wikiPages: [],
    remoteDevices: [],
    ...emptyTradingState(new Date().toISOString()),
  };
}

function readState(): LocalState {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return emptyState();
  try {
    const parsed = JSON.parse(raw) as Partial<LocalState>;
    return {
      profileId:
        typeof parsed.profileId === "string" ? parsed.profileId : PROFILE_ID,
      portfolios: arrayOrEmpty<Portfolio>(parsed.portfolios),
      watchlists: arrayOrEmpty<Watchlist>(parsed.watchlists),
      runs: arrayOrEmpty<ResearchRun & { title?: string; category?: string }>(
        parsed.runs,
      ),
      artifacts: arrayOrEmpty<AgentArtifact>(parsed.artifacts),
      memoryActivity: arrayOrEmpty<Record<string, unknown>>(
        parsed.memoryActivity,
      ),
      wikiPages: arrayOrEmpty<Record<string, unknown>>(parsed.wikiPages),
      remoteDevices: arrayOrEmpty<Record<string, unknown>>(
        parsed.remoteDevices,
      ),
      ...normalizeTradingState(parsed, new Date().toISOString()),
    };
  } catch {
    return emptyState();
  }
}

function writeState(state: LocalState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function arrayOrEmpty<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function newId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function createLocalWebCommandBridge(): CommandBridge {
  return async <T>(envelope: CommandEnvelope): Promise<T> => {
    const state = readState();
    switch (envelope.command) {
      case "app.getSnapshot":
        return state as T;
      case "providers.list":
        return state.tradingProviders as T;
      case "providers.save": {
        const [input] = envelope.args;
        const provider = saveTradingProvider(state, input);
        writeState(state);
        return provider as T;
      }
      case "trading.previewDecision": {
        const [input] = envelope.args;
        const decision = previewTradingDecision(
          state,
          input,
          new Date().toISOString(),
        );
        writeState(state);
        return decision as T;
      }
      case "trading.submitDryRunOrder": {
        const [input] = envelope.args;
        const order = submitDryRunOrder(state, input, new Date().toISOString());
        writeState(state);
        return order as T;
      }
      case "portfolios.list":
        return state.portfolios as T;
      case "portfolios.create": {
        const [input] = envelope.args as [LocalCreatePortfolioInput];
        const portfolio = createPortfolio(state, input);
        writeState(state);
        return portfolio as T;
      }
      case "portfolios.addPosition": {
        const [input] = envelope.args as [LocalAddPositionInput];
        const position = addPortfolioPosition(state, input);
        writeState(state);
        return position as T;
      }
      case "portfolios.syncFromProvider": {
        const [input] = envelope.args;
        const result = syncPortfolioFromProvider(state, input);
        writeState(state);
        return result as T;
      }
      case "watchlists.list":
        return state.watchlists as T;
      case "watchlists.create": {
        const [input] = envelope.args as [{ name?: string }];
        const watchlist = {
          id: newId("watchlist"),
          name: input.name ?? "Untitled Watchlist",
          items: [],
        };
        state.watchlists.push(watchlist);
        writeState(state);
        return watchlist as T;
      }
      case "researchRuns.start": {
        const [input] = envelope.args as [
          { portfolioId?: string; userRequest?: string; selectedTeam?: string },
        ];
        if (
          !input.portfolioId ||
          !state.portfolios.some(
            (portfolio) => portfolio.id === input.portfolioId,
          )
        ) {
          throw new Error("Create a portfolio before starting a research run.");
        }
        const run = {
          id: newId("run"),
          portfolioId: input.portfolioId ?? "",
          status: "queued",
          title: input.userRequest ?? "Research run",
          selectedTeam: input.selectedTeam,
          category: "",
        };
        state.runs.unshift(run);
        writeState(state);
        return run as T;
      }
      case "researchRuns.get": {
        const [runId] = envelope.args as [string];
        const run = state.runs.find((candidate) => candidate.id === runId);
        if (!run) throw new Error("Research run not found");
        return run as T;
      }
      case "researchRuns.cancel": {
        const [runId] = envelope.args as [string];
        const run = state.runs.find((candidate) => candidate.id === runId);
        if (run) run.status = "cancelled";
        writeState(state);
        return undefined as T;
      }
      case "artifacts.get": {
        const [artifactId] = envelope.args as [string];
        const artifact = state.artifacts.find(
          (candidate) => candidate.id === artifactId,
        );
        if (!artifact) throw new Error("Artifact not found");
        return artifact as T;
      }
      case "memory.listActivity":
        return state.memoryActivity as T;
      case "wiki.listPages":
        return state.wikiPages as T;
      case "wiki.listActivity":
        return [] as T;
      case "artifacts.openLocalFile":
      case "memory.update":
      case "memory.archive":
      case "memory.forget":
      case "memory.setCategoryEnabled":
      case "wiki.getPage":
      case "wiki.revertRevision":
      case "portfolios.getSnapshot":
      case "portfolios.updatePosition":
      case "portfolios.updatePositionThesis":
      case "remote.prepareUnlock":
      case "remote.executeCommand":
      case "watchlists.addItem":
      case "watchlists.updateItem":
        throw new Error(
          `${envelope.command} is not available in local browser runtime yet`,
        );
      default:
        throw new Error(`Unsupported command ${envelope.command}`);
    }
  };
}
