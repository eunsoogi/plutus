import { useEffect, useState, type ReactNode } from "react";
import {
  formatCurrency,
  remoteStateLabel,
  type AppLocale,
  type RemoteVisualState,
} from "./core";
import { useI18n } from "./i18n";

export type RouteKind = "host" | "remote";

export type PlutusScenario = {
  profileId?: string;
  portfolio: {
    id: string;
    name: string;
    value: number;
    positions: {
      id?: string;
      symbol: string;
      name: string;
      value: number;
      allocation: string;
      thesis: string;
    }[];
  };
  watchlist: {
    id: string;
    name: string;
    items: {
      id?: string;
      symbol: string;
      triggerNote?: string;
    }[];
  };
  instrument: {
    id: string;
    symbol: string;
    name: string;
    summary: string;
  };
  run: {
    id: string;
    title: string;
    status: string;
    category: string;
    confidence?: string;
    finalCard?: {
      summary?: string;
      supportingEvidence?: Array<{ label?: string; sourceRef?: string }>;
      riskChecklist?: Array<{ check?: string; status?: string }>;
      limitations?: string[];
      nextActions?: string[];
    };
    artifacts: {
      id: string;
      name: string;
      type: string;
    }[];
  };
  memory: {
    id: string;
    summary: string;
    activity: string;
  };
  wiki: {
    id: string;
    title: string;
    revision: string;
    sourceRef: string;
  };
  remoteDevice: {
    name: string;
    pairingCode: string;
    sessionId?: string;
    sessionKeyRef?: string;
    unlockProof?: {
      method: string;
      sessionKeyRef: string;
      challenge?: string;
    };
  };
};

export type HostShellProps = {
  children: ReactNode;
};

export type PlutusCommandClient = {
  app?: {
    getSnapshot: () => Promise<unknown>;
  };
  portfolios?: {
    create: (input: {
      profileId?: string;
      name: string;
      baseCurrency: string;
      benchmarkId?: string | null;
      riskProfile?: Record<string, unknown>;
    }) => Promise<{ id?: string; name?: string }>;
    updatePositionThesis?: (input: {
      positionId: string;
      profileId?: string;
      thesis: string;
    }) => Promise<Record<string, unknown>>;
  };
  watchlists?: {
    updateItem: (input: {
      itemId: string;
      profileId?: string;
      triggerNote?: string;
      targetZone?: string;
    }) => Promise<Record<string, unknown>>;
  };
  researchRuns: {
    start: (input: {
      portfolioId?: string;
      profileId?: string;
      symbols?: string[];
      selectedTeam?: string;
      userRequest?: string;
    }) => Promise<{ id?: string; status?: string }>;
  };
  artifacts: {
    get: (
      artifactId: string,
      input?: { profileId?: string; runId?: string },
    ) => Promise<{
      id?: string;
      name?: string;
      title?: string;
      type?: string;
    }>;
  };
  memory?: {
    update: (
      memoryId: string,
      patch: Record<string, unknown>,
      input?: { profileId?: string },
    ) => Promise<Record<string, unknown>>;
    archive: (
      memoryId: string,
      reason: string,
      input?: { profileId?: string },
    ) => Promise<void>;
    forget: (memoryId: string, input?: { profileId?: string }) => Promise<void>;
    setCategoryEnabled: (category: string, enabled: boolean) => Promise<void>;
  };
  wiki?: {
    revertRevision: (
      pageId: string,
      revisionId: string,
      reason: string,
    ) => Promise<Record<string, unknown>>;
  };
  remote?: {
    prepareUnlock?: (input: {
      commandId: string;
      commandType: string;
      payload: Record<string, unknown>;
    }) => Promise<{
      sessionId: string;
      sessionKeyRef: string;
      unlockProof: {
        method: string;
        sessionKeyRef: string;
        challenge?: string;
      };
    }>;
    executeCommand: (input: {
      commandId?: string;
      sessionId?: string;
      sessionKeyRef?: string;
      commandType: string;
      payload?: Record<string, unknown>;
      unlock?: Record<string, unknown> | null;
    }) => Promise<Record<string, unknown>>;
  };
};

function commandStatusLabel(status: string | undefined, fallback: string) {
  if (!status || status === "completed") return fallback;
  return status;
}

function commandErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Command failed";
}

function localizedScenarioText(
  value: string | undefined,
  t: ReturnType<typeof useI18n>["t"],
) {
  if (!value) return "";
  const knownText: Record<string, string> = {
    "No portfolio yet": t("portfolio.empty"),
    Core: t("portfolio.core"),
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
  };
  return knownText[value] ?? value;
}

function localizedCommandSource(
  source: string,
  t: ReturnType<typeof useI18n>["t"],
) {
  if (source === "Command bridge") return t("remote.commandBridge");
  if (source === "Local runtime") return t("remote.localRuntime");
  return source;
}

function localizedCommandStatus(
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

function buildRemoteCommand(input: {
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

async function remoteCommandCredentials(
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

function preserveRuntimeSearch() {
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

function withRemoteQuery(path: string, remote: string) {
  const params = new URLSearchParams({ remote });
  const runtime = currentRuntimeParam();
  if (runtime) params.set("runtime", runtime);
  if (typeof window !== "undefined") {
    const locale = new URL(window.location.href).searchParams.get("locale");
    if (locale) params.set("locale", locale);
  }
  return `${path}?${params.toString()}`;
}

function LocaleSelector() {
  const { locale, setLocale, t } = useI18n();
  return (
    <label className="locale-switcher">
      <span>{t("aria.language")}</span>
      <select
        aria-label={t("aria.language")}
        value={locale}
        onChange={(event) => setLocale(event.currentTarget.value as AppLocale)}
      >
        <option value="en">English</option>
        <option value="ko">한국어</option>
      </select>
    </label>
  );
}

export function HostShell({ children }: HostShellProps) {
  const runtimeSearch = preserveRuntimeSearch();
  const { t } = useI18n();
  return (
    <main
      className="app-shell"
      data-testid="route-surface"
      data-route-kind="host"
    >
      <aside className="sidebar" aria-label={t("aria.primaryNavigation")}>
        <strong>Plutus</strong>
        <LocaleSelector />
        <nav>
          <a href={`/dashboard${runtimeSearch}`}>{t("nav.dashboard")}</a>
          <a href={`/portfolios${runtimeSearch}`}>{t("nav.portfolios")}</a>
          <a href={`/watchlists${runtimeSearch}`}>{t("nav.watchlists")}</a>
          <a href={`/runs${runtimeSearch}`}>{t("nav.runs")}</a>
          <a href={`/memory${runtimeSearch}`}>{t("nav.memory")}</a>
          <a href={`/wiki${runtimeSearch}`}>{t("nav.wiki")}</a>
          <a href={`/settings/remote-control${runtimeSearch}`}>
            {t("nav.remote")}
          </a>
        </nav>
      </aside>
      <section className="main-surface">{children}</section>
    </main>
  );
}

export function MobileShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const remote =
    typeof window === "undefined"
      ? "connected"
      : (new URL(window.location.href).searchParams.get("remote") ??
        new URL(window.location.href).searchParams.get("state") ??
        "connected");
  return (
    <main
      className="mobile-shell"
      data-testid="route-surface"
      data-route-kind="remote"
    >
      <nav className="mobile-tabs" aria-label={t("aria.remoteNavigation")}>
        <a href={withRemoteQuery("/remote/dashboard", remote)}>
          {t("nav.home")}
        </a>
        <a href={withRemoteQuery("/remote/runs", remote)}>{t("nav.runs")}</a>
        <a href={withRemoteQuery("/remote/settings", remote)}>
          {t("nav.settings")}
        </a>
      </nav>
      <LocaleSelector />
      {children}
    </main>
  );
}

export function RuntimeUnavailablePage() {
  const { t } = useI18n();
  return (
    <HostShell>
      <section className="panel" data-testid="runtime-unavailable">
        <h1>{t("runtime.title")}</h1>
        <p>{t("runtime.body")}</p>
      </section>
    </HostShell>
  );
}

export function RiskWarning() {
  const { t } = useI18n();
  return (
    <section className="risk-warning" data-testid="risk-warning">
      <strong>{t("risk.title")}</strong>
      <span>{t("risk.body")}</span>
    </section>
  );
}

export function RiskChart() {
  const { t } = useI18n();
  return (
    <div
      className="chart"
      data-testid="artifact-chart"
      data-rendered="true"
      aria-label={t("chart.exposure")}
    >
      <svg
        data-testid="risk-chart"
        viewBox="0 0 320 120"
        role="img"
        aria-label={t("chart.exposureLine")}
      >
        <rect x="0" y="0" width="320" height="120" fill="#f7fafc" />
        <polyline
          points="10,90 70,80 130,55 190,70 250,35 310,28"
          fill="none"
          stroke="#1f7a5f"
          strokeWidth="4"
        />
        <polyline
          points="10,100 70,92 130,82 190,75 250,68 310,60"
          fill="none"
          stroke="#b24724"
          strokeWidth="4"
        />
      </svg>
      <span style={{ height: "76%" }}>BTC</span>
      <span style={{ height: "62%" }}>NVDA</span>
      <span style={{ height: "38%" }}>{t("chart.cash")}</span>
    </div>
  );
}

export function ArtifactList({ scenario }: { scenario: PlutusScenario }) {
  const { t } = useI18n();
  return (
    <section className="artifact-list" data-testid="artifact-list">
      <h2>{t("artifact.list")}</h2>
      {scenario.run.artifacts.map((artifact) => (
        <a
          key={artifact.id}
          href={`/runs/${scenario.run.id}/artifacts/${artifact.id}${preserveRuntimeSearch()}`}
          aria-label={t("artifact.open", {
            name: localizedScenarioText(artifact.name, t),
          })}
        >
          {localizedScenarioText(artifact.name, t)}
        </a>
      ))}
    </section>
  );
}

export function HostDashboard({ scenario }: { scenario: PlutusScenario }) {
  const { t } = useI18n();
  return (
    <HostShell>
      <header className="page-header">
        <p className="eyebrow">{t("dashboard.eyebrow")}</p>
        <h1>{t("dashboard.title")}</h1>
        <h2>{t("dashboard.host")}</h2>
      </header>
      <section className="grid two">
        <PortfolioSummary scenario={scenario} />
        {scenario.run.category ? (
          <article className="panel">
            <h2>{t("dashboard.currentGuardrail")}</h2>
            <RiskWarning />
          </article>
        ) : null}
        <article className="panel">
          <h2>{t("dashboard.runProgress")}</h2>
          <RunStageList />
        </article>
        <article className="panel">
          <h2>{t("artifact.list")}</h2>
          <p data-testid="artifact-title">
            {localizedScenarioText(scenario.run.artifacts[0]?.name, t) ||
              t("artifact.none")}
          </p>
          {scenario.run.artifacts.length > 0 ? <RiskChart /> : null}
        </article>
      </section>
    </HostShell>
  );
}

export function PortfolioSummary({ scenario }: { scenario: PlutusScenario }) {
  const { locale, t } = useI18n();
  const portfolioName = localizedScenarioText(scenario.portfolio.name, t);
  const portfolioHeading = scenario.portfolio.id
    ? t("portfolio.suffix", { name: portfolioName })
    : portfolioName;
  return (
    <article className="panel" data-testid="portfolio-core">
      <h2>{portfolioHeading}</h2>
      <p data-testid="portfolio-name">{portfolioName}</p>
      <p className="metric">
        {formatCurrency(scenario.portfolio.value, "USD", locale)}
      </p>
      <div className="position-list">
        {scenario.portfolio.positions.map((position) => (
          <div className="row" key={position.symbol}>
            <span>{position.symbol}</span>
            <strong>{position.allocation}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}

export function PortfoliosPage({
  scenario,
  commandClient,
}: {
  scenario: PlutusScenario;
  commandClient?: PlutusCommandClient;
}) {
  const { t } = useI18n();
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [createdPortfolio, setCreatedPortfolio] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const visibleScenario =
    !scenario.portfolio.id && createdPortfolio
      ? {
          ...scenario,
          portfolio: {
            ...scenario.portfolio,
            id: createdPortfolio.id,
            name: createdPortfolio.name,
          },
        }
      : scenario;

  async function createPortfolio() {
    setMessage(null);
    if (!commandClient?.portfolios?.create) {
      setMessage(t("portfolio.bridgeMissing"));
      return;
    }
    setCreating(true);
    try {
      const created = await commandClient.portfolios.create({
        profileId: scenario.profileId,
        name: "Primary Portfolio",
        baseCurrency: "USD",
      });
      if (created.id) {
        setCreatedPortfolio({
          id: created.id,
          name: created.name ?? "Primary Portfolio",
        });
      }
      setMessage(t("portfolio.created", { name: created.name ?? "portfolio" }));
    } catch (error) {
      setMessage(commandErrorMessage(error));
    } finally {
      setCreating(false);
    }
  }

  return (
    <HostShell>
      <h1>{t("portfolio.title")}</h1>
      {!visibleScenario.portfolio.id ? (
        <section className="panel">
          <h2>{t("portfolio.create")}</h2>
          <button
            className="primary"
            onClick={createPortfolio}
            disabled={creating}
          >
            {creating ? t("portfolio.creating") : t("portfolio.create")}
          </button>
        </section>
      ) : null}
      {message ? <p data-testid="portfolio-command-status">{message}</p> : null}
      <PortfolioRows scenario={visibleScenario} />
    </HostShell>
  );
}

export function PortfolioDetailPage({
  scenario,
}: {
  scenario: PlutusScenario;
}) {
  const { t } = useI18n();
  return (
    <HostShell>
      <h1>{localizedScenarioText(scenario.portfolio.name, t)}</h1>
      <PortfolioRows scenario={scenario} />
      <section className="panel">
        <h2>{t("portfolio.thesisNotes")}</h2>
        {scenario.portfolio.positions.map((position) => (
          <p key={position.symbol}>
            <strong>{position.symbol}</strong>: {position.thesis}
          </p>
        ))}
      </section>
    </HostShell>
  );
}

function PortfolioRows({ scenario }: { scenario: PlutusScenario }) {
  const { locale, t } = useI18n();
  return (
    <article className="panel" data-testid="portfolio-core">
      <h2>{localizedScenarioText(scenario.portfolio.name, t)}</h2>
      {scenario.portfolio.positions.map((position) => (
        <div className="row" key={position.symbol}>
          <span>
            {position.symbol} - {position.name}
          </span>
          <strong>{formatCurrency(position.value, "USD", locale)}</strong>
        </div>
      ))}
    </article>
  );
}

export function WatchlistsPage({ scenario }: { scenario: PlutusScenario }) {
  const { t } = useI18n();
  return (
    <HostShell>
      <h1>{t("watchlist.title")}</h1>
      <WatchlistPanel
        scenario={scenario}
        title={localizedScenarioText(scenario.watchlist.name, t)}
      />
    </HostShell>
  );
}

export function WatchlistDetailPage({
  scenario,
}: {
  scenario: PlutusScenario;
}) {
  const { t } = useI18n();
  return (
    <HostShell>
      <h1>{localizedScenarioText(scenario.watchlist.name, t)}</h1>
      <WatchlistPanel scenario={scenario} title={t("watchlist.notes")} />
      <section className="panel">
        <h2>{t("watchlist.editableNotes")}</h2>
        <p>{t("watchlist.noteExample")}</p>
      </section>
    </HostShell>
  );
}

function WatchlistPanel({
  scenario,
  title,
}: {
  scenario: PlutusScenario;
  title: string;
}) {
  return (
    <article className="panel" data-testid="watchlist-default">
      <h2>{title}</h2>
      <div className="pill-row">
        {scenario.watchlist.items.map((item) => (
          <span className="pill" key={item.id ?? item.symbol}>
            {item.symbol}
          </span>
        ))}
      </div>
    </article>
  );
}

export function InstrumentDetailPage({
  scenario,
}: {
  scenario: PlutusScenario;
}) {
  const { t } = useI18n();
  const instrumentName = localizedScenarioText(scenario.instrument.name, t);
  return (
    <HostShell>
      <h1>{scenario.instrument.symbol || t("instrument.empty")}</h1>
      <section className="panel">
        <h2>{scenario.instrument.symbol || instrumentName}</h2>
        <p>{localizedScenarioText(scenario.instrument.summary, t)}</p>
        <RiskChart />
      </section>
    </HostShell>
  );
}

export function RunsPage({
  scenario,
  commandClient,
  refreshScenario,
}: {
  scenario: PlutusScenario;
  commandClient?: PlutusCommandClient;
  refreshScenario?: () => Promise<PlutusScenario>;
}) {
  const { t } = useI18n();
  const [currentScenario, setCurrentScenario] = useState(scenario);
  const [started, setStarted] = useState(false);
  const [pending, setPending] = useState(false);
  const [runStatus, setRunStatus] = useState(
    localizedScenarioText(scenario.run.status, t),
  );
  const [commandSource, setCommandSource] = useState<
    "Command bridge" | "Local runtime"
  >("Local runtime");
  const [commandError, setCommandError] = useState<string | null>(null);

  useEffect(() => {
    setCurrentScenario(scenario);
    setRunStatus(localizedScenarioText(scenario.run.status, t));
  }, [scenario, t]);

  async function startReview() {
    setCommandError(null);
    if (!commandClient || !currentScenario.portfolio.id) {
      setCommandError(t("runs.createFirst"));
      return;
    }

    setPending(true);
    try {
      const run = await commandClient.researchRuns.start({
        profileId: currentScenario.profileId,
        portfolioId: currentScenario.portfolio.id,
        symbols: currentScenario.portfolio.positions.map(
          (position) => position.symbol,
        ),
        selectedTeam: "portfolio_review_committee",
        userRequest: `Start review for ${currentScenario.portfolio.name}`,
      });
      const refreshedScenario = refreshScenario
        ? await refreshScenario()
        : currentScenario;
      setCurrentScenario(refreshedScenario);
      setStarted(true);
      setRunStatus(
        localizedScenarioText(
          commandStatusLabel(run.status, refreshedScenario.run.status),
          t,
        ),
      );
      setCommandSource("Command bridge");
      if (refreshScenario) {
        for (let attempt = 0; attempt < 5; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 400));
          const updatedScenario = await refreshScenario();
          setCurrentScenario(updatedScenario);
          setRunStatus(
            localizedScenarioText(
              commandStatusLabel(run.status, updatedScenario.run.status),
              t,
            ),
          );
          if (
            updatedScenario.run.category ||
            ["completed", "failed", "cancelled"].includes(
              updatedScenario.run.status,
            )
          ) {
            break;
          }
        }
      }
    } catch (error) {
      setCommandError(commandErrorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <HostShell>
      <h1>{t("runs.title")}</h1>
      <h2>{t("runs.title")}</h2>
      <button
        className="primary"
        onClick={startReview}
        disabled={pending || !currentScenario.portfolio.id}
      >
        {pending ? t("runs.starting") : t("runs.start")}
      </button>
      {commandError ? (
        <section className="risk-warning" data-testid="command-error">
          {commandError}
        </section>
      ) : null}
      <section className="panel run-panel">
        {started ? (
          <>
            <div data-testid="run-progress">{runStatus}</div>
            <div data-testid="command-source">
              {localizedCommandSource(commandSource, t)}
            </div>
          </>
        ) : (
          <RunStageList />
        )}
        {currentScenario.run.category ? <RiskWarning /> : null}
        <FinalRunCard
          run={currentScenario.run}
          started={started}
          status={runStatus}
        />
        <ArtifactList scenario={currentScenario} />
      </section>
      <section className="panel">
        <h2>{t("memory.short")}</h2>
        <p>
          {currentScenario.memory.summary
            ? `${currentScenario.memory.activity}: ${currentScenario.memory.summary}`
            : t("memory.empty")}
        </p>
      </section>
      <section className="panel">
        <h2>{t("wiki.short")}</h2>
        <p>
          {currentScenario.wiki.title
            ? `${currentScenario.wiki.title} with source-linked revision history.`
            : t("wiki.empty")}
        </p>
      </section>
    </HostShell>
  );
}

function FinalRunCard({
  run,
  started,
  status,
}: {
  run: PlutusScenario["run"];
  started?: boolean;
  status: string;
}) {
  const card = run.finalCard;
  const evidence = card?.supportingEvidence ?? [];
  const checklist = card?.riskChecklist ?? [];
  const { t } = useI18n();
  return (
    <div data-testid="final-run-card" className="final-card">
      <strong>
        {started ? t("runs.status", { status }) : ""}
        {t("runs.finalCategory", {
          category: run.category || t("common.none"),
        })}
      </strong>
      {run.confidence ? (
        <span>{t("runs.confidence", { confidence: run.confidence })}</span>
      ) : null}
      {card?.summary ? <p>{card.summary}</p> : null}
      {evidence.length > 0 ? (
        <ul>
          {evidence.slice(0, 3).map((item, index) => (
            <li key={`${item.sourceRef ?? item.label ?? index}`}>
              {item.label ?? item.sourceRef}
            </li>
          ))}
        </ul>
      ) : null}
      {checklist.length > 0 ? (
        <p>
          {t("runs.riskChecks", {
            checks: checklist
              .slice(0, 3)
              .map(
                (item) =>
                  `${item.check ?? t("common.check")}=${item.status ?? t("common.unknown")}`,
              )
              .join(", "),
          })}
        </p>
      ) : null}
      {card?.limitations?.length ? (
        <p>
          {t("runs.limitations", { limitations: card.limitations.join("; ") })}
        </p>
      ) : null}
      {card?.nextActions?.length ? (
        <p>{t("runs.next", { next: card.nextActions.join("; ") })}</p>
      ) : null}
    </div>
  );
}

function RunStageList() {
  const { t } = useI18n();
  const stages = [
    ["planning", t("stage.planning")],
    ["grounding", t("stage.grounding")],
    ["executing", t("stage.executing")],
    ["debating", t("stage.debating")],
    ["validating", t("stage.validating")],
    ["reporting", t("stage.reporting")],
    ["completed", t("stage.completed")],
  ] as const;
  return (
    <ol data-testid="run-progress">
      {stages.map(([stage, label]) => (
        <li key={stage}>{label}</li>
      ))}
    </ol>
  );
}

export function RunDetailPage({ scenario }: { scenario: PlutusScenario }) {
  const { t } = useI18n();
  return (
    <HostShell>
      <h1>{localizedScenarioText(scenario.run.title, t)}</h1>
      <RiskChart />
      <RiskWarning />
      {scenario.run.finalCard ? (
        <FinalRunCard
          run={scenario.run}
          status={localizedScenarioText(scenario.run.status, t)}
        />
      ) : null}
      <ArtifactList scenario={scenario} />
    </HostShell>
  );
}

export function ArtifactDetailPage({
  scenario,
  commandClient,
  artifactId = scenario.run.artifacts[0]?.id ?? "",
  runId = scenario.run.id,
}: {
  scenario: PlutusScenario;
  commandClient?: PlutusCommandClient;
  artifactId?: string;
  runId?: string;
}) {
  const { t } = useI18n();
  const fallbackArtifact = artifactId
    ? (scenario.run.artifacts.find(
        (artifact) => artifact.id === artifactId,
      ) ?? { id: "", name: t("empty.artifact"), type: "" })
    : (scenario.run.artifacts[0] ?? {
        id: "",
        name: t("empty.artifact"),
        type: "",
      });
  const [artifactName, setArtifactName] = useState(
    localizedScenarioText(fallbackArtifact.name, t),
  );
  const [commandSource, setCommandSource] = useState<
    "Command bridge" | "Local runtime"
  >("Local runtime");

  useEffect(() => {
    if (!commandClient) return;
    let active = true;
    commandClient.artifacts
      .get(artifactId, { profileId: scenario.profileId, runId })
      .then((artifact) => {
        if (!active) return;
        setArtifactName(
          localizedScenarioText(
            artifact.title ?? artifact.name ?? fallbackArtifact.name,
            t,
          ),
        );
        setCommandSource("Command bridge");
      })
      .catch(() => {
        if (active) setCommandSource("Local runtime");
      });
    return () => {
      active = false;
    };
  }, [
    artifactId,
    commandClient,
    fallbackArtifact.name,
    runId,
    scenario.profileId,
  ]);

  return (
    <HostShell>
      <h1>{artifactName}</h1>
      {scenario.run.category ? <RiskWarning /> : null}
      <p data-testid="artifact-command-source">
        {localizedCommandSource(commandSource, t)}
      </p>
      <p data-testid="artifact-command-title">{artifactName}</p>
      <p>{t("artifact.generated")}</p>
    </HostShell>
  );
}

export function StrategiesPage() {
  const { t } = useI18n();
  return (
    <HostShell>
      <h1>{t("strategies.title")}</h1>
      <section className="panel">
        <h2>{t("strategies.specs")}</h2>
        <p>{t("strategies.body")}</p>
      </section>
    </HostShell>
  );
}

export function MemoryPage({
  scenario,
  commandClient,
}: {
  scenario: PlutusScenario;
  commandClient?: PlutusCommandClient;
}) {
  const { t } = useI18n();
  const [commandStatus, setCommandStatus] = useState("Ready");
  async function runMemoryCommand(
    action: "edit" | "pin" | "archive" | "forget",
  ) {
    if (!commandClient?.memory) {
      setCommandStatus("No command bridge connected");
      return;
    }
    try {
      if (action === "edit") {
        await commandClient.memory.update(
          scenario.memory.id,
          {
            summary: scenario.memory.summary,
          },
          { profileId: scenario.profileId },
        );
      } else if (action === "pin") {
        await commandClient.memory.setCategoryEnabled("research_memory", true);
      } else if (action === "archive") {
        await commandClient.memory.archive(
          scenario.memory.id,
          t("memory.archiveReason"),
          { profileId: scenario.profileId },
        );
      } else {
        await commandClient.memory.forget(scenario.memory.id, {
          profileId: scenario.profileId,
        });
      }
      setCommandStatus(`Command bridge: memory.${action}`);
    } catch (error) {
      setCommandStatus(commandErrorMessage(error));
    }
  }
  async function toggleMemoryCategory(category: string, enabled: boolean) {
    if (!commandClient?.memory) {
      setCommandStatus("No command bridge connected");
      return;
    }
    try {
      await commandClient.memory.setCategoryEnabled(category, enabled);
      setCommandStatus(`Command bridge: memory.${category}.${enabled}`);
    } catch (error) {
      setCommandStatus(commandErrorMessage(error));
    }
  }
  return (
    <HostShell>
      <h1>{t("memory.title")}</h1>
      <section className="grid two">
        <article className="panel" data-testid="memory-activity-feed">
          <h2>{t("memory.feed")}</h2>
          <p>
            {localizedScenarioText(scenario.memory.activity, t)}:{" "}
            {scenario.memory.summary}
          </p>
          <p data-testid="memory-command-status">
            {localizedCommandStatus(commandStatus, t)}
          </p>
          <div className="button-row">
            <button
              className="secondary"
              onClick={() => void runMemoryCommand("edit")}
            >
              {t("memory.edit")}
            </button>
            <button
              className="secondary"
              onClick={() => void runMemoryCommand("pin")}
            >
              {t("memory.pin")}
            </button>
            <button
              className="secondary"
              onClick={() => void runMemoryCommand("archive")}
            >
              {t("memory.archive")}
            </button>
            <button
              className="secondary"
              onClick={() => void runMemoryCommand("forget")}
            >
              {t("memory.forget")}
            </button>
          </div>
        </article>
        <article className="panel">
          <h2>{t("memory.categories")}</h2>
          <label className="toggle-row">
            <input
              type="checkbox"
              defaultChecked
              onChange={(event) =>
                void toggleMemoryCategory(
                  "research_memory",
                  event.currentTarget.checked,
                )
              }
            />
            {t("memory.researchCapture")}
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              defaultChecked
              onChange={(event) =>
                void toggleMemoryCategory(
                  "wiki_pointer",
                  event.currentTarget.checked,
                )
              }
            />
            {t("memory.wikiPointer")}
          </label>
        </article>
      </section>
    </HostShell>
  );
}

export function WikiPage({
  scenario,
  detail,
  commandClient,
}: {
  scenario: PlutusScenario;
  detail: boolean;
  commandClient?: PlutusCommandClient;
}) {
  const { t } = useI18n();
  const [commandStatus, setCommandStatus] = useState("Ready");
  async function revertRevision() {
    if (!commandClient?.wiki) {
      setCommandStatus("No command bridge connected");
      return;
    }
    try {
      await commandClient.wiki.revertRevision(
        scenario.wiki.id,
        scenario.wiki.revision,
        t("wiki.revertReason"),
      );
      setCommandStatus("Command bridge: wiki.revertRevision");
    } catch (error) {
      setCommandStatus(commandErrorMessage(error));
    }
  }
  return (
    <HostShell>
      <h1>
        {detail ? scenario.wiki.title || t("wiki.page") : t("wiki.browser")}
      </h1>
      <section className="grid two">
        <article className="panel">
          <h2>{t("wiki.feed")}</h2>
          <p>{t("wiki.feedBody")}</p>
        </article>
        <article className="panel" data-testid="wiki-revision-timeline">
          <h2>{t("wiki.revisionTimeline")}</h2>
          <p>{t("wiki.revision", { revision: scenario.wiki.revision })}</p>
          <p>audit: audit-wiki-btc-nvda-revision</p>
          <p data-testid="wiki-command-status">
            {localizedCommandStatus(commandStatus, t)}
          </p>
          <button className="secondary" onClick={() => void revertRevision()}>
            {t("wiki.revert")}
          </button>
        </article>
        <article className="panel" data-testid="source-link-drawer">
          <h2>{t("wiki.sourceLinks")}</h2>
          <p>{scenario.wiki.sourceRef}</p>
        </article>
        <article className="panel" data-testid="wiki-diff-view">
          <h2>{t("wiki.diff")}</h2>
          <p>{t("wiki.diffBody")}</p>
        </article>
      </section>
    </HostShell>
  );
}

export function SettingsPage({ title }: { title: string }) {
  const { t } = useI18n();
  const localizedTitle = localizedScenarioText(title, t);
  return (
    <HostShell>
      <h1>{localizedTitle}</h1>
      <section className="panel">
        <p>{t("settings.preview")}</p>
      </section>
    </HostShell>
  );
}

export function NotFoundPage() {
  const { t } = useI18n();
  return (
    <HostShell>
      <h1>{t("notFound.title")}</h1>
      <section className="panel" data-testid="not-found">
        <p>{t("notFound.body")}</p>
      </section>
    </HostShell>
  );
}

export function RemoteControlSettingsPage({
  scenario,
}: {
  scenario: PlutusScenario;
}) {
  const { t } = useI18n();
  const hasPairedDevice = Boolean(scenario.remoteDevice.sessionId);
  return (
    <HostShell>
      <h1>{t("remote.control")}</h1>
      <section className="panel">
        <div className="row">
          <span>{t("remote.status")}</span>
          <strong>
            {hasPairedDevice ? t("remote.enabled") : t("remote.notPaired")}
          </strong>
        </div>
        <div className="row">
          <span>{t("remote.pairingCode")}</span>
          <strong data-testid="pairing-code">
            {localizedScenarioText(scenario.remoteDevice.pairingCode, t)}
          </strong>
        </div>
        <div className="row">
          <span>{t("remote.connectedDevice")}</span>
          <strong>
            {localizedScenarioText(scenario.remoteDevice.name, t)}
          </strong>
        </div>
        {hasPairedDevice ? (
          <button className="secondary">
            {t("remote.revoke", {
              device: localizedScenarioText(scenario.remoteDevice.name, t),
            })}
          </button>
        ) : (
          <p>{t("remote.noDeviceAction")}</p>
        )}
      </section>
    </HostShell>
  );
}

export function PairPage({ scenario }: { scenario: PlutusScenario }) {
  const { t } = useI18n();
  return (
    <MobileShell>
      <h1>{t("remote.pair")}</h1>
      <section className="panel">
        <p>{t("remote.pairBody")}</p>
        <div className="pair-code">
          {localizedScenarioText(scenario.remoteDevice.pairingCode, t)}
        </div>
      </section>
    </MobileShell>
  );
}

export function RemoteStateBanner({ remote }: { remote: RemoteVisualState }) {
  const { locale } = useI18n();
  const label = remoteStateLabel(remote, locale);
  return (
    <>
      <section className={`remote-state ${remote}`} data-testid="remote-state">
        {label}
      </section>
      <span data-testid="connection-state">{label}</span>
    </>
  );
}

export function ConnectionPage({ remote }: { remote: RemoteVisualState }) {
  const { t } = useI18n();
  return (
    <MobileShell>
      <h1>{t("remote.connection")}</h1>
      <RemoteStateBanner remote={remote} />
      <section className="panel">
        <p>{t("remote.hostIdentity")}</p>
        <p>{t("remote.heartbeat")}</p>
      </section>
    </MobileShell>
  );
}

export function RemoteDashboardPage({
  scenario,
  remote,
  commandClient,
}: {
  scenario: PlutusScenario;
  remote: RemoteVisualState;
  commandClient?: PlutusCommandClient;
}) {
  const { t } = useI18n();
  const disabled =
    remote !== "connected" ||
    !scenario.portfolio.id ||
    (!scenario.remoteDevice.unlockProof &&
      !commandClient?.remote?.prepareUnlock) ||
    !commandClient?.remote?.executeCommand;
  const [pending, setPending] = useState(false);
  const [commandSource, setCommandSource] = useState<string | null>(null);
  const [commandError, setCommandError] = useState<string | null>(null);

  async function startRemoteReview() {
    setCommandError(null);
    if (!commandClient?.remote?.executeCommand) {
      setCommandSource(t("remote.noBridge"));
      return;
    }
    if (!scenario.portfolio.id) {
      setCommandError(t("runs.createFirst"));
      return;
    }
    const commandId =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `cmd-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setPending(true);
    try {
      const payload = {
        portfolioId: scenario.portfolio.id,
        symbols: scenario.portfolio.positions.map(
          (position) => position.symbol,
        ),
        selectedTeam: "portfolio_review_committee",
        userRequest: `Start remote review for ${scenario.portfolio.name}`,
      };
      const credentials = await remoteCommandCredentials(
        commandClient,
        scenario,
        commandId,
        "run.start",
        payload,
      );
      if (!credentials) {
        setCommandError(t("remote.unlockRequired"));
        return;
      }
      await commandClient.remote.executeCommand(
        buildRemoteCommand({
          commandId,
          commandType: "run.start",
          sessionId: credentials.sessionId,
          sessionKeyRef: credentials.sessionKeyRef,
          unlockProof: credentials.unlockProof,
          payload,
        }),
      );
      setCommandSource("Command bridge");
    } catch (error) {
      setCommandError(commandErrorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <MobileShell>
      <h1>{t("remote.dashboard")}</h1>
      <RemoteStateBanner remote={remote} />
      {remote === "revoked" ? (
        <section className="risk-warning" data-testid="remote-command-error">
          {t("remote.revoked")}
        </section>
      ) : null}
      <article className="panel" data-testid="portfolio-core">
        <p>{t("remote.controller")}</p>
        <p>
          {localizedScenarioText(scenario.portfolio.name, t)}:{" "}
          {scenario.portfolio.positions
            .map((position) => position.symbol)
            .join(", ") || t("remote.noPositions")}
        </p>
        <button
          className="primary"
          data-testid="remote-command"
          aria-label={t("runs.start")}
          disabled={disabled || pending}
          onClick={startRemoteReview}
        >
          {pending
            ? t("remote.starting")
            : remote === "revoked"
              ? t("remote.denied")
              : t("remote.start")}
        </button>
        {commandSource ? (
          <p data-testid="remote-command-status">
            {localizedCommandSource(commandSource, t)}
          </p>
        ) : null}
        {commandError ? (
          <p data-testid="remote-command-status">{commandError}</p>
        ) : null}
      </article>
    </MobileShell>
  );
}

export function RemotePortfolioPage({
  scenario,
  remote,
  commandClient,
}: {
  scenario: PlutusScenario;
  remote: RemoteVisualState;
  commandClient?: PlutusCommandClient;
}) {
  const { t } = useI18n();
  const [status, setStatus] = useState<string | null>(null);
  const firstPosition = scenario.portfolio.positions[0];
  const [thesis, setThesis] = useState(firstPosition?.thesis ?? "");
  useEffect(() => {
    setThesis(firstPosition?.thesis ?? "");
  }, [firstPosition?.id, firstPosition?.thesis]);
  const disabled =
    remote !== "connected" ||
    !firstPosition?.id ||
    (!scenario.remoteDevice.unlockProof &&
      !commandClient?.remote?.prepareUnlock) ||
    !commandClient?.remote?.executeCommand;
  const thesisLabel = firstPosition
    ? t("portfolio.symbolThesis", { symbol: firstPosition.symbol })
    : t("portfolio.positionThesis");

  async function saveThesis() {
    if (!firstPosition?.id || !commandClient?.remote?.executeCommand) {
      setStatus(t("portfolio.noEditable"));
      return;
    }
    const commandId =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `cmd-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      const payload = {
        positionId: firstPosition.id,
        thesis,
      };
      const credentials = await remoteCommandCredentials(
        commandClient,
        scenario,
        commandId,
        "portfolio.updatePositionThesis",
        payload,
      );
      if (!credentials) {
        setStatus(t("remote.unlockRequired"));
        return;
      }
      await commandClient.remote.executeCommand(
        buildRemoteCommand({
          commandId,
          commandType: "portfolio.updatePositionThesis",
          sessionId: credentials.sessionId,
          sessionKeyRef: credentials.sessionKeyRef,
          unlockProof: credentials.unlockProof,
          payload,
        }),
      );
      setStatus(t("remote.savedThesis"));
    } catch (error) {
      setStatus(commandErrorMessage(error));
    }
  }

  return (
    <MobileShell>
      <h1>{t("remote.portfolio")}</h1>
      <RemoteStateBanner remote={remote} />
      <PortfolioSummary scenario={scenario} />
      <section className="panel">
        <h2>{t("remote.thesisEdit")}</h2>
        <label className="field-row">
          {thesisLabel}
          <textarea
            aria-label={thesisLabel}
            value={thesis}
            onChange={(event) => setThesis(event.currentTarget.value)}
            disabled={disabled}
          />
        </label>
        <button className="secondary" disabled={disabled} onClick={saveThesis}>
          {t("remote.saveThesis")}
        </button>
        {status ? <p data-testid="remote-edit-status">{status}</p> : null}
      </section>
    </MobileShell>
  );
}

export function RemoteWatchlistPage({
  scenario,
  remote,
  commandClient,
}: {
  scenario: PlutusScenario;
  remote: RemoteVisualState;
  commandClient?: PlutusCommandClient;
}) {
  const { t } = useI18n();
  const firstItem = scenario.watchlist.items[0];
  const [note, setNote] = useState(firstItem?.triggerNote ?? "");
  const [status, setStatus] = useState<string | null>(null);
  useEffect(() => {
    setNote(firstItem?.triggerNote ?? "");
  }, [firstItem?.id, firstItem?.triggerNote]);
  const disabled =
    remote !== "connected" ||
    !firstItem?.id ||
    (!scenario.remoteDevice.unlockProof &&
      !commandClient?.remote?.prepareUnlock) ||
    !commandClient?.remote?.executeCommand;
  const noteLabel = firstItem
    ? t("watchlist.symbolNote", { symbol: firstItem.symbol })
    : t("watchlist.itemNote");
  async function saveNote() {
    if (!firstItem?.id || !commandClient?.remote?.executeCommand) {
      setStatus(t("watchlist.noEditable"));
      return;
    }
    const commandId =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `cmd-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      const payload = {
        itemId: firstItem.id,
        triggerNote: note,
      };
      const credentials = await remoteCommandCredentials(
        commandClient,
        scenario,
        commandId,
        "watchlist.updateItem",
        payload,
      );
      if (!credentials) {
        setStatus(t("remote.unlockRequired"));
        return;
      }
      await commandClient.remote.executeCommand(
        buildRemoteCommand({
          commandId,
          commandType: "watchlist.updateItem",
          sessionId: credentials.sessionId,
          sessionKeyRef: credentials.sessionKeyRef,
          unlockProof: credentials.unlockProof,
          payload,
        }),
      );
      setStatus(t("remote.savedWatchlist"));
    } catch (error) {
      setStatus(commandErrorMessage(error));
    }
  }
  return (
    <MobileShell>
      <h1>{t("remote.watchlist")}</h1>
      <RemoteStateBanner remote={remote} />
      <WatchlistPanel
        scenario={scenario}
        title={localizedScenarioText(scenario.watchlist.name, t)}
      />
      <section className="panel">
        <h2>{t("remote.noteEdit")}</h2>
        <label className="field-row">
          {noteLabel}
          <textarea
            aria-label={noteLabel}
            value={note}
            onChange={(event) => setNote(event.currentTarget.value)}
            disabled={disabled}
          />
        </label>
        <button className="secondary" disabled={disabled} onClick={saveNote}>
          {t("remote.saveWatchlist")}
        </button>
        {status ? <p data-testid="remote-watchlist-status">{status}</p> : null}
      </section>
    </MobileShell>
  );
}

export function RemoteInstrumentPage({
  scenario,
  remote,
}: {
  scenario: PlutusScenario;
  remote: RemoteVisualState;
}) {
  const { t } = useI18n();
  const instrumentName = localizedScenarioText(scenario.instrument.name, t);
  return (
    <MobileShell>
      <h1>{t("remote.instrument")}</h1>
      <RemoteStateBanner remote={remote} />
      <section className="panel">
        <h2>{scenario.instrument.symbol || instrumentName}</h2>
        <p>{localizedScenarioText(scenario.instrument.summary, t)}</p>
        <RiskChart />
      </section>
    </MobileShell>
  );
}

export function RemoteRunsPage({
  scenario,
  remote,
}: {
  scenario: PlutusScenario;
  remote: RemoteVisualState;
}) {
  const { t } = useI18n();
  return (
    <MobileShell>
      <h1>{t("remote.runs")}</h1>
      <RemoteStateBanner remote={remote} />
      <section className="panel">
        <p>{localizedScenarioText(scenario.run.title, t)}</p>
        <RiskWarning />
      </section>
    </MobileShell>
  );
}

export function RemoteRunDetailPage({
  scenario,
  remote,
}: {
  scenario: PlutusScenario;
  remote: RemoteVisualState;
}) {
  const { t } = useI18n();
  return (
    <MobileShell>
      <h1>{t("remote.runDetail")}</h1>
      <RemoteStateBanner remote={remote} />
      <section className="panel">
        <p>{localizedScenarioText(scenario.run.status, t)}</p>
        <RunStageList />
        <button className="secondary" disabled={remote !== "connected"}>
          {t("remote.cancelRun")}
        </button>
      </section>
    </MobileShell>
  );
}

export function RemoteArtifactPage({ remote }: { remote: RemoteVisualState }) {
  const { t } = useI18n();
  return (
    <MobileShell>
      <h1>{t("remote.artifact")}</h1>
      <RemoteStateBanner remote={remote} />
      <section className="panel">
        <RiskChart />
        <p>{t("remote.artifactSummary")}</p>
      </section>
    </MobileShell>
  );
}

export function RemoteMemoryPage({
  scenario,
  remote,
}: {
  scenario: PlutusScenario;
  remote: RemoteVisualState;
}) {
  const { t } = useI18n();
  return (
    <MobileShell>
      <h1>{t("remote.memory")}</h1>
      <RemoteStateBanner remote={remote} />
      <section className="panel" data-testid="memory-activity-feed">
        <p>{scenario.memory.summary}</p>
        <p>{t("remote.readOnlyMobile")}</p>
      </section>
    </MobileShell>
  );
}

export function RemoteWikiPage({
  scenario,
  remote,
  detail,
}: {
  scenario: PlutusScenario;
  remote: RemoteVisualState;
  detail: boolean;
}) {
  const { t } = useI18n();
  return (
    <MobileShell>
      <h1>{detail ? t("remote.wikiPage") : t("remote.wiki")}</h1>
      <RemoteStateBanner remote={remote} />
      <section className="panel">
        <h2>{scenario.wiki.title}</h2>
        <p>{t("remote.readOnlyWiki")}</p>
      </section>
    </MobileShell>
  );
}

export function RemoteSettingsPage({ remote }: { remote: RemoteVisualState }) {
  const { t } = useI18n();
  return (
    <MobileShell>
      <h1>{t("remote.settings")}</h1>
      <RemoteStateBanner remote={remote} />
      <section className="panel">
        <p>{t("remote.biometricRequired")}</p>
      </section>
    </MobileShell>
  );
}
