import { PassThrough } from "node:stream";
import { once } from "node:events";
import { describe, expect, it } from "vitest";
import {
  LocalToolRouter,
  createInMemoryToolRuntime,
} from "@plutus/local-tools";
import {
  buildStdioAdapterStartCommand,
  createStdioMcpAdapter,
  signRunContext,
  startStdioServer,
} from "../index";

describe("stdio MCP adapter", () => {
  it("builds the Codex custom-agent stdio start command for a namespace allowlist", () => {
    expect(
      buildStdioAdapterStartCommand("plutus_market_data", { readOnly: true }),
    ).toEqual({
      command: "pnpm",
      args: [
        "--filter",
        "@plutus/local-mcp-adapter",
        "start",
        "plutus_market_data",
        "--read-only",
        "--stdio",
      ],
    });
  });

  it("delegates MCP-shaped calls to the local router using signed run context", async () => {
    const runtime = createInMemoryToolRuntime();
    const secret = "test-secret";
    const adapter = createStdioMcpAdapter({
      router: new LocalToolRouter(runtime),
      namespace: "plutus_reports",
      runContextSecret: secret,
      signedRunContext: signRunContext(reportWriterContext(), {
        namespace: "plutus_reports",
        secret,
        expiresAt: new Date(Date.now() + 60_000),
      }),
    });

    const response = await adapter.callTool("plutus_reports.create_run_card", {
      payload: {
        title: "BTC/NVDA portfolio review",
        category: "risk_warning",
        summary: "Risk concentration remains visible.",
        findings: ["BTC and NVDA concentration needs review."],
        sourceRefs: [{ id: "018f3f5d-0000-7000-8000-000000000006" }],
      },
    });

    expect(response.ok).toBe(true);
    expect(response.data).toMatchObject({ category: "risk_warning" });
    expect(runtime.auditEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          decision: "accepted",
          agentName: "report_writer",
          namespace: "plutus_reports",
          tool: "create_run_card",
        }),
      ]),
    );
  });

  it("rejects arbitrary prompt-supplied user context", async () => {
    const adapter = createStdioMcpAdapter({
      router: new LocalToolRouter(createInMemoryToolRuntime()),
      namespace: "plutus_market_data",
      runContextSecret: "test-secret",
      signedRunContext: "not-valid",
    });

    await expect(
      adapter.callTool("plutus_market_data.get_quote", {
        instrumentId: "NVDA",
      }),
    ).resolves.toMatchObject({
      ok: false,
      warnings: [expect.objectContaining({ code: "invalid_run_context" })],
    });
  });

  it("rejects signed run contexts outside their expiry or namespace binding", async () => {
    const secret = "test-secret";
    const adapter = createStdioMcpAdapter({
      router: new LocalToolRouter(createInMemoryToolRuntime()),
      namespace: "plutus_reports",
      runContextSecret: secret,
      signedRunContext: signRunContext(reportWriterContext(), {
        namespace: "plutus_audit",
        secret,
        expiresAt: new Date(Date.now() + 60_000),
      }),
    });

    await expect(
      adapter.callTool("plutus_reports.create_run_card", {
        runId: "run-btc-nvda",
        payload: { title: "review", category: "risk_warning" },
      }),
    ).resolves.toMatchObject({
      ok: false,
      warnings: [expect.objectContaining({ code: "invalid_run_context" })],
    });
  });

  it("enforces read-only mode at the adapter before the router executes writes", async () => {
    const runtime = createInMemoryToolRuntime();
    const secret = "test-secret";
    const adapter = createStdioMcpAdapter({
      router: new LocalToolRouter(runtime),
      namespace: "plutus_reports",
      readOnly: true,
      runContextSecret: secret,
      signedRunContext: signRunContext(reportWriterContext(), {
        namespace: "plutus_reports",
        secret,
        expiresAt: new Date(Date.now() + 60_000),
      }),
    });

    await expect(
      adapter.callTool("plutus_reports.create_run_card", {
        runId: "run-btc-nvda",
        payload: { title: "review", category: "risk_warning" },
      }),
    ).resolves.toMatchObject({
      ok: false,
      warnings: [expect.objectContaining({ code: "read_only_violation" })],
    });
    expect(runtime.auditEvents).toHaveLength(0);
  });

  it("serves MCP-like JSON-RPC initialize, tools/list, and tools/call over stdin/stdout streams", async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const secret = "test-secret";
    const written: string[] = [];
    output.on("data", (chunk) => written.push(chunk.toString("utf8")));

    const server = startStdioServer(["plutus_reports", "--stdio"], {
      input,
      output,
      router: new LocalToolRouter(createInMemoryToolRuntime()),
      env: {
        PLUTUS_RUN_CONTEXT_SECRET: secret,
        PLUTUS_SIGNED_RUN_CONTEXT: signRunContext(reportWriterContext(), {
          namespace: "plutus_reports",
          secret,
          expiresAt: new Date(Date.now() + 60_000),
        }),
      },
    });

    input.write(
      `${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" })}\n`,
    );
    input.write(
      `${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" })}\n`,
    );
    input.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "plutus_reports.create_run_card",
          arguments: {
            payload: {
              title: "BTC/NVDA portfolio review",
              category: "risk_warning",
              summary: "Risk concentration remains visible.",
              findings: ["BTC and NVDA concentration needs review."],
              sourceRefs: [{ id: "018f3f5d-0000-7000-8000-000000000006" }],
            },
          },
        },
      })}\n`,
    );
    input.end();
    await server;
    await once(output, "finish");

    const responses = written
      .join("")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));

    expect(responses[0]).toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      result: { protocolVersion: "2024-11-05" },
    });
    expect(responses[1].result.tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "plutus_reports.create_run_card" }),
      ]),
    );
    expect(responses[1].result.tools).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "plutus_audit.log_agent_event" }),
      ]),
    );
    expect(responses[2]).toMatchObject({
      jsonrpc: "2.0",
      id: 3,
      result: {
        content: [
          expect.objectContaining({
            type: "text",
          }),
        ],
        isError: false,
      },
    });
  });
});

function reportWriterContext() {
  return {
    runId: "018f3f5d-0000-7000-8000-000000000006",
    profileId: "018f3f5d-0000-7000-8000-000000000001",
    agentName: "report_writer",
    selectedTeam: "portfolio_review_committee",
    allowedNamespaces: ["plutus_reports", "plutus_audit", "plutus_memory"],
    allowedTools: [
      "plutus_reports.create_run_card",
      "plutus_reports.create_mobile_summary",
    ],
    writeScopes: [
      "plutus_reports.create_run_card",
      "plutus_reports.create_mobile_summary",
    ],
  };
}
