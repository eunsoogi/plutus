import { describe, expect, it } from "vitest";
import {
  LocalToolRouter,
  createInMemoryToolRuntime,
} from "@plutus/local-tools";
import { createStdioMcpAdapter } from "../index";

describe("stdio MCP adapter", () => {
  it("delegates MCP-shaped calls to the local router using signed run context", async () => {
    const runtime = createInMemoryToolRuntime();
    const adapter = createStdioMcpAdapter({
      router: new LocalToolRouter(runtime),
      signedRunContext: Buffer.from(
        JSON.stringify({
          runId: "run-btc-nvda",
          profileId: "profile-core",
          agentName: "report_writer",
          selectedTeam: "portfolio_review_committee",
          allowedNamespaces: [
            "plutus_reports",
            "plutus_audit",
            "plutus_memory",
          ],
          allowedTools: [
            "plutus_reports.create_run_card",
            "plutus_reports.create_mobile_summary",
          ],
          writeScopes: [
            "plutus_reports.create_run_card",
            "plutus_reports.create_mobile_summary",
          ],
        }),
      ).toString("base64url"),
    });

    const response = await adapter.callTool("plutus_reports.create_run_card", {
      runId: "run-btc-nvda",
      payload: {
        title: "BTC/NVDA portfolio review",
        category: "risk_warning",
        profileId: "profile-core",
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
});
