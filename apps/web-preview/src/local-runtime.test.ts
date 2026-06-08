import type { AppSnapshot, CommandEnvelope } from "@plutus/command-client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createLocalWebCommandBridge } from "./local-runtime";

type StoredValue = string | null;

function installBrowserState() {
  const storage = new Map<string, string>();
  let idCounter = 0;
  vi.stubGlobal("localStorage", {
    clear: () => storage.clear(),
    getItem: (key: string): StoredValue => storage.get(key) ?? null,
    removeItem: (key: string) => storage.delete(key),
    setItem: (key: string, value: string) => storage.set(key, value),
  });
  vi.stubGlobal("crypto", {
    randomUUID: () => {
      idCounter += 1;
      return `local-runtime-${idCounter}`;
    },
  });
}

async function callBridge<T>(envelope: CommandEnvelope): Promise<T> {
  return createLocalWebCommandBridge()<T>(envelope);
}

describe("local web runtime portfolio positions", () => {
  beforeEach(() => {
    installBrowserState();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("persists an added position in the local portfolio snapshot", async () => {
    // Given: the local browser runtime has a user-created portfolio.
    const portfolio = await callBridge<{ id: string }>({
      command: "portfolios.create",
      args: [{ name: "Core Portfolio", baseCurrency: "USD" }],
    });

    // When: the UI adds a BTC holding through the command bridge.
    const position = await callBridge<Record<string, unknown>>({
      command: "portfolios.addPosition",
      args: [
        {
          averageCost: 65000,
          costCurrency: "USD",
          portfolioId: portfolio.id,
          quantity: 0.75,
          symbol: "btc",
          thesis: "Crypto beta sleeve",
        },
      ],
    });

    // Then: the next app snapshot includes the position data needed by routes.
    const snapshot = await callBridge<AppSnapshot>({
      command: "app.getSnapshot",
      args: [],
    });
    const firstPortfolio = snapshot.portfolios[0];
    expect(position).toMatchObject({
      averageCost: 65000,
      costCurrency: "USD",
      quantity: 0.75,
      symbol: "BTC",
      thesis: "Crypto beta sleeve",
    });
    expect(firstPortfolio?.positions).toEqual([
      expect.objectContaining({
        averageCost: 65000,
        costCurrency: "USD",
        quantity: 0.75,
        symbol: "BTC",
      }),
    ]);
  });

  it("rejects malformed add-position input before mutating local state", async () => {
    // Given: the local browser runtime has a portfolio but no positions.
    const portfolio = await callBridge<{ id: string }>({
      command: "portfolios.create",
      args: [{ name: "Core Portfolio", baseCurrency: "USD" }],
    });

    // When/Then: malformed numeric input fails and leaves the snapshot empty.
    await expect(
      callBridge({
        command: "portfolios.addPosition",
        args: [
          {
            averageCost: -1,
            costCurrency: "USD",
            portfolioId: portfolio.id,
            quantity: 0,
            symbol: "BTC",
          },
        ],
      }),
    ).rejects.toThrow("Quantity must be greater than 0.");
    const snapshot = await callBridge<AppSnapshot>({
      command: "app.getSnapshot",
      args: [],
    });
    expect(snapshot.portfolios[0]?.positions).toEqual([]);
  });
});
