import type { useI18n } from "./i18n";
import type { PlutusCommandClient, PlutusScenario } from "./plutus-types";

export function commandStatusLabel(
  status: string | undefined,
  fallback: string,
) {
  if (!status || status === "completed") return fallback;
  return status;
}

const visibleResearchRunStatuses: ReadonlySet<string> = new Set([
  "queued",
  "planning",
  "grounding",
  "executing",
  "debating",
  "validating",
  "reporting",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

export type CommandSource = "Command bridge" | "Local runtime";

export function hasVisibleResearchRun(run: PlutusScenario["run"]) {
  return Boolean(
    run.category ||
    run.finalCard ||
    run.artifacts.length > 0 ||
    visibleResearchRunStatuses.has(run.status),
  );
}

function hasInjectedCommandBridge() {
  return (
    typeof window !== "undefined" &&
    Reflect.get(window, "__PLUTUS_COMMAND_BRIDGE__") !== undefined
  );
}

export function commandSourceForRuntime(
  commandClient: PlutusCommandClient | undefined,
): CommandSource {
  if (!commandClient) return "Local runtime";
  if (hasInjectedCommandBridge()) return "Command bridge";
  return currentRuntimeParam() === "local" ? "Local runtime" : "Command bridge";
}

export function commandErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Command failed";
}

export function localizedScenarioText(
  value: string | undefined,
  t: ReturnType<typeof useI18n>["t"],
) {
  if (!value) return "";
  const knownText: Record<string, string> = {
    "No portfolio yet": t("portfolio.empty"),
    Core: t("portfolio.core"),
    "Core Portfolio": t("portfolio.defaultName"),
    "Primary Portfolio": t("portfolio.defaultName"),
    "No watchlist yet": t("watchlist.empty"),
    "Default Watchlist": t("watchlist.default"),
    "No instrument selected": t("instrument.empty"),
    "Create a portfolio or watchlist to inspect instruments.":
      t("runtime.body"),
    "No research runs yet": t("runs.empty"),
    "No runs yet": t("runs.noRunsYet"),
    completed: t("runs.completed"),
    "No activity": t("memory.noActivity"),
    "No paired device": t("empty.device"),
    "Not paired": t("empty.pairing"),
    Paired: t("empty.paired"),
    "BTC NVDA risk report": t("artifact.riskReport"),
    "Security Settings": t("settings.security"),
    "Provider Settings": t("settings.providers"),
    Preferences: t("settings.preferences"),
    "Import Export": t("settings.importExport"),
    Binance: t("provider.binance"),
    Coinbase: t("provider.coinbase"),
    Kiwoom: t("provider.kiwoom"),
    "Kiwoom Securities": t("provider.kiwoom"),
    Kraken: t("provider.kraken"),
    Upbit: t("provider.upbit"),
  };
  return knownText[value] ?? value;
}

export function localizedPortfolioHeading(
  value: string | undefined,
  t: ReturnType<typeof useI18n>["t"],
) {
  const portfolioName = localizedScenarioText(value, t);
  const normalizedName = portfolioName.toLocaleLowerCase();
  if (
    !portfolioName ||
    normalizedName.includes("portfolio") ||
    portfolioName.includes("포트폴리오")
  ) {
    return portfolioName;
  }
  return t("portfolio.suffix", { name: portfolioName });
}

export function localizedCommandSource(
  source: string,
  t: ReturnType<typeof useI18n>["t"],
) {
  if (source === "Command bridge") return t("remote.commandBridge");
  if (source === "Local runtime") return t("remote.localRuntime");
  return source;
}

export function localizedCommandStatus(
  status: string,
  t: ReturnType<typeof useI18n>["t"],
) {
  if (status === "Ready") return t("common.ready");
  if (status === "No command bridge connected") {
    return t("portfolio.bridgeMissing");
  }
  if (status.startsWith("Command bridge:")) {
    return status.replace("Command bridge", t("remote.commandBridge"));
  }
  return status;
}

export function buildRemoteCommand(input: {
  commandId?: string;
  sessionId: string;
  sessionKeyRef: string;
  commandType: string;
  payload: Record<string, unknown>;
  unlockProof: {
    method: string;
    sessionKeyRef: string;
    challenge?: string;
  };
}) {
  const commandId =
    input.commandId ??
    (typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `cmd-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  return {
    commandId,
    sessionId: input.sessionId,
    sessionKeyRef: input.sessionKeyRef,
    commandType: input.commandType,
    payload: input.payload,
    unlock: input.unlockProof,
  };
}

export async function remoteCommandCredentials(
  commandClient: PlutusCommandClient | undefined,
  scenario: PlutusScenario,
  commandId: string,
  commandType: string,
  payload: Record<string, unknown>,
) {
  if (commandClient?.remote?.prepareUnlock) {
    try {
      return await commandClient.remote.prepareUnlock({
        commandId,
        commandType,
        payload,
      });
    } catch {
      // Native hosts may expose the prepare command while the paired device
      // runtime is responsible for producing the actual biometric proof.
    }
  }
  const { sessionId, sessionKeyRef, unlockProof } = scenario.remoteDevice;
  if (sessionId && sessionKeyRef && unlockProof) {
    return { sessionId, sessionKeyRef, unlockProof };
  }
  return null;
}

export function preserveRuntimeSearch() {
  if (typeof window === "undefined") return "";
  const search = new URLSearchParams(window.location.search);
  const params = new URLSearchParams();
  for (const key of ["runtime", "locale"]) {
    const value = search.get(key);
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

function currentRuntimeParam() {
  if (typeof window === "undefined") return null;
  return new URL(window.location.href).searchParams.get("runtime");
}

export function withRemoteQuery(path: string, remote: string) {
  const params = new URLSearchParams({ remote });
  const runtime = currentRuntimeParam();
  if (runtime) params.set("runtime", runtime);
  if (typeof window !== "undefined") {
    const locale = new URL(window.location.href).searchParams.get("locale");
    if (locale) params.set("locale", locale);
  }
  return `${path}?${params.toString()}`;
}
