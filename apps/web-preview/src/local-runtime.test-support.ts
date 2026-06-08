import type {
  CommandEnvelope,
  ProviderPortfolioSyncInput,
  TradingProviderConfig,
} from "@plutus/command-client";
import { vi } from "vitest";

import { createLocalWebCommandBridge } from "./local-runtime";

type StoredValue = string | null;

export const connectedUpbitProvider = {
  providerId: "upbit",
  displayName: "Upbit",
  market: "crypto",
  region: "KR",
  environment: "sandbox",
  mode: "read_only",
  permissions: ["market_data", "account_read"],
  health: "connected",
  lastCheckedAt: "2026-06-08T00:00:00.000Z",
  credentialRef: "secure://plutus/providers/upbit/main",
  warnings: [],
} satisfies TradingProviderConfig;

export function installBrowserState() {
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

export async function callBridge<T>(envelope: CommandEnvelope): Promise<T> {
  return createLocalWebCommandBridge()<T>(envelope);
}

export async function callProviderSyncBridge<T>(
  input: ProviderPortfolioSyncInput,
): Promise<T> {
  const envelope: CommandEnvelope = {
    command: "portfolios.syncFromProvider",
    args: [input],
  };
  return callBridge<T>(envelope);
}
