import type { TradingProviderConfig } from "./provider-settings-types";

export function providerHealthLabel(
  health: TradingProviderConfig["health"],
  text: Record<string, string>,
): string {
  switch (health) {
    case "connected":
      return text.connected;
    case "degraded":
      return text.degraded;
    case "not_configured":
      return text.notConfigured;
    case "blocked":
      return text.blocked;
    default:
      return assertNever(health);
  }
}

export function providerHealthRows(
  providers: readonly TradingProviderConfig[],
  text: Record<string, string>,
) {
  const counts = providers.reduce(
    (summary, provider) => ({
      ...summary,
      [provider.health]: summary[provider.health] + 1,
    }),
    {
      connected: 0,
      degraded: 0,
      not_configured: 0,
      blocked: 0,
    },
  );
  return [
    [text.connected, counts.connected],
    [text.degraded, counts.degraded],
    [text.notConfigured, counts.not_configured],
    [text.blocked, counts.blocked],
  ] as const;
}

function assertNever(value: never): never {
  throw new Error(`Unsupported provider health: ${String(value)}`);
}
