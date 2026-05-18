export const tokens = {
  color: {
    background: "#f6f7f9",
    panel: "#ffffff",
    text: "#17202a",
    muted: "#667085",
    accent: "#1f7a5f",
    warning: "#b42318",
    border: "#d0d5dd",
  },
  radius: "8px",
};

export type RemoteVisualState =
  | "connected"
  | "stale"
  | "revoked"
  | "disconnected";

export type AppLocale = "en" | "ko";

export const defaultLocale: AppLocale = "en";
export const supportedLocales = ["en", "ko"] as const;

export function normalizeLocale(value: string | null | undefined): AppLocale {
  const normalized = value?.toLowerCase().split(/[-_]/)[0];
  return normalized === "ko" ? "ko" : "en";
}

export function resolveLocale(input: {
  requested?: string | null;
  stored?: string | null;
  browserLocales?: readonly string[];
}): AppLocale {
  if (input.requested) return normalizeLocale(input.requested);
  if (input.stored) return normalizeLocale(input.stored);
  const browserLocale = input.browserLocales?.find(Boolean);
  return normalizeLocale(browserLocale);
}

export function formatCurrency(
  value: number,
  currency = "USD",
  locale: AppLocale = defaultLocale,
) {
  return new Intl.NumberFormat(locale === "ko" ? "ko-KR" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function riskToneForCategory(category: string) {
  return category === "risk_warning"
    ? "danger"
    : category === "no_action"
      ? "muted"
      : "accent";
}

export function remoteStateLabel(
  state: RemoteVisualState | string,
  locale: AppLocale = defaultLocale,
) {
  const labels: Record<AppLocale, Record<RemoteVisualState, string>> = {
    en: {
      connected: "Connected to Plutus Mac",
      stale: "Stale snapshot",
      revoked: "Revoked",
      disconnected: "Disconnected",
    },
    ko: {
      connected: "Plutus Mac에 연결됨",
      stale: "오래된 스냅샷",
      revoked: "연결 해제됨",
      disconnected: "연결 끊김",
    },
  };
  if (
    state === "connected" ||
    state === "stale" ||
    state === "revoked" ||
    state === "disconnected"
  ) {
    return labels[locale][state];
  }
  return labels[locale].disconnected;
}
