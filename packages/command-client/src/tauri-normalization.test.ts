import { describe, expect, it } from "vitest";

import { createTauriCommandBridge } from "./index";

describe("Tauri provider sync normalization", () => {
  it("rejects non-array holdings before invoking the Tauri sync command", async () => {
    const calls: Array<{
      readonly args?: Record<string, unknown>;
      readonly command: string;
    }> = [];
    const bridge = createTauriCommandBridge(async <T>(
      command: string,
      args?: Record<string, unknown>,
    ): Promise<T> => {
      calls.push({ args, command });
      throw new Error("Tauri invoke should not receive malformed holdings.");
    });

    const input = {
      baseCurrency: "KRW",
      holdings: "btc-krw",
      portfolioName: "Upbit Synced Holdings",
      providerId: "upbit",
    };

    await expect(
      bridge({
        command: "portfolios.syncFromProvider",
        args: [input],
      }),
    ).rejects.toThrow("Provider sync holdings must be an array.");
    expect(calls).toEqual([]);
  });
});
