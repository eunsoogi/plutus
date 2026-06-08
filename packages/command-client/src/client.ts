import { CommandEnvelopeSchema, type CommandBridge, type CommandName } from "./schema";
import type {
  AgentArtifact,
  AnyRecord,
  AppSnapshot,
  DryRunOrderResult,
  Portfolio,
  ProviderPortfolioSyncInput,
  ProviderPortfolioSyncResult,
  RemoteUnlockPrepared,
  ResearchRun,
  TradingDecision,
  TradingOrderIntent,
  TradingProviderConfig,
  Watchlist,
} from "./types";

function invoke<T>(
  bridge: CommandBridge,
  command: CommandName,
  args: unknown[],
) {
  return bridge<T>(CommandEnvelopeSchema.parse({ command, args }));
}

function remoteCommandInput(input: AnyRecord): AnyRecord {
  const commandId =
    typeof input.commandId === "string" && input.commandId.length > 0
      ? input.commandId
      : `cmd-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    ...input,
    commandId,
  };
}

function assertRemoteCommandAllowed(result: AnyRecord) {
  const authorization = result.authorization;
  const authorizationRecord =
    authorization && typeof authorization === "object"
      ? (authorization as AnyRecord)
      : undefined;
  if (!authorizationRecord) {
    throw new Error("Remote command denied: malformed_authorization");
  }
  const permissionGranted =
    authorizationRecord && "permissionGranted" in authorizationRecord
      ? authorizationRecord.permissionGranted
      : authorizationRecord && "permission_granted" in authorizationRecord
        ? authorizationRecord.permission_granted
        : undefined;
  const success =
    authorizationRecord && "success" in authorizationRecord
      ? authorizationRecord.success
      : undefined;
  if (permissionGranted !== true || success !== true) {
    const warnings =
      authorizationRecord && Array.isArray(authorizationRecord.warnings)
        ? authorizationRecord.warnings
        : result.warnings;
    const reason = Array.isArray(warnings) ? warnings.join(", ") : "denied";
    throw new Error(`Remote command denied: ${reason}`);
  }
}

export function createCommandClient(bridge: CommandBridge) {
  return {
    app: {
      getSnapshot: (input?: { profileId?: string }) =>
        invoke<AppSnapshot>(bridge, "app.getSnapshot", input ? [input] : []),
    },
    portfolios: {
      list: (input?: { profileId?: string }) =>
        invoke<Portfolio[]>(bridge, "portfolios.list", input ? [input] : []),
      create: (input: {
        profileId?: string;
        name: string;
        baseCurrency: string;
      }) => invoke<Portfolio>(bridge, "portfolios.create", [input]),
      getSnapshot: (input: AnyRecord) =>
        invoke<AnyRecord>(bridge, "portfolios.getSnapshot", [input]),
      addPosition: (input: AnyRecord) =>
        invoke<AnyRecord>(bridge, "portfolios.addPosition", [input]),
      syncFromProvider: (input: ProviderPortfolioSyncInput) =>
        invoke<ProviderPortfolioSyncResult>(
          bridge,
          "portfolios.syncFromProvider",
          [input],
        ),
      updatePosition: (input: AnyRecord) =>
        invoke<AnyRecord>(bridge, "portfolios.updatePosition", [input]),
      updatePositionThesis: (input: AnyRecord) =>
        invoke<AnyRecord>(bridge, "portfolios.updatePositionThesis", [input]),
    },
    watchlists: {
      list: (input?: { profileId?: string }) =>
        invoke<Watchlist[]>(bridge, "watchlists.list", input ? [input] : []),
      create: (input: AnyRecord) =>
        invoke<AnyRecord>(bridge, "watchlists.create", [input]),
      addItem: (input: AnyRecord) =>
        invoke<AnyRecord>(bridge, "watchlists.addItem", [input]),
      updateItem: (input: AnyRecord) =>
        invoke<AnyRecord>(bridge, "watchlists.updateItem", [input]),
    },
    researchRuns: {
      start: (input: {
        profileId?: string;
        portfolioId?: string;
        symbols?: string[];
        thesis?: string;
        userRequest?: string;
      }) => invoke<ResearchRun>(bridge, "researchRuns.start", [input]),
      get: (runId: string, input?: { profileId?: string }) =>
        invoke<AnyRecord>(
          bridge,
          "researchRuns.get",
          input ? [runId, input] : [runId],
        ),
      cancel: (runId: string, input?: { profileId?: string }) =>
        invoke<void>(
          bridge,
          "researchRuns.cancel",
          input ? [runId, input] : [runId],
        ),
    },
    artifacts: {
      get: (
        artifactId: string,
        input?: { profileId?: string; runId?: string },
      ) =>
        invoke<AgentArtifact>(
          bridge,
          "artifacts.get",
          input ? [artifactId, input] : [artifactId],
        ),
      openLocalFile: async (
        artifactId: string,
        input?: { profileId?: string; runId?: string },
      ) => {
        await invoke<unknown>(
          bridge,
          "artifacts.openLocalFile",
          input ? [artifactId, input] : [artifactId],
        );
      },
    },
    memory: {
      listActivity: (input: AnyRecord) =>
        invoke<AnyRecord[]>(bridge, "memory.listActivity", [input]),
      update: (
        memoryId: string,
        patch: AnyRecord,
        input?: { profileId?: string },
      ) =>
        invoke<AnyRecord>(
          bridge,
          "memory.update",
          input ? [memoryId, patch, input] : [memoryId, patch],
        ),
      archive: (
        memoryId: string,
        reason: string,
        input?: { profileId?: string },
      ) =>
        invoke<void>(
          bridge,
          "memory.archive",
          input ? [memoryId, reason, input] : [memoryId, reason],
        ),
      forget: (memoryId: string, input?: { profileId?: string }) =>
        invoke<void>(
          bridge,
          "memory.forget",
          input ? [memoryId, input] : [memoryId],
        ),
      setCategoryEnabled: (category: string, enabled: boolean) =>
        invoke<void>(bridge, "memory.setCategoryEnabled", [category, enabled]),
    },
    wiki: {
      listPages: (input: AnyRecord) =>
        invoke<AnyRecord[]>(bridge, "wiki.listPages", [input]),
      getPage: (pageId: string, input?: { profileId?: string }) =>
        invoke<AnyRecord>(
          bridge,
          "wiki.getPage",
          input ? [pageId, input] : [pageId],
        ),
      listActivity: (input: AnyRecord) =>
        invoke<AnyRecord[]>(bridge, "wiki.listActivity", [input]),
      revertRevision: (pageId: string, revisionId: string, reason: string) =>
        invoke<AnyRecord>(bridge, "wiki.revertRevision", [
          pageId,
          revisionId,
          reason,
        ]),
    },
    providers: {
      list: (input?: { profileId?: string }) =>
        invoke<TradingProviderConfig[]>(
          bridge,
          "providers.list",
          input ? [input] : [],
        ),
      save: (input: TradingProviderConfig) =>
        invoke<TradingProviderConfig>(bridge, "providers.save", [input]),
    },
    trading: {
      previewDecision: (input: {
        provider: TradingProviderConfig;
        intent: TradingOrderIntent;
      }) => invoke<TradingDecision>(bridge, "trading.previewDecision", [input]),
      submitDryRunOrder: (input: {
        provider: TradingProviderConfig;
        intent: TradingOrderIntent;
        decision?: TradingDecision;
      }) =>
        invoke<DryRunOrderResult>(bridge, "trading.submitDryRunOrder", [input]),
    },
    remote: {
      prepareUnlock: (input: AnyRecord) =>
        invoke<RemoteUnlockPrepared>(bridge, "remote.prepareUnlock", [input]),
      executeCommand: async (input: AnyRecord) => {
        const result = await invoke<AnyRecord>(
          bridge,
          "remote.executeCommand",
          [remoteCommandInput(input)],
        );
        assertRemoteCommandAllowed(result);
        return result;
      },
    },
  };
}
