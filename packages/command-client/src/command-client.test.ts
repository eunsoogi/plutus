import { describe, expect, it } from "vitest";
import {
  CommandEnvelopeSchema,
  createCommandClient,
  createTauriCommandBridge,
  redactCommandLog,
} from "./index";
import { createMockCommandBridge } from "./fixture-client.test-support";

describe("command client", () => {
  it("calls typed local commands through a validated envelope", async () => {
    const bridge = createMockCommandBridge({
      "portfolios.create": async (input) => ({
        id: "portfolio-core",
        name: input.name,
        baseCurrency: input.baseCurrency,
      }),
      "researchRuns.start": async (input) => ({
        id: "run-btc-nvda",
        status: "running",
        portfolioId: input.portfolioId,
        thesis: input.thesis,
      }),
      "artifacts.openLocalFile": async (artifactId) => ({
        opened: true,
        artifactId,
      }),
    });
    const client = createCommandClient(bridge);

    await expect(
      client.portfolios.create({ name: "Core", baseCurrency: "USD" }),
    ).resolves.toMatchObject({ id: "portfolio-core", name: "Core" });
    await expect(
      client.researchRuns.start({
        portfolioId: "portfolio-core",
        symbols: ["BTC", "NVDA"],
        thesis: "Review concentrated BTC/NVDA risk",
      }),
    ).resolves.toMatchObject({ id: "run-btc-nvda", status: "running" });
    await expect(
      client.artifacts.openLocalFile("artifact-1"),
    ).resolves.toBeUndefined();

    expect(bridge.calls.map((call) => call.command)).toEqual([
      "portfolios.create",
      "researchRuns.start",
      "artifacts.openLocalFile",
    ]);
  });

  it("covers the full production command surface declared for Tauri", async () => {
    const bridge = createMockCommandBridge({
      "portfolios.list": async () => [],
      "portfolios.create": async (input) => input,
      "portfolios.getSnapshot": async (input) => input,
      "portfolios.addPosition": async (input) => input,
      "portfolios.updatePosition": async (input) => input,
      "portfolios.updatePositionThesis": async (input) => input,
      "watchlists.list": async () => [],
      "watchlists.create": async (input) => input,
      "watchlists.addItem": async (input) => input,
      "watchlists.updateItem": async (input) => input,
      "researchRuns.start": async (input) => input,
      "researchRuns.get": async (runId) => ({ runId }),
      "researchRuns.cancel": async () => undefined,
      "artifacts.get": async (artifactId) => ({ artifactId }),
      "artifacts.openLocalFile": async () => undefined,
      "memory.listActivity": async () => [],
      "memory.update": async (memoryId, patch) => ({ memoryId, patch }),
      "memory.archive": async () => undefined,
      "memory.forget": async () => undefined,
      "memory.setCategoryEnabled": async () => undefined,
      "wiki.listPages": async () => [],
      "wiki.getPage": async (pageId) => ({ pageId }),
      "wiki.listActivity": async () => [],
      "wiki.revertRevision": async (pageId, revisionId, reason) => ({
        pageId,
        revisionId,
        reason,
      }),
      "remote.executeCommand": async (input) => ({
        authorization: { success: true, permissionGranted: true, warnings: [] },
        data: input,
      }),
      "app.getSnapshot": async () => ({ portfolios: [] }),
    });
    const client = createCommandClient(bridge);

    await client.portfolios.list();
    await client.portfolios.create({ name: "Core", baseCurrency: "USD" });
    await client.portfolios.getSnapshot({ portfolioId: "portfolio-core" });
    await client.portfolios.addPosition({ portfolioId: "portfolio-core" });
    await client.portfolios.updatePosition({ positionId: "position-btc" });
    await client.portfolios.updatePositionThesis({
      positionId: "position-btc",
      thesis: "Updated",
    });
    await client.watchlists.list();
    await client.watchlists.create({ name: "Watch" });
    await client.watchlists.addItem({ symbol: "BTC" });
    await client.watchlists.updateItem({ itemId: "watch-btc" });
    await client.researchRuns.start({ userRequest: "Review" });
    await client.researchRuns.get("run-1");
    await client.researchRuns.cancel("run-1");
    await client.artifacts.get("artifact-1");
    await client.artifacts.openLocalFile("artifact-1");
    await client.memory.listActivity({});
    await client.memory.update("memory-1", { summary: "Updated" });
    await client.memory.archive("memory-1", "stale");
    await client.memory.forget("memory-1");
    await client.memory.setCategoryEnabled("preference", false);
    await client.wiki.listPages({});
    await client.wiki.getPage("wiki-1");
    await client.wiki.listActivity({});
    await client.wiki.revertRevision("wiki-1", "revision-1", "restore");
    await client.remote.executeCommand({
      commandId: "cmd-remote",
      commandType: "run.start",
      sessionId: "session-1",
      sessionKeyRef: "secure://session-1",
      unlock: {
        method: "biometric",
        sessionKeyRef: "secure://session-1",
        challenge: "sha256:test",
      },
    });
    await client.app.getSnapshot({ profileId: "profile-custom" });

    expect(bridge.calls.map((call) => call.command)).toEqual([
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
      "remote.executeCommand",
      "app.getSnapshot",
    ]);
  });

  it("rejects malformed command envelopes and redacts secret-like fields from logs", () => {
    expect(() =>
      CommandEnvelopeSchema.parse({
        command: "providers.setApiKey",
        args: [{ apiKey: "raw-secret" }],
      }),
    ).toThrow();

    expect(
      redactCommandLog({
        command: "providers.save",
        args: [
          { apiKey: "sk-live", authorization: "Bearer token", note: "keep" },
        ],
      }),
    ).toEqual({
      command: "providers.save",
      args: [
        { apiKey: "[REDACTED]", authorization: "[REDACTED]", note: "keep" },
      ],
    });
  });

  it("maps validated envelopes to registered Tauri command names", async () => {
    const calls: Array<{ command: string; args?: Record<string, unknown> }> =
      [];
    const bridge = createTauriCommandBridge(
      async <T>(command: string, args?: Record<string, unknown>) => {
        calls.push({ command, args });
        return { ok: true } as T;
      },
    );
    const client = createCommandClient(bridge);

    await client.researchRuns.start({
      profileId: "profile-custom",
      userRequest: "Review risk.",
    });
    await client.portfolios.addPosition({
      profileId: "profile-custom",
      portfolioId: "portfolio-1",
      symbol: "BTC",
      quantity: 1,
      averageCost: 100,
    });
    await client.portfolios.updatePosition({
      profileId: "profile-custom",
      positionId: "position-1",
      quantity: 2,
    });
    await client.researchRuns.get("run-1", { profileId: "profile-custom" });
    await client.artifacts.openLocalFile("artifact-1", {
      profileId: "profile-custom",
      runId: "run-custom",
    });
    await client.memory.archive("memory-1", "stale", {
      profileId: "profile-custom",
    });
    await client.wiki.getPage("wiki-1", { profileId: "profile-custom" });
    await client.wiki.revertRevision("wiki-1", "rev-1", "restore");
    await client.app.getSnapshot({ profileId: "profile-custom" });
    await client.watchlists.addItem({
      profileId: "profile-custom",
      watchlistId: "watchlist-1",
      symbol: "BTC",
    });
    await client.watchlists.updateItem({
      profileId: "profile-custom",
      itemId: "watch-item-1",
      triggerNote: "Watch",
    });

    expect(calls).toEqual([
      {
        command: "start_research_run",
        args: {
          input: {
            profile_id: "profile-custom",
            portfolio_id: undefined,
            user_request: "Review risk.",
            selected_team: undefined,
          },
        },
      },
      {
        command: "add_portfolio_position",
        args: {
          input: {
            profile_id: "profile-custom",
            portfolio_id: "portfolio-1",
            account_id: undefined,
            symbol: "BTC",
            quantity: 1,
            average_cost: 100,
            cost_currency: undefined,
            thesis: undefined,
          },
        },
      },
      {
        command: "update_portfolio_position",
        args: {
          input: {
            profile_id: "profile-custom",
            position_id: "position-1",
            quantity: 2,
            thesis: undefined,
          },
        },
      },
      {
        command: "get_research_run",
        args: { runId: "run-1", profileId: "profile-custom" },
      },
      {
        command: "open_local_artifact_file",
        args: {
          artifactId: "artifact-1",
          profileId: "profile-custom",
          runId: "run-custom",
        },
      },
      {
        command: "archive_memory",
        args: {
          memoryId: "memory-1",
          reason: "stale",
          profileId: "profile-custom",
        },
      },
      {
        command: "get_wiki_page",
        args: { pageId: "wiki-1", profileId: "profile-custom" },
      },
      {
        command: "revert_wiki_revision",
        args: { pageId: "wiki-1", revisionId: "rev-1", reason: "restore" },
      },
      {
        command: "get_app_snapshot",
        args: { profileId: "profile-custom" },
      },
      {
        command: "add_watchlist_item",
        args: {
          input: {
            profile_id: "profile-custom",
            watchlist_id: "watchlist-1",
            symbol: "BTC",
            trigger_note: undefined,
            target_zone: undefined,
          },
        },
      },
      {
        command: "update_watchlist_item",
        args: {
          input: {
            profile_id: "profile-custom",
            item_id: "watch-item-1",
            trigger_note: "Watch",
            target_zone: undefined,
          },
        },
      },
    ]);
  });

  it("maps remote commands to the Rust DTO and rejects denied authorization", async () => {
    const calls: Array<{ command: string; args?: Record<string, unknown> }> =
      [];
    const bridge = createTauriCommandBridge(
      async <T>(command: string, args?: Record<string, unknown>) => {
        calls.push({ command, args });
        return {
          authorization: {
            success: true,
            permission_granted: true,
            warnings: [],
          },
          data: { ok: true },
        } as T;
      },
    );
    const client = createCommandClient(bridge);

    await expect(
      client.remote.executeCommand({
        commandId: "cmd-remote",
        commandType: "run.start",
        sessionId: "session-1",
        sessionKeyRef: "secure://session-1",
        unlock: {
          method: "biometric",
          sessionKeyRef: "secure://session-1",
          challenge: "sha256:test",
        },
        payload: { portfolioId: "portfolio-1" },
      }),
    ).resolves.toMatchObject({ data: { ok: true } });

    expect(calls[0]).toEqual({
      command: "execute_remote_command",
      args: {
        request: {
          command_id: "cmd-remote",
          session_id: "session-1",
          session_key_ref: "secure://session-1",
          unlock: {
            method: "biometric",
            session_key_ref: "secure://session-1",
            challenge: "sha256:test",
          },
          command_type: "run.start",
          payload: { portfolioId: "portfolio-1" },
        },
      },
    });

    const deniedBridge = createCommandClient(
      createTauriCommandBridge(async <T>() => {
        return {
          authorization: {
            success: false,
            permission_granted: false,
            warnings: ["unlock_required"],
          },
          data: null,
        } as T;
      }),
    );
    await expect(
      deniedBridge.remote.executeCommand({
        commandType: "run.start",
        sessionId: "session-1",
      }),
    ).rejects.toThrow("Remote command denied: unlock_required");

    const malformedBridge = createCommandClient(
      createTauriCommandBridge(async <T>() => ({ ok: true }) as T),
    );
    await expect(
      malformedBridge.remote.executeCommand({
        commandType: "run.start",
        sessionId: "session-1",
      }),
    ).rejects.toThrow("Remote command denied: malformed_authorization");

    const topLevelOnlyBridge = createCommandClient(
      createTauriCommandBridge(async <T>() => {
        return { success: true, permissionGranted: true, data: {} } as T;
      }),
    );
    await expect(
      topLevelOnlyBridge.remote.executeCommand({
        commandType: "run.start",
        sessionId: "session-1",
      }),
    ).rejects.toThrow("Remote command denied: malformed_authorization");
  });

  it("normalizes Tauri snake_case responses to the command-client camelCase contract", async () => {
    const bridge = createTauriCommandBridge(async <T>() => {
      return {
        id: "portfolio-1",
        base_currency: "USD",
        nested_rows: [{ research_run_id: "run-1" }],
      } as T;
    });

    const result = await bridge({
      command: "portfolios.list",
      args: [],
    });

    expect(result).toEqual({
      id: "portfolio-1",
      baseCurrency: "USD",
      nestedRows: [{ researchRunId: "run-1" }],
    });
  });
});
