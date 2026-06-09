import { z } from "zod";
import { describe, expect, it } from "vitest";
import { CodexSdkRunHost } from "../codex-run-host/codex-sdk-run-host";
import { createFinalRunCard } from "../test-harness/scripted-run-stream";
import { RecordingProductCodexClient } from "./recording-product-client";

describe("CodexSdkRunHost product lifecycle", () => {
  it("starts runs with a deterministic Plutus config hash and streams SDK events", async () => {
    const client = new RecordingProductCodexClient([
      {
        type: "run.status_changed",
        runId: "spoofed-run",
        stage: "planning",
        message: "planning started",
      },
      {
        type: "run.completed",
        runId: "run-product",
        stage: "completed",
        message: "completed",
      },
    ]);
    const host = new CodexSdkRunHost({
      client,
      env: { PLUTUS_RUN_REAL_CODEX_SMOKE: "1" },
    });

    const first = await host.startResearchRun({
      profileId: "profile-core",
      portfolioId: "portfolio-core",
      userRequest: "Review BTC and NVDA risk.",
    });
    const second = await host.startResearchRun({
      profileId: "profile-core",
      portfolioId: "portfolio-core",
      userRequest: "Review BTC and NVDA risk.",
    });

    expect(first).toMatchObject({
      runId: "run-product",
      threadId: "thread-product",
    });
    expect(first.configHash).toMatch(/^[a-f0-9]{64}$/);
    expect(second.configHash).toBe(first.configHash);
    expect(client.started[0]).toMatchObject({
      profileId: "profile-core",
      portfolioId: "portfolio-core",
      userRequest: "Review BTC and NVDA risk.",
      configHash: first.configHash,
    });
    expect(
      client.started[0]?.mcpServers.market_data_researcher__plutus_market_data,
    ).toEqual({
      command: "pnpm",
      args: [
        "--dir",
        expect.any(String),
        "--filter",
        "@plutus/local-mcp-adapter",
        "start",
        "plutus_market_data",
        "--read-only",
        "--stdio",
      ],
      env: {
        PLUTUS_REPO_ROOT: expect.any(String),
        PLUTUS_RUN_CONTEXT_SECRET: expect.any(String),
        PLUTUS_SIGNED_RUN_CONTEXT: expect.stringMatching(/^[^.]+\.[^.]+$/),
      },
    });
    expect(
      client.started[0]?.mcpServers.report_writer__plutus_reports.env
        .PLUTUS_SIGNED_RUN_CONTEXT,
    ).not.toBe(
      client.started[0]?.mcpServers.market_data_researcher__plutus_market_data
        .env.PLUTUS_SIGNED_RUN_CONTEXT,
    );
    expect(
      client.started[1]?.mcpServers.market_data_researcher__plutus_market_data
        .env.PLUTUS_RUN_CONTEXT_SECRET,
    ).not.toBe(
      client.started[0]?.mcpServers.market_data_researcher__plutus_market_data
        .env.PLUTUS_RUN_CONTEXT_SECRET,
    );
    expect(client.started[0]?.teamAgents).toEqual([
      "market_data_researcher",
      "portfolio_manager",
      "risk_manager",
      "report_writer",
    ]);
    expect(client.started[0]?.rootSandboxMode).toBe("workspace-write");
    expect(Object.keys(client.started[0]?.mcpServers ?? {}).sort()).toEqual(
      expect.arrayContaining([
        "market_data_researcher__plutus_market_data",
        "portfolio_manager__plutus_portfolio",
        "risk_manager__plutus_risk",
        "report_writer__plutus_reports",
      ]),
    );

    const streamed = [];
    for await (const event of host.streamResearchRun(first)) {
      streamed.push(event);
    }

    expect(streamed.map((event) => event.type)).toEqual([
      "run.status_changed",
      "run.completed",
    ]);
    expect(streamed.map((event) => event.runId)).toEqual([
      "run-product",
      "run-product",
    ]);
  });

  it("builds role-scoped MCP servers for quant runs without exposing portfolio/report-only namespaces", async () => {
    const client = new RecordingProductCodexClient([]);
    const host = new CodexSdkRunHost({
      client,
      env: { PLUTUS_RUN_REAL_CODEX_SMOKE: "1" },
    });

    await host.startResearchRun({
      profileId: "profile-core",
      selectedTeam: "quant_strategy_desk",
      userRequest: "Backtest the approved momentum strategy.",
    });

    const serverNames = Object.keys(client.started[0]?.mcpServers ?? {});
    expect(serverNames).toEqual(
      expect.arrayContaining([
        "quant_strategy_researcher__plutus_backtest",
        "market_data_researcher__plutus_market_data",
        "report_writer__plutus_memory",
      ]),
    );
    expect(
      serverNames.some((name) => name.endsWith("__plutus_portfolio")),
    ).toBe(false);
    expect(
      client.started[0]?.mcpServers.quant_strategy_researcher__plutus_backtest
        .args,
    ).not.toContain("--read-only");
    expect(
      client.started[0]?.mcpServers.market_data_researcher__plutus_market_data
        .args,
    ).toContain("--read-only");
  });

  it("rejects vetoed final cards that try to complete as candidates", async () => {
    const client = {
      async *runStreamed() {
        yield {
          finalRunCard: createFinalRunCard({
            runId: "run-veto",
            profileId: "profile-core",
            title: "Rejected candidate",
            category: "strategy_candidate",
            riskValidation: "vetoed",
            summary: "Risk vetoed.",
            warnings: ["veto"],
            evidenceRefs: ["audit:veto"],
          }),
        };
      },
    };
    const host = new CodexSdkRunHost({
      client,
      env: { PLUTUS_RUN_REAL_CODEX_SMOKE: "1" },
    });

    const result = await host.run({
      runId: "run-veto",
      profileId: "profile-core",
      request: "Review strategy.",
      allowedRecommendationCategories: ["strategy_candidate", "risk_warning"],
    });

    expect(result.status).toBe("failed");
    expect(result.validationFailures[0]).toMatchObject({
      path: "riskValidation",
    });
  });

  it("fails closed when resuming a thread with the wrong config hash", async () => {
    const host = new CodexSdkRunHost({
      client: new RecordingProductCodexClient([]),
      env: { PLUTUS_RUN_REAL_CODEX_SMOKE: "1" },
    });
    const handle = await host.startResearchRun({
      profileId: "profile-core",
      userRequest: "Review risk.",
    });

    await expect(
      host.resumeResearchRun(handle.threadId, {
        expectedConfigHash: "0".repeat(64),
      }),
    ).rejects.toThrow(/config hash mismatch/i);
  });

  it("registers a stream after resuming a known Codex thread", async () => {
    const client = new RecordingProductCodexClient([
      {
        type: "run.completed",
        runId: "run-product",
        stage: "completed",
        message: "resumed",
      },
    ]);
    const host = new CodexSdkRunHost({
      client,
      env: { PLUTUS_RUN_REAL_CODEX_SMOKE: "1" },
    });
    const handle = await host.startResearchRun({
      profileId: "profile-core",
      userRequest: "Review risk.",
    });

    const resumed = await host.resumeResearchRun(handle.threadId);
    const streamed = [];
    for await (const event of host.streamResearchRun(resumed)) {
      streamed.push(event);
    }

    expect(streamed.map((event) => event.type)).toContain("run.completed");

    const persisted = await host.resumeResearchRun("persisted-thread", {
      expectedConfigHash: "a".repeat(64),
      profileId: "profile-persisted",
      runId: "run-persisted",
    });
    expect(persisted).toMatchObject({
      runId: "run-persisted",
      threadId: "persisted-thread",
    });
  });

  it("requests structured turns, cancellation, and archive through the SDK client", async () => {
    const client = new RecordingProductCodexClient([], {
      category: "risk_warning",
    });
    const host = new CodexSdkRunHost({
      client,
      env: { PLUTUS_RUN_REAL_CODEX_SMOKE: "1" },
    });
    const handle = await host.startResearchRun({
      profileId: "profile-core",
      userRequest: "Create plan.",
    });

    const response = await host.requestStructuredTurn(handle, {
      prompt: "Return category.",
      schema: z.object({ category: z.literal("risk_warning") }),
    });
    await host.cancelResearchRun(handle);
    await host.archiveResearchRun(handle);

    expect(response).toEqual({ category: "risk_warning" });
    expect(client.structuredTurns[0]).toMatchObject({
      threadId: handle.threadId,
      prompt: "Return category.",
    });
    expect(client.cancelled).toEqual([handle.threadId]);
    expect(client.archived).toEqual([handle.threadId]);
  });
});
