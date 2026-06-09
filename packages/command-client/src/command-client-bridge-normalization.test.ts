import { describe, expect, it } from "vitest";
import { createTauriCommandBridge } from "./index";

describe("command client bridge normalization", () => {
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
