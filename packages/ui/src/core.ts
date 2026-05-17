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

export function formatCurrency(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
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

export function remoteStateLabel(state: RemoteVisualState | string) {
  if (state === "connected") return "Connected to Plutus Mac";
  if (state === "stale") return "Stale snapshot";
  if (state === "revoked") return "Revoked";
  return "Disconnected";
}
