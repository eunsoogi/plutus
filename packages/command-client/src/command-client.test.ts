import { describe, expect, it } from "vitest";
import {
  CommandEnvelopeSchema,
  createCommandClient,
  createMockCommandBridge,
  redactCommandLog,
} from "./index";

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
});
