import { describe, expect, it } from "vitest";
import { makeRunContext } from "../../local-tools/src/test-support";
import { LocalMcpAdapter, hasNetworkListener } from "./index";

describe("local MCP adapter", () => {
  it("requires run context and delegates through router allowlists", async () => {
    const adapter = new LocalMcpAdapter();
    expect(
      (
        await adapter.handle({
          call: {
            namespace: "plutus_market_data",
            tool: "get_provider_health",
          },
        })
      ).ok,
    ).toBe(false);
    expect(
      (
        await adapter.handle({
          runContext: makeRunContext("market_data_researcher"),
          call: {
            namespace: "plutus_market_data",
            tool: "get_provider_health",
          },
        })
      ).ok,
    ).toBe(true);
    expect(hasNetworkListener).toBe(false);
  });
});
