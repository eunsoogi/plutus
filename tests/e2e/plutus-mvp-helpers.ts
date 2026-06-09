declare global {
  interface Window {
    __PLUTUS_COMMAND_BRIDGE__?: (envelope: {
      command: string;
      args: unknown[];
    }) => Promise<unknown>;
  }
}

export const configuredKoreanUpbitProvider = {
  providerId: "upbit",
  displayName: "업비트",
  market: "crypto",
  region: "KR",
  environment: "sandbox",
  mode: "read_only",
  permissions: ["market_data", "account_read"],
  health: "connected",
  lastCheckedAt: "2026-06-08T00:00:00.000Z",
  credentialRef: "secure://plutus/providers/upbit/main",
  warnings: [],
} as const;
