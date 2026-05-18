import { useEffect, useState, type ReactNode } from "react";
import {
  formatCurrency,
  remoteStateLabel,
  type RemoteVisualState,
} from "./core";

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
  const runtime = search.get("runtime");
  return runtime ? `?runtime=${encodeURIComponent(runtime)}` : "";
}

function currentRuntimeParam() {
  if (typeof window === "undefined") return null;
  return new URL(window.location.href).searchParams.get("runtime");
}

function withRemoteQuery(path: string, remote: string) {
  const params = new URLSearchParams({ remote });
  const runtime = currentRuntimeParam();
  if (runtime) params.set("runtime", runtime);
  return `${path}?${params.toString()}`;
}

export function HostShell({ children }: HostShellProps) {
  const runtimeSearch = preserveRuntimeSearch();
  return (
    <main
      className="app-shell"
      data-testid="route-surface"
      data-route-kind="host"
    >
      <aside className="sidebar" aria-label="Primary navigation">
        <strong>Plutus</strong>
        <nav>
          <a href={`/dashboard${runtimeSearch}`}>Dashboard</a>
          <a href={`/portfolios${runtimeSearch}`}>Portfolios</a>
          <a href={`/watchlists${runtimeSearch}`}>Watchlists</a>
          <a href={`/runs${runtimeSearch}`}>Runs</a>
          <a href={`/memory${runtimeSearch}`}>Memory</a>
          <a href={`/wiki${runtimeSearch}`}>Wiki</a>
          <a href={`/settings/remote-control${runtimeSearch}`}>Remote</a>
        </nav>
      </aside>
      <section className="main-surface">{children}</section>
    </main>
  );
}

export function MobileShell({ children }: { children: ReactNode }) {
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
      <nav className="mobile-tabs" aria-label="Remote navigation">
        <a href={withRemoteQuery("/remote/dashboard", remote)}>Home</a>
        <a href={withRemoteQuery("/remote/runs", remote)}>Runs</a>
        <a href={withRemoteQuery("/remote/settings", remote)}>Settings</a>
      </nav>
      {children}
    </main>
  );
}

export function RuntimeUnavailablePage() {
  return (
    <HostShell>
      <section className="panel" data-testid="runtime-unavailable">
        <h1>Local Runtime Required</h1>
        <p>
          No local Plutus runtime bridge is connected. Start the Tauri app or
          enable the browser local runtime bridge to load real app state.
        </p>
      </section>
    </HostShell>
  );
}

export function RiskWarning() {
  return (
    <section className="risk-warning" data-testid="risk-warning">
      <strong>Risk warning</strong>
      <span>
        BTC and NVDA combined exposure exceeds the review threshold. Inspect
        concentration, correlation, stale quote data, and liquidity assumptions
        before any rebalance candidate is considered. Past performance does not
        guarantee future results.
      </span>
    </section>
  );
}

export function RiskChart() {
  return (
    <div
      className="chart"
      data-testid="artifact-chart"
      data-rendered="true"
      aria-label="BTC and NVDA exposure chart"
    >
      <svg
        data-testid="risk-chart"
        viewBox="0 0 320 120"
        role="img"
        aria-label="BTC and NVDA exposure line chart"
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
      <span style={{ height: "38%" }}>Cash</span>
    </div>
  );
}

export function ArtifactList({ scenario }: { scenario: PlutusScenario }) {
  return (
    <section className="artifact-list" data-testid="artifact-list">
      <h2>Artifacts</h2>
      {scenario.run.artifacts.map((artifact) => (
        <a
          key={artifact.id}
          href={`/runs/${scenario.run.id}/artifacts/${artifact.id}${preserveRuntimeSearch()}`}
          aria-label={`Open ${artifact.name}`}
        >
          {artifact.name}
        </a>
      ))}
    </section>
  );
}

export function HostDashboard({ scenario }: { scenario: PlutusScenario }) {
  return (
    <HostShell>
      <header className="page-header">
        <p className="eyebrow">Local runtime</p>
        <h1>Plutus Research Desk</h1>
        <h2>Host Dashboard</h2>
      </header>
      <section className="grid two">
        <PortfolioSummary scenario={scenario} />
        {scenario.run.category ? (
          <article className="panel">
            <h2>Current guardrail</h2>
            <RiskWarning />
          </article>
        ) : null}
        <article className="panel">
          <h2>Run Progress</h2>
          <RunStageList />
        </article>
        <article className="panel">
          <h2>Artifacts</h2>
          <p data-testid="artifact-title">
            {scenario.run.artifacts[0]?.name ?? "No artifacts yet"}
          </p>
          {scenario.run.artifacts.length > 0 ? <RiskChart /> : null}
        </article>
      </section>
    </HostShell>
  );
}

export function PortfolioSummary({ scenario }: { scenario: PlutusScenario }) {
  return (
    <article className="panel" data-testid="portfolio-core">
      <h2>{scenario.portfolio.name} portfolio</h2>
      <p data-testid="portfolio-name">{scenario.portfolio.name}</p>
      <p className="metric">{formatCurrency(scenario.portfolio.value)}</p>
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
      setMessage("No command bridge connected");
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
      setMessage(`Created ${created.name ?? "portfolio"}`);
    } catch (error) {
      setMessage(commandErrorMessage(error));
    } finally {
      setCreating(false);
    }
  }

  return (
    <HostShell>
      <h1>Portfolios</h1>
      {!visibleScenario.portfolio.id ? (
        <section className="panel">
          <h2>Create Portfolio</h2>
          <button
            className="primary"
            onClick={createPortfolio}
            disabled={creating}
          >
            {creating ? "Creating Portfolio" : "Create Portfolio"}
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
  return (
    <HostShell>
      <h1>{scenario.portfolio.name}</h1>
      <PortfolioRows scenario={scenario} />
      <section className="panel">
        <h2>Position Thesis Notes</h2>
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
  return (
    <article className="panel" data-testid="portfolio-core">
      <h2>{scenario.portfolio.name}</h2>
      {scenario.portfolio.positions.map((position) => (
        <div className="row" key={position.symbol}>
          <span>
            {position.symbol} - {position.name}
          </span>
          <strong>{formatCurrency(position.value)}</strong>
        </div>
      ))}
    </article>
  );
}

export function WatchlistsPage({ scenario }: { scenario: PlutusScenario }) {
  return (
    <HostShell>
      <h1>Watchlists</h1>
      <WatchlistPanel scenario={scenario} title={scenario.watchlist.name} />
    </HostShell>
  );
}

export function WatchlistDetailPage({
  scenario,
}: {
  scenario: PlutusScenario;
}) {
  return (
    <HostShell>
      <h1>{scenario.watchlist.name}</h1>
      <WatchlistPanel scenario={scenario} title="Watchlist Notes" />
      <section className="panel">
        <h2>Editable Notes</h2>
        <p>NVDA note: validate AI capex assumptions before the next run.</p>
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
  return (
    <HostShell>
      <h1>{scenario.instrument.symbol || "Instrument"}</h1>
      <section className="panel">
        <h2>
          {scenario.instrument.symbol} - {scenario.instrument.name}
        </h2>
        <p>{scenario.instrument.summary}</p>
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
  const [currentScenario, setCurrentScenario] = useState(scenario);
  const [started, setStarted] = useState(false);
  const [pending, setPending] = useState(false);
  const [runStatus, setRunStatus] = useState(scenario.run.status);
  const [commandSource, setCommandSource] = useState<
    "Command bridge" | "Local runtime"
  >("Local runtime");
  const [commandError, setCommandError] = useState<string | null>(null);

  useEffect(() => {
    setCurrentScenario(scenario);
    setRunStatus(scenario.run.status);
  }, [scenario]);

  async function startReview() {
    setCommandError(null);
    if (!commandClient || !currentScenario.portfolio.id) {
      setCommandError("Create a portfolio before starting a research run.");
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
        commandStatusLabel(run.status, refreshedScenario.run.status),
      );
      setCommandSource("Command bridge");
      if (refreshScenario) {
        for (let attempt = 0; attempt < 5; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 400));
          const updatedScenario = await refreshScenario();
          setCurrentScenario(updatedScenario);
          setRunStatus(
            commandStatusLabel(run.status, updatedScenario.run.status),
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
      <h1>Research Runs</h1>
      <h2>Research Runs</h2>
      <button
        className="primary"
        onClick={startReview}
        disabled={pending || !currentScenario.portfolio.id}
      >
        {pending ? "Starting Research Run" : "Start Research Run"}
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
            <div data-testid="command-source">{commandSource}</div>
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
        <h2>Memory</h2>
        <p>
          {currentScenario.memory.summary
            ? `${currentScenario.memory.activity}: ${currentScenario.memory.summary}`
            : "No memory captured yet."}
        </p>
      </section>
      <section className="panel">
        <h2>Wiki</h2>
        <p>
          {currentScenario.wiki.title
            ? `${currentScenario.wiki.title} with source-linked revision history.`
            : "No wiki pages captured yet."}
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
  return (
    <div data-testid="final-run-card" className="final-card">
      <strong>
        {started ? `Run status: ${status}; ` : ""}
        Final category: {run.category || "none"}
      </strong>
      {run.confidence ? <span>Confidence: {run.confidence}</span> : null}
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
          Risk checks:{" "}
          {checklist
            .slice(0, 3)
            .map(
              (item) => `${item.check ?? "check"}=${item.status ?? "unknown"}`,
            )
            .join(", ")}
        </p>
      ) : null}
      {card?.limitations?.length ? (
        <p>Limitations: {card.limitations.join("; ")}</p>
      ) : null}
      {card?.nextActions?.length ? (
        <p>Next: {card.nextActions.join("; ")}</p>
      ) : null}
    </div>
  );
}

function RunStageList() {
  return (
    <ol data-testid="run-progress">
      {[
        "planning",
        "grounding",
        "executing",
        "debating",
        "validating",
        "reporting",
        "completed",
      ].map((stage) => (
        <li key={stage}>{stage}</li>
      ))}
    </ol>
  );
}

export function RunDetailPage({ scenario }: { scenario: PlutusScenario }) {
  return (
    <HostShell>
      <h1>{scenario.run.title}</h1>
      <RiskChart />
      <RiskWarning />
      {scenario.run.finalCard ? (
        <FinalRunCard run={scenario.run} status={scenario.run.status} />
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
  const fallbackArtifact = artifactId
    ? (scenario.run.artifacts.find(
        (artifact) => artifact.id === artifactId,
      ) ?? { id: "", name: "No artifact", type: "" })
    : (scenario.run.artifacts[0] ?? { id: "", name: "No artifact", type: "" });
  const [artifactName, setArtifactName] = useState(fallbackArtifact.name);
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
          artifact.title ?? artifact.name ?? fallbackArtifact.name,
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
      <p data-testid="artifact-command-source">{commandSource}</p>
      <p data-testid="artifact-command-title">{artifactName}</p>
      <p>
        Generated locally in the Mac app data directory and opened through the
        typed artifact command.
      </p>
    </HostShell>
  );
}

export function StrategiesPage() {
  return (
    <HostShell>
      <h1>Strategies</h1>
      <section className="panel">
        <h2>Strategy Specs</h2>
        <p>Risk trim strategy spec generated from the completed run.</p>
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
          "Archived from memory activity surface.",
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
      <h1>Memory Activity</h1>
      <section className="grid two">
        <article className="panel" data-testid="memory-activity-feed">
          <h2>Activity Feed</h2>
          <p>
            {scenario.memory.activity}: {scenario.memory.summary}
          </p>
          <p data-testid="memory-command-status">{commandStatus}</p>
          <div className="button-row">
            <button
              className="secondary"
              onClick={() => void runMemoryCommand("edit")}
            >
              Edit memory
            </button>
            <button
              className="secondary"
              onClick={() => void runMemoryCommand("pin")}
            >
              Pin memory
            </button>
            <button
              className="secondary"
              onClick={() => void runMemoryCommand("archive")}
            >
              Archive memory
            </button>
            <button
              className="secondary"
              onClick={() => void runMemoryCommand("forget")}
            >
              Forget memory
            </button>
          </div>
        </article>
        <article className="panel">
          <h2>Category Toggles</h2>
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
            Research memory capture
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
            Wiki pointer memory
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
        "Reverted from wiki history surface.",
      );
      setCommandStatus("Command bridge: wiki.revertRevision");
    } catch (error) {
      setCommandStatus(commandErrorMessage(error));
    }
  }
  return (
    <HostShell>
      <h1>{detail ? scenario.wiki.title || "Wiki Page" : "Wiki Browser"}</h1>
      <section className="grid two">
        <article className="panel">
          <h2>Wiki Activity Feed</h2>
          <p>LLM Wiki Curator updated a source-linked risk lesson.</p>
        </article>
        <article className="panel" data-testid="wiki-revision-timeline">
          <h2>Revision Timeline</h2>
          <p>Revision: {scenario.wiki.revision}</p>
          <p>audit: audit-wiki-btc-nvda-revision</p>
          <p data-testid="wiki-command-status">{commandStatus}</p>
          <button className="secondary" onClick={() => void revertRevision()}>
            Revert revision
          </button>
        </article>
        <article className="panel" data-testid="source-link-drawer">
          <h2>Source Links</h2>
          <p>{scenario.wiki.sourceRef}</p>
        </article>
        <article className="panel" data-testid="wiki-diff-view">
          <h2>Diff View</h2>
          <p>Added concentration lesson and stale quote warning.</p>
        </article>
      </section>
    </HostShell>
  );
}

export function SettingsPage({ title }: { title: string }) {
  return (
    <HostShell>
      <h1>{title}</h1>
      <section className="panel">
        <p>
          Seeded MVP preview route for local command and Tauri webview
          inspection.
        </p>
      </section>
    </HostShell>
  );
}

export function NotFoundPage() {
  return (
    <HostShell>
      <h1>Not Found</h1>
      <section className="panel" data-testid="not-found">
        <p>The requested Plutus route does not exist.</p>
      </section>
    </HostShell>
  );
}

export function RemoteControlSettingsPage({
  scenario,
}: {
  scenario: PlutusScenario;
}) {
  return (
    <HostShell>
      <h1>Remote Control</h1>
      <section className="panel">
        <div className="row">
          <span>Status</span>
          <strong>Enabled</strong>
        </div>
        <div className="row">
          <span>Pairing code</span>
          <strong data-testid="pairing-code">
            {scenario.remoteDevice.pairingCode}
          </strong>
        </div>
        <div className="row">
          <span>Connected device</span>
          <strong>{scenario.remoteDevice.name}</strong>
        </div>
        <button className="secondary">
          Revoke {scenario.remoteDevice.name}
        </button>
      </section>
    </HostShell>
  );
}

export function PairPage({ scenario }: { scenario: PlutusScenario }) {
  return (
    <MobileShell>
      <h1>Pair With Mac</h1>
      <section className="panel">
        <p>Scan QR code or enter the short-lived pairing code.</p>
        <div className="pair-code">{scenario.remoteDevice.pairingCode}</div>
      </section>
    </MobileShell>
  );
}

export function RemoteStateBanner({ remote }: { remote: RemoteVisualState }) {
  return (
    <>
      <section className={`remote-state ${remote}`} data-testid="remote-state">
        {remoteStateLabel(remote)}
      </section>
      <span data-testid="connection-state">{remote}</span>
    </>
  );
}

export function ConnectionPage({ remote }: { remote: RemoteVisualState }) {
  return (
    <MobileShell>
      <h1>Connection</h1>
      <RemoteStateBanner remote={remote} />
      <section className="panel">
        <p>Host identity: Eunsoo MacBook Plutus</p>
        <p>Heartbeat and reconnect status are shown before mutations unlock.</p>
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
      setCommandSource("No remote command bridge connected");
      return;
    }
    if (!scenario.portfolio.id) {
      setCommandError("Create a portfolio before starting a research run.");
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
        setCommandError("Biometric unlock is required before remote commands.");
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
      <h1>Remote Dashboard</h1>
      <RemoteStateBanner remote={remote} />
      {remote === "revoked" ? (
        <section className="risk-warning" data-testid="remote-command-error">
          Remote command denied: permission revoked
        </section>
      ) : null}
      <article className="panel" data-testid="portfolio-core">
        <p>Mobile Remote Controller</p>
        <p>
          {scenario.portfolio.name}:{" "}
          {scenario.portfolio.positions
            .map((position) => position.symbol)
            .join(", ") || "no positions"}
        </p>
        <button
          className="primary"
          data-testid="remote-command"
          aria-label="Start Remote Research Run"
          disabled={disabled || pending}
          onClick={startRemoteReview}
        >
          {pending
            ? "Starting Mac-hosted run"
            : remote === "revoked"
              ? "Remote command denied"
              : "Start Mac-hosted run"}
        </button>
        {commandSource ? (
          <p data-testid="remote-command-status">{commandSource}</p>
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
    ? `${firstPosition.symbol} thesis note`
    : "Position thesis note";

  async function saveThesis() {
    if (!firstPosition?.id || !commandClient?.remote?.executeCommand) {
      setStatus("No editable position is available.");
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
        setStatus("Biometric unlock is required before remote commands.");
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
      setStatus("Saved thesis to Mac");
    } catch (error) {
      setStatus(commandErrorMessage(error));
    }
  }

  return (
    <MobileShell>
      <h1>Remote Portfolio</h1>
      <RemoteStateBanner remote={remote} />
      <PortfolioSummary scenario={scenario} />
      <section className="panel">
        <h2>Remote Thesis Edit</h2>
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
          Save thesis to Mac
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
    ? `${firstItem.symbol} watchlist note`
    : "Watchlist item note";
  async function saveNote() {
    if (!firstItem?.id || !commandClient?.remote?.executeCommand) {
      setStatus("No editable watchlist item is available.");
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
        setStatus("Biometric unlock is required before remote commands.");
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
      setStatus("Saved watchlist note to Mac");
    } catch (error) {
      setStatus(commandErrorMessage(error));
    }
  }
  return (
    <MobileShell>
      <h1>Remote Watchlist</h1>
      <RemoteStateBanner remote={remote} />
      <WatchlistPanel scenario={scenario} title={scenario.watchlist.name} />
      <section className="panel">
        <h2>Remote Note Edit</h2>
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
          Save watchlist note to Mac
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
  return (
    <MobileShell>
      <h1>Remote BTC Instrument</h1>
      <RemoteStateBanner remote={remote} />
      <section className="panel">
        <h2>
          {scenario.instrument.symbol} - {scenario.instrument.name}
        </h2>
        <p>{scenario.instrument.summary}</p>
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
  return (
    <MobileShell>
      <h1>Remote Runs</h1>
      <RemoteStateBanner remote={remote} />
      <section className="panel">
        <p>{scenario.run.title}</p>
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
  return (
    <MobileShell>
      <h1>Remote Run Detail</h1>
      <RemoteStateBanner remote={remote} />
      <section className="panel">
        <p>{scenario.run.status}</p>
        <RunStageList />
        <button className="secondary" disabled={remote !== "connected"}>
          Cancel Mac-hosted run
        </button>
      </section>
    </MobileShell>
  );
}

export function RemoteArtifactPage({ remote }: { remote: RemoteVisualState }) {
  return (
    <MobileShell>
      <h1>Remote Artifact</h1>
      <RemoteStateBanner remote={remote} />
      <section className="panel">
        <RiskChart />
        <p>Compact artifact summary streamed from the Mac host.</p>
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
  return (
    <MobileShell>
      <h1>Remote Memory</h1>
      <RemoteStateBanner remote={remote} />
      <section className="panel" data-testid="memory-activity-feed">
        <p>{scenario.memory.summary}</p>
        <p>Read-only on mobile for MVP.</p>
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
  return (
    <MobileShell>
      <h1>{detail ? "Remote Wiki Page" : "Remote Wiki"}</h1>
      <RemoteStateBanner remote={remote} />
      <section className="panel">
        <h2>{scenario.wiki.title}</h2>
        <p>Read-only wiki activity and page summary.</p>
      </section>
    </MobileShell>
  );
}

export function RemoteSettingsPage({ remote }: { remote: RemoteVisualState }) {
  return (
    <MobileShell>
      <h1>Remote Settings</h1>
      <RemoteStateBanner remote={remote} />
      <section className="panel">
        <p>Biometric unlock required before sensitive remote-control access.</p>
      </section>
    </MobileShell>
  );
}
