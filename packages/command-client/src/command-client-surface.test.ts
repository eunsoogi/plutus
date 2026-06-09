import { describe, expect, it } from "vitest";
import { createCommandClient } from "./index";
import { createMockCommandBridge } from "./fixture-client.test-support";

describe("command client surface", () => {
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
      "portfolios.syncFromProvider": async (input) => ({
        importedCount: 2,
        portfolioId: input.portfolioId ?? "portfolio-synced",
        providerId: input.providerId,
        skippedCount: 0,
        positionSymbols: ["BTC-KRW", "ETH-KRW"],
      }),
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
    await client.portfolios.syncFromProvider({
      providerId: "upbit",
      portfolioName: "Upbit Synced Holdings",
      baseCurrency: "KRW",
    });
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
      "portfolios.syncFromProvider",
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
});
