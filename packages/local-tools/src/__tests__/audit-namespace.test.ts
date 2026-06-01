import { describe, expect, it } from "vitest";
import { createInMemoryToolRuntime, LocalToolRouter } from "../index";

const runId = "run-audit";
const profileId = "profile-core";

const orchestratorAuditContext = {
  runId,
  profileId,
  agentName: "orchestrator",
  selectedTeam: "portfolio_review_committee",
  allowedNamespaces: ["plutus_audit"],
  allowedTools: [
    "plutus_audit.log_agent_event",
    "plutus_audit.get_run_audit_trail",
  ],
  writeScopes: ["plutus_audit.log_agent_event"],
};

const reportWriterAuditContext = {
  runId,
  profileId,
  agentName: "report_writer",
  selectedTeam: "portfolio_review_committee",
  allowedNamespaces: ["plutus_audit"],
  allowedTools: [
    "plutus_audit.log_tool_provenance",
    "plutus_audit.get_run_audit_trail",
  ],
  writeScopes: ["plutus_audit.log_tool_provenance"],
};

const marketDataAuditContext = {
  runId,
  profileId,
  agentName: "market_data_researcher",
  selectedTeam: "investment_committee",
  allowedNamespaces: ["plutus_audit"],
  allowedTools: [
    "plutus_audit.register_warning",
    "plutus_audit.get_run_audit_trail",
  ],
  writeScopes: ["plutus_audit.register_warning"],
};

describe("plutus_audit namespace", () => {
  it("Given an orchestrator event When logged Then it appends a structured audit record", async () => {
    const runtime = createInMemoryToolRuntime();
    const router = new LocalToolRouter(runtime);

    const response = await router.call(orchestratorAuditContext, {
      namespace: "plutus_audit",
      tool: "log_agent_event",
      input: {
        eventType: "committee_started",
        payloadRef: "artifact:run-plan",
      },
    });

    expect(response.ok).toBe(true);
    expect(response.data).not.toMatchObject({
      tool: "log_agent_event",
      status: "ok",
    });
    expect(response.data).toMatchObject({
      event: {
        type: "agent_event",
        runId,
        agentName: "orchestrator",
        eventType: "committee_started",
        payloadRef: "artifact:run-plan",
      },
    });

    const trail = await router.call(orchestratorAuditContext, {
      namespace: "plutus_audit",
      tool: "get_run_audit_trail",
      input: { runId },
    });
    expect(trail.data).toMatchObject({
      records: [
        expect.objectContaining({
          type: "agent_event",
          eventType: "committee_started",
        }),
      ],
    });
  });

  it("Given provenance and warnings When logged Then the run trail contains hashes refs and severities", async () => {
    const runtime = createInMemoryToolRuntime();
    const router = new LocalToolRouter(runtime);

    await router.call(reportWriterAuditContext, {
      namespace: "plutus_audit",
      tool: "log_tool_provenance",
      input: {
        toolName: "plutus_reports.render_report",
        inputHash: "sha256:input",
        outputHash: "sha256:output",
        sourceRefs: [{ id: "quote-btc", provider: "plutus_market_data" }],
      },
    });
    await router.call(marketDataAuditContext, {
      namespace: "plutus_audit",
      tool: "register_warning",
      input: {
        warningType: "stale_quote",
        severity: "warning",
        message: "BTC quote is stale.",
        evidenceRefs: ["quote-btc"],
      },
    });

    const trail = await router.call(reportWriterAuditContext, {
      namespace: "plutus_audit",
      tool: "get_run_audit_trail",
      input: { runId },
    });

    expect(trail.data).toMatchObject({
      records: expect.arrayContaining([
        expect.objectContaining({
          type: "tool_provenance",
          toolName: "plutus_reports.render_report",
          inputHash: "sha256:input",
          outputHash: "sha256:output",
          sourceRefs: [
            expect.objectContaining({
              id: "quote-btc",
              provider: "plutus_market_data",
            }),
          ],
        }),
        expect.objectContaining({
          type: "warning",
          warningType: "stale_quote",
          severity: "warning",
          evidenceRefs: ["quote-btc"],
        }),
      ]),
    });
  });
});
