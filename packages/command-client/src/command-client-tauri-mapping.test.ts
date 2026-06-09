import { describe, expect, it } from "vitest";
import { createCommandClient, createTauriCommandBridge } from "./index";

describe("command client Tauri mapping", () => {
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
    await client.portfolios.syncFromProvider({
      profileId: "profile-custom",
      providerId: "upbit",
      portfolioName: "Upbit Synced Holdings",
      baseCurrency: "KRW",
      holdings: [
        {
          symbol: "btc-krw",
          name: "Bitcoin",
          quantity: 0.5,
          averageCost: 90000000,
          costCurrency: "KRW",
          thesis: "Provider import",
        },
      ],
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
        command: "sync_portfolio_from_provider",
        args: {
          input: {
            profile_id: "profile-custom",
            portfolio_id: undefined,
            provider_id: "upbit",
            portfolio_name: "Upbit Synced Holdings",
            base_currency: "KRW",
            holdings: [
              {
                symbol: "btc-krw",
                name: "Bitcoin",
                quantity: 0.5,
                average_cost: 90000000,
                cost_currency: "KRW",
                thesis: "Provider import",
              },
            ],
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
});
