import { describe, expect, it } from "vitest";

import {
  emptyTradingState,
  normalizeTradingState,
  saveTradingProvider,
} from "./local-trading-runtime";

const now = "2026-06-02T00:00:00.000Z";

describe("local trading provider persistence", () => {
  it("persists only secure credential refs when saving edited provider credentials", () => {
    // Given: an edited provider payload carries secure refs plus accidental raw fields.
    const state = emptyTradingState(now);
    const provider = state.tradingProviders.find(
      (candidate) => candidate.providerId === "upbit",
    );

    expect(provider).toBeDefined();

    if (!provider) return;

    // When: the local runtime saves the provider state.
    const saved = saveTradingProvider(state, {
      ...provider,
      credentialRef: "secure://plutus/providers/upbit/main",
      health: "degraded",
      apiKey: "raw-upbit-api-key",
      secretKey: "raw-upbit-secret-key",
      passphrase: "raw-upbit-passphrase",
    });

    // Then: only the secure reference survives in the saved provider and state.
    const serializedState = JSON.stringify(state);
    expect(saved.credentialRef).toBe("secure://plutus/providers/upbit/main");
    expect(serializedState).toContain("secure://plutus/providers/upbit/main");
    expect(serializedState).not.toContain("raw-upbit-api-key");
    expect(serializedState).not.toContain("raw-upbit-secret-key");
    expect(serializedState).not.toContain("raw-upbit-passphrase");
  });

  it("drops raw credential refs from persisted snapshots during normalization", () => {
    // Given: a legacy local snapshot contains a raw credential reference.
    const fallback = emptyTradingState(now);
    const upbit = fallback.tradingProviders.find(
      (candidate) => candidate.providerId === "upbit",
    );

    expect(upbit).toBeDefined();

    if (!upbit) return;

    // When: the local runtime normalizes persisted state on startup.
    const normalized = normalizeTradingState(
      {
        tradingProviders: [
          {
            ...upbit,
            credentialRef: "raw-upbit-secret-key",
            health: "connected",
          },
        ],
      },
      now,
    );

    // Then: the invalid raw credential ref is not rehydrated.
    const normalizedUpbit = normalized.tradingProviders.find(
      (candidate) => candidate.providerId === "upbit",
    );
    expect(normalizedUpbit?.credentialRef).toBeNull();
    expect(normalizedUpbit?.health).toBe("not_configured");
    expect(JSON.stringify(normalized)).not.toContain("raw-upbit-secret-key");
  });
});
