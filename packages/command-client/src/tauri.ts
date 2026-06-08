import {
  CommandEnvelopeSchema,
  type CommandBridge,
  type CommandEnvelope,
  type CommandName,
  type TauriInvoke,
} from "./schema";
import {
  normalizePositionInput,
  normalizeProviderPortfolioSyncInput,
  normalizeRemoteUnlock,
  normalizeTauriResult,
  normalizeTradingDecisionInput,
  normalizeTradingProvider,
  normalizeWatchlistItem,
} from "./tauri-normalization";
import type { AnyRecord } from "./types";

type TauriCommandMapping = {
  readonly command: string;
  readonly args: Record<string, unknown>;
};

const tauriCommandMap: Record<
  CommandName,
  (args: unknown[]) => TauriCommandMapping
> = {
  "app.getSnapshot": ([input]) => ({
    command: "get_app_snapshot",
    args: {
      profileId:
        input && typeof input === "object" && "profileId" in input
          ? String((input as AnyRecord).profileId)
          : undefined,
    },
  }),
  "portfolios.list": ([input]) => ({
    command: "list_portfolios",
    args: (input as Record<string, unknown> | undefined) ?? {},
  }),
  "portfolios.create": ([input]) => ({
    command: "create_portfolio",
    args: {
      input: {
        profile_id: (input as AnyRecord).profileId,
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
    args: { input: normalizePositionInput(input as AnyRecord) },
  }),
  "portfolios.syncFromProvider": ([input]) => ({
    command: "sync_portfolio_from_provider",
    args: {
      input: normalizeProviderPortfolioSyncInput(input as AnyRecord),
    },
  }),
  "portfolios.updatePosition": ([input]) => ({
    command: "update_portfolio_position",
    args: {
      input: {
        profile_id: (input as AnyRecord).profileId,
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
        profile_id: (input as AnyRecord).profileId,
        position_id: (input as AnyRecord).positionId,
        quantity: undefined,
        thesis: (input as AnyRecord).thesis,
      },
    },
  }),
  "watchlists.list": ([input]) => ({
    command: "list_watchlists",
    args: (input as Record<string, unknown> | undefined) ?? {},
  }),
  "watchlists.create": ([input]) => ({
    command: "create_watchlist",
    args: { input: { profile_id: (input as AnyRecord).profileId, name: (input as AnyRecord).name } },
  }),
  "watchlists.addItem": ([input]) => ({
    command: "add_watchlist_item",
    args: { input: normalizeWatchlistItem(input as AnyRecord) },
  }),
  "watchlists.updateItem": ([input]) => ({
    command: "update_watchlist_item",
    args: { input: normalizeWatchlistItem(input as AnyRecord) },
  }),
  "researchRuns.start": ([input]) => ({
    command: "start_research_run",
    args: {
      input: {
        profile_id: (input as AnyRecord).profileId,
        portfolio_id: (input as AnyRecord).portfolioId,
        user_request:
          (input as AnyRecord).userRequest ??
          (input as AnyRecord).thesis ??
          "Start Plutus research run.",
        selected_team: (input as AnyRecord).selectedTeam,
      },
    },
  }),
  "researchRuns.get": ([runId, input]) => ({
    command: "get_research_run",
    args: { runId, ...((input as Record<string, unknown> | undefined) ?? {}) },
  }),
  "researchRuns.cancel": ([runId, input]) => ({
    command: "cancel_research_run",
    args: { runId, ...((input as AnyRecord | undefined) ?? {}) },
  }),
  "artifacts.get": ([artifactId, input]) => ({
    command: "get_artifact",
    args: { artifactId, ...((input as Record<string, unknown> | undefined) ?? {}) },
  }),
  "artifacts.openLocalFile": ([artifactId, input]) => ({
    command: "open_local_artifact_file",
    args: { artifactId, ...((input as Record<string, unknown> | undefined) ?? {}) },
  }),
  "memory.listActivity": ([input]) => ({
    command: "list_memory_activity",
    args: input as Record<string, unknown>,
  }),
  "memory.update": ([memoryId, patch, input]) => ({
    command: "update_memory",
    args: { memoryId, patch, ...((input as AnyRecord | undefined) ?? {}) },
  }),
  "memory.archive": ([memoryId, reason, input]) => ({
    command: "archive_memory",
    args: { memoryId, reason, ...((input as AnyRecord | undefined) ?? {}) },
  }),
  "memory.forget": ([memoryId, input]) => ({
    command: "forget_memory",
    args: { memoryId, ...((input as AnyRecord | undefined) ?? {}) },
  }),
  "memory.setCategoryEnabled": ([category, enabled]) => ({
    command: "set_memory_category_enabled",
    args: { category, enabled },
  }),
  "wiki.listPages": ([input]) => ({
    command: "list_wiki_pages",
    args: input as Record<string, unknown>,
  }),
  "wiki.getPage": ([pageId, input]) => ({
    command: "get_wiki_page",
    args: { pageId, ...((input as Record<string, unknown> | undefined) ?? {}) },
  }),
  "wiki.listActivity": ([input]) => ({
    command: "list_wiki_activity",
    args: input as Record<string, unknown>,
  }),
  "wiki.revertRevision": ([pageId, revisionId, reason]) => ({
    command: "revert_wiki_revision",
    args: { pageId, revisionId, reason },
  }),
  "providers.list": ([input]) => ({
    command: "list_trading_providers",
    args: (input as Record<string, unknown> | undefined) ?? {},
  }),
  "providers.save": ([input]) => ({
    command: "save_trading_provider",
    args: { input: normalizeTradingProvider(input as AnyRecord) },
  }),
  "trading.previewDecision": ([input]) => ({
    command: "preview_trading_decision",
    args: { input: normalizeTradingDecisionInput(input as AnyRecord) },
  }),
  "trading.submitDryRunOrder": ([input]) => ({
    command: "submit_dry_run_order",
    args: { input: normalizeTradingDecisionInput(input as AnyRecord) },
  }),
  "remote.prepareUnlock": ([input]) => ({
    command: "prepare_remote_unlock",
    args: input as Record<string, unknown>,
  }),
  "remote.executeCommand": ([input]) => {
    const request = input as AnyRecord;
    return {
      command: "execute_remote_command",
      args: {
        request: {
          command_id: request.commandId,
          session_id: request.sessionId,
          session_key_ref: request.sessionKeyRef,
          unlock: request.unlock
            ? normalizeRemoteUnlock(request.unlock as AnyRecord)
            : undefined,
          command_type: request.commandType,
          payload: request.payload ?? {},
        },
      },
    };
  },
};

export function createTauriCommandBridge(invoke: TauriInvoke): CommandBridge {
  return async <T>(envelope: CommandEnvelope): Promise<T> => {
    const parsed = CommandEnvelopeSchema.parse(envelope);
    const mapped = tauriCommandMap[parsed.command](parsed.args);
    return normalizeTauriResult(
      await invoke<unknown>(mapped.command, mapped.args),
    ) as T;
  };
}
