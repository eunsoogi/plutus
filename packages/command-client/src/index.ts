import { z } from "zod";

export const AllowedCommandSchema = z.enum([
  "app.getSnapshot",
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
  "remote.prepareUnlock",
  "remote.executeCommand",
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
  positions?: Array<{
    id: string;
    symbol: string;
    name?: string;
    thesis: string;
    quantity?: number;
    averageCost?: number;
  }>;
}

export interface Watchlist {
  id: string;
  name: string;
  items: Array<{ id: string; symbol: string; triggerNote: string }>;
}

export interface ResearchRun {
  id: string;
  status: string;
  portfolioId: string | null;
  selectedTeam?: string;
  thesis?: string;
  confidence?: string;
  finalCard?: Record<string, unknown>;
}

export interface AgentArtifact {
  id: string;
  title: string;
  type: string;
  researchRunId?: string | null;
}

export interface RemoteUnlockPrepared {
  sessionId: string;
  sessionKeyRef: string;
  unlockProof: {
    method: string;
    sessionKeyRef: string;
    challenge?: string;
  };
}

export interface AppSnapshot {
  profileId: string;
  portfolios: Portfolio[];
  watchlists: Watchlist[];
  runs: Array<ResearchRun & { title?: string; category?: string }>;
  artifacts: AgentArtifact[];
  memoryActivity: AnyRecord[];
  wikiPages: AnyRecord[];
  remoteDevices: AnyRecord[];
}

type AnyRecord = Record<string, unknown>;

function invoke<T>(
  bridge: CommandBridge,
  command: z.infer<typeof AllowedCommandSchema>,
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

const tauriCommandMap: Record<
  z.infer<typeof AllowedCommandSchema>,
  (args: unknown[]) => { command: string; args: Record<string, unknown> }
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
    args: {
      input: {
        profile_id: (input as AnyRecord).profileId,
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
    args: {
      input: {
        profile_id: (input as AnyRecord).profileId,
        name: (input as AnyRecord).name,
      },
    },
  }),
  "watchlists.addItem": ([input]) => ({
    command: "add_watchlist_item",
    args: {
      input: {
        profile_id: (input as AnyRecord).profileId,
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
        profile_id: (input as AnyRecord).profileId,
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
    args: {
      artifactId,
      ...((input as Record<string, unknown> | undefined) ?? {}),
    },
  }),
  "artifacts.openLocalFile": ([artifactId, input]) => ({
    command: "open_local_artifact_file",
    args: {
      artifactId,
      ...((input as Record<string, unknown> | undefined) ?? {}),
    },
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

function normalizeRemoteUnlock(unlock: AnyRecord) {
  return {
    method: unlock.method,
    session_key_ref: unlock.sessionKeyRef,
    challenge:
      typeof unlock.challenge === "string" ? unlock.challenge : undefined,
  };
}

export function createTauriCommandBridge(invoke: TauriInvoke): CommandBridge {
  return async <T>(envelope: CommandEnvelope): Promise<T> => {
    const parsed = CommandEnvelopeSchema.parse(envelope);
    const mapped = tauriCommandMap[parsed.command](parsed.args);
    return normalizeTauriResult(
      await invoke<unknown>(mapped.command, mapped.args),
    ) as T;
  };
}

function normalizeTauriResult(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeTauriResult);
  if (!value || typeof value !== "object") return value;
  const normalized: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    normalized[snakeToCamel(key)] = normalizeTauriResult(nested);
  }
  return normalized;
}

function snakeToCamel(key: string): string {
  return key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
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
