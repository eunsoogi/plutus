import { describe, expect, it } from "vitest";
import { PAST_PERFORMANCE_CAVEAT } from "@plutus/backtest";
import { LocalToolRouter } from "../index";
import { makeRunContext } from "../test-support";

describe("plutus_reports locale rendering", () => {
  it("Given a Korean report locale When rendering a report Then labels localize without rewriting canonical refs", async () => {
    const router = new LocalToolRouter();
    const response = await router.call(makeRunContext("report_writer"), {
      namespace: "plutus_reports",
      tool: "render_report",
      input: {
        format: "markdown",
        locale: "ko-KR",
        sections: [
          {
            title: "BTC/NVDA Summary",
            body: "BTC/NVDA source refs and audit_0001 stay canonical.",
          },
        ],
        sourceRefs: [{ id: "audit_0001", provider: "plutus_audit" }],
      },
    });

    expect(response.ok).toBe(true);
    const artifact = (response.data as { artifact: Record<string, unknown> })
      .artifact;
    expect(artifact).toMatchObject({
      locale: "ko-KR",
      mimeType: "text/markdown",
    });
    expect(artifact.content).toContain("# Plutus 리서치 보고서");
    expect(artifact.content).toContain("## 주의사항");
    expect(artifact.content).not.toContain("# Plutus Research Report");
    expect(artifact.content).not.toContain("## Caveat");
    expect(artifact.content).not.toContain(PAST_PERFORMANCE_CAVEAT);
    expect(artifact.content).toContain("BTC/NVDA");
    expect(artifact.content).toContain("audit_0001");
  });
});
