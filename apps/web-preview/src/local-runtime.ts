import type { CommandBridge, CommandEnvelope } from "@plutus/command-client";

type LocalState = {
  profileId: string;
  portfolios: any[];
  watchlists: any[];
  runs: any[];
  artifacts: any[];
  memoryActivity: any[];
  wikiPages: any[];
  remoteDevices: any[];
};

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
      portfolios: Array.isArray(parsed.portfolios) ? parsed.portfolios : [],
      watchlists: Array.isArray(parsed.watchlists) ? parsed.watchlists : [],
      runs: Array.isArray(parsed.runs) ? parsed.runs : [],
      artifacts: Array.isArray(parsed.artifacts) ? parsed.artifacts : [],
      memoryActivity: Array.isArray(parsed.memoryActivity)
        ? parsed.memoryActivity
        : [],
      wikiPages: Array.isArray(parsed.wikiPages) ? parsed.wikiPages : [],
      remoteDevices: Array.isArray(parsed.remoteDevices)
        ? parsed.remoteDevices
        : [],
    };
  } catch {
    return emptyState();
  }
}

function writeState(state: LocalState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
      case "portfolios.list":
        return state.portfolios as T;
      case "portfolios.create": {
        const [input] = envelope.args as [
          { name?: string; baseCurrency?: string },
        ];
        const portfolio = {
          id: newId("portfolio"),
          name: input.name ?? "Untitled Portfolio",
          baseCurrency: input.baseCurrency ?? "USD",
          positions: [],
        };
        state.portfolios.push(portfolio);
        writeState(state);
        return portfolio as T;
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
      case "portfolios.addPosition":
      case "portfolios.updatePosition":
      case "portfolios.updatePositionThesis":
        throw new Error(
          `${envelope.command} is not available in local browser runtime yet`,
        );
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
